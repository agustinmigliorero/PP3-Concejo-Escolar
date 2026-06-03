from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.controllers.stock_previo_controller import (
    StockPrevioResponse,
    StockPrevioSchoolResponse,
    UpdateStockPrevioRequest,
)
from app.models.ingrediente_model import Ingrediente
from app.models.school_model import School
from app.models.stock_previo_model import StockPrevio
from app.models.user_model import User, UserRole


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


def _get_active_ingredientes(db: Session) -> list[Ingrediente]:
    return (
        db.query(Ingrediente)
        .filter(Ingrediente.activo == True)
        .order_by(Ingrediente.nombre)
        .all()
    )


def _build_response(db: Session, school: School) -> StockPrevioSchoolResponse:
    ingredientes = _get_active_ingredientes(db)
    rows = (
        db.query(StockPrevio)
        .filter(StockPrevio.escuela_id == school.id)
        .all()
    )
    stock_by_ingrediente = {row.ingrediente_id: row for row in rows}

    return StockPrevioSchoolResponse(
        escuela_id=school.id,
        escuela_nombre=school.name,
        items=[
            StockPrevioResponse(
                ingrediente_id=ingrediente.id,
                ingrediente_nombre=ingrediente.nombre,
                unidad_medida=ingrediente.unidad_medida,
                cantidad=(
                    stock_by_ingrediente[ingrediente.id].cantidad
                    if ingrediente.id in stock_by_ingrediente
                    else Decimal("0")
                ),
                cargado_at=(
                    stock_by_ingrediente[ingrediente.id].cargado_at
                    if ingrediente.id in stock_by_ingrediente
                    else None
                ),
            )
            for ingrediente in ingredientes
        ],
    )


def get_my_stock(db: Session, user: User) -> StockPrevioSchoolResponse:
    school = _get_school_for_escuela_user(db, user)
    return _build_response(db, school)


def get_school_stock(db: Session, school_id: int) -> StockPrevioSchoolResponse:
    school = _get_school_or_404(db, school_id)
    return _build_response(db, school)


def update_school_stock(
    db: Session,
    school_id: int,
    data: UpdateStockPrevioRequest,
    user: User,
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
                cargado_por_id=user.id,
            )
            db.add(stock)
        else:
            stock.cantidad = item.cantidad
            stock.cargado_por_id = user.id

    db.commit()
    return _build_response(db, school)


def update_my_stock(
    db: Session,
    data: UpdateStockPrevioRequest,
    user: User,
) -> StockPrevioSchoolResponse:
    school = _get_school_for_escuela_user(db, user)
    return update_school_stock(db, school.id, data, user)
