from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.controllers.stock_previo_controller import (
    StockPrevioResponse,
    StockPrevioSchoolResponse,
    UpdateStockPrevioRequest,
)
from app.models.ingrediente_model import Ingrediente
from app.models.receta_model import Receta, RecetaIngrediente
from app.models.school_model import School
from app.models.stock_previo_model import StockPrevio
from app.models.temporada_model import DiaMenu, OpcionMenu, Temporada
from app.models.tipo_comida_model import receta_tipos_comida
from app.models.user_model import User, UserRole
from app.services import notification_service


def _get_school_or_404(db: Session, school_id: int) -> School:
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Escuela no encontrada")
    return school


def _get_school_for_escuela_user(db: Session, user: User) -> School:
    if user.role != UserRole.escuela:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los usuarios escuela pueden acceder a este stock",
        )
    if user.school_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El usuario no tiene una escuela asociada",
        )
    return _get_school_or_404(db, user.school_id)


def _get_school_union_ingredientes(db: Session, school: School) -> list[Ingrediente]:
    """Active ingredients of every receta served by the school's TipoComida services.

    Static union over ALL the school's tipos (no DiaMenu narrowing), ordered by
    Ingrediente.nombre.
    """
    tipo_ids = [tipo.id for tipo in school.tipos_comida]
    if not tipo_ids:
        return []
    return (
        db.query(Ingrediente)
        .join(RecetaIngrediente, RecetaIngrediente.ingrediente_id == Ingrediente.id)
        .join(Receta, Receta.id == RecetaIngrediente.receta_id)
        .join(receta_tipos_comida, receta_tipos_comida.c.receta_id == Receta.id)
        .filter(
            receta_tipos_comida.c.tipo_comida_id.in_(tipo_ids),
            Ingrediente.activo == True,
        )
        .distinct()
        .order_by(Ingrediente.nombre)
        .all()
    )


def _get_active_season_ingrediente_ids(db: Session) -> set[int] | None:
    """Ids of active ingredients used by recetas of the active temporada.

    Returns None when there is no active temporada, or an empty set when the
    active temporada has no recetas (or none of them uses an active ingredient).
    """
    active_temporada = db.query(Temporada).filter(Temporada.activo == True).first()
    if active_temporada is None:
        return None
    rows = (
        db.query(RecetaIngrediente.ingrediente_id)
        .join(Receta, Receta.id == RecetaIngrediente.receta_id)
        .join(Ingrediente, Ingrediente.id == RecetaIngrediente.ingrediente_id)
        .filter(
            Receta.temporada_id == active_temporada.id,
            Ingrediente.activo == True,
        )
        .distinct()
        .all()
    )
    return {ingrediente_id for (ingrediente_id,) in rows}


def _get_scoped_ingredientes(db: Session, school: School) -> list[Ingrediente]:
    """visible = school-tipo union INTERSECT active-season ingredients (D7)."""
    union = _get_school_union_ingredientes(db, school)
    season_ids = _get_active_season_ingrediente_ids(db)
    if not season_ids:
        # No active temporada or no in-season ingredients: fall back to the
        # school union itself, never to the global list (DD-5).
        return union
    # Non-empty season set: intersect even when the result is empty; an empty
    # intersection is a legitimate empty state, not a fallback trigger (DD-5).
    return [ingrediente for ingrediente in union if ingrediente.id in season_ids]


def _get_active_ingredientes(
    db: Session, scope_school: School | None = None
) -> list[Ingrediente]:
    if scope_school is not None:
        return _get_scoped_ingredientes(db, scope_school)

    active_temporada = db.query(Temporada).filter(Temporada.activo == True).first()
    if active_temporada:
        ingredientes = (
            db.query(Ingrediente)
            .join(RecetaIngrediente, RecetaIngrediente.ingrediente_id == Ingrediente.id)
            .join(DiaMenu, DiaMenu.receta_id == RecetaIngrediente.receta_id)
            .join(OpcionMenu, OpcionMenu.id == DiaMenu.opcion_menu_id)
            .filter(
                OpcionMenu.temporada_id == active_temporada.id,
                Ingrediente.activo == True,
            )
            .distinct()
            .order_by(Ingrediente.nombre)
            .all()
        )
        if ingredientes:
            return ingredientes

    return (
        db.query(Ingrediente)
        .filter(Ingrediente.activo == True)
        .order_by(Ingrediente.nombre)
        .all()
    )


def _build_response(
    db: Session,
    school: School,
    scope_school: School | None = None,
) -> StockPrevioSchoolResponse:
    ingredientes = _get_active_ingredientes(db, scope_school)
    rows = (
        db.query(StockPrevio)
        .filter(StockPrevio.escuela_id == school.id)
        .all()
    )
    stock_by_ingrediente = {row.ingrediente_id: row for row in rows}

    items = [
        StockPrevioResponse(
            ingrediente_id=ingrediente.id,
            ingrediente_nombre=ingrediente.nombre,
            unidad_medida=ingrediente.unidad_medida,
            cantidad=(
                stock_by_ingrediente[ingrediente.id].cantidad
                if ingrediente.id in stock_by_ingrediente
                else Decimal("0")
            ),
            previous_cantidad=(
                stock_by_ingrediente[ingrediente.id].previous_cantidad
                if ingrediente.id in stock_by_ingrediente
                else None
            ),
            cargado_at=(
                stock_by_ingrediente[ingrediente.id].cargado_at
                if ingrediente.id in stock_by_ingrediente
                else None
            ),
        )
        for ingrediente in ingredientes
    ]

    return StockPrevioSchoolResponse(
        escuela_id=school.id,
        escuela_nombre=school.name,
        items=items,
        sin_recetas=not items,
    )


def get_my_stock(db: Session, user: User) -> StockPrevioSchoolResponse:
    school = _get_school_for_escuela_user(db, user)
    return _build_response(db, school, scope_school=school)


def get_school_stock(db: Session, school_id: int) -> StockPrevioSchoolResponse:
    school = _get_school_or_404(db, school_id)
    return _build_response(db, school)


def update_school_stock(
    db: Session,
    school_id: int,
    data: UpdateStockPrevioRequest,
    user: User,
    scope_school: School | None = None,
) -> StockPrevioSchoolResponse:
    school = _get_school_or_404(db, school_id)
    if not school.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede cargar stock para una escuela inactiva",
        )

    ingrediente_ids = [item.ingrediente_id for item in data.items]
    ingredientes = (
        db.query(Ingrediente)
        .filter(Ingrediente.id.in_(ingrediente_ids))
        .all()
        if ingrediente_ids
        else []
    )
    ingredientes_by_id = {ingrediente.id: ingrediente for ingrediente in ingredientes}
    prev_cantidades: dict[int, str] = {}

    for item in data.items:
        ingrediente = ingredientes_by_id.get(item.ingrediente_id)
        if ingrediente is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ingrediente {item.ingrediente_id} no encontrado",
            )
        if not ingrediente.activo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El ingrediente {ingrediente.nombre} esta inactivo",
            )

        stock = (
            db.query(StockPrevio)
            .filter(
                StockPrevio.escuela_id == school.id,
                StockPrevio.ingrediente_id == item.ingrediente_id,
            )
            .first()
        )
        if stock is None:
            stock = StockPrevio(
                escuela_id=school.id,
                ingrediente_id=item.ingrediente_id,
                cantidad=item.cantidad,
                previous_cantidad=Decimal("0"),
                cargado_por_id=user.id,
                cargado_at=datetime.now(timezone.utc),
            )
            db.add(stock)
            prev_cantidades[item.ingrediente_id] = "0"
        else:
            prev_cantidades[item.ingrediente_id] = str(stock.cantidad)
            if stock.cantidad != item.cantidad:
                stock.previous_cantidad = stock.cantidad
                stock.cantidad = item.cantidad
                stock.cargado_at = datetime.now(timezone.utc)
                stock.cargado_por_id = user.id

    db.commit()

    # The notification payload is always built from the GLOBAL active list,
    # even when the save came through PUT /stock-previo/me (DD-6).
    all_ingredientes = _get_active_ingredientes(db, scope_school=None)
    all_stock_rows = (
        db.query(StockPrevio)
        .filter(StockPrevio.escuela_id == school.id)
        .all()
    )
    stock_map = {row.ingrediente_id: row for row in all_stock_rows}
    updated_items = {item.ingrediente_id: item for item in data.items}

    items_detail = []
    for ingrediente in all_ingredientes:
        if ingrediente.id in prev_cantidades:
            new_val = str(updated_items[ingrediente.id].cantidad)
            old_val = prev_cantidades[ingrediente.id]
            was_updated = True
        else:
            stock_row = stock_map.get(ingrediente.id)
            val = str(stock_row.cantidad) if stock_row else "0"
            new_val = val
            old_val = val
            was_updated = False

        items_detail.append({
            "nombre": ingrediente.nombre,
            "unidad_medida": ingrediente.unidad_medida,
            "cantidad": new_val,
            "cantidad_anterior": old_val,
            "actualizado": was_updated,
        })

    notification_service.create_stock_notification(db, school, user, items=items_detail)
    return _build_response(db, school, scope_school=scope_school)


def update_my_stock(
    db: Session,
    data: UpdateStockPrevioRequest,
    user: User,
) -> StockPrevioSchoolResponse:
    school = _get_school_for_escuela_user(db, user)

    # Write allow-list: every ingrediente_id must belong to the school's scoped
    # set BEFORE any mutation runs, so a rejected payload is atomic by
    # construction (no partial writes). Unknown/inactive ids are trivially
    # out-of-scope here and covered by the same gate (DD-3).
    allowed_ids = {
        ingrediente.id
        for ingrediente in _get_active_ingredientes(db, scope_school=school)
    }
    for item in data.items:
        if item.ingrediente_id not in allowed_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Ingrediente {item.ingrediente_id} fuera del alcance "
                    "de los servicios de esta escuela"
                ),
            )

    return update_school_stock(db, school.id, data, user, scope_school=school)
