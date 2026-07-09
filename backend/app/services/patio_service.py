from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.controllers.patio_controller import (
    CreatePatioMenuRequest,
    PatioConfirmRequest,
    PatioPreviewRequest,
    UpdatePatioMenuRequest,
)
from app.models.patio_model import PatioMenu, PatioMenuReceta
from app.models.pedido_model import GeneracionPedido
from app.models.user_model import User
from app.services import pedido_service


# ---------------------------------------------------------------------------
# CRUD de menus de patio
# ---------------------------------------------------------------------------

def _menu_query(db: Session):
    return db.query(PatioMenu).options(
        selectinload(PatioMenu.recetas).joinedload(PatioMenuReceta.receta)
    )


def get_all_menus(db: Session, include_inactive: bool = False) -> list[PatioMenu]:
    query = _menu_query(db)
    if not include_inactive:
        query = query.filter(PatioMenu.activo == True)
    return query.order_by(PatioMenu.nombre).all()


def get_menu_by_id(db: Session, menu_id: int) -> PatioMenu:
    menu = _menu_query(db).filter(PatioMenu.id == menu_id).first()
    if not menu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu de patios no encontrado")
    return menu


def _duplicate_name(db: Session, nombre: str, exclude_id: int | None = None) -> bool:
    query = db.query(PatioMenu).filter(func.lower(PatioMenu.nombre) == nombre.lower())
    if exclude_id is not None:
        query = query.filter(PatioMenu.id != exclude_id)
    return query.first() is not None


def create_menu(db: Session, data: CreatePatioMenuRequest) -> PatioMenu:
    if _duplicate_name(db, data.nombre):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un menu de patios con ese nombre")
    pedido_service.validate_recetas_exist(db, data.receta_ids)
    menu = PatioMenu(nombre=data.nombre, descripcion=data.descripcion)
    menu.recetas = [PatioMenuReceta(receta_id=receta_id) for receta_id in data.receta_ids]
    db.add(menu)
    db.commit()
    return get_menu_by_id(db, menu.id)


def update_menu(db: Session, menu_id: int, data: UpdatePatioMenuRequest) -> PatioMenu:
    menu = get_menu_by_id(db, menu_id)
    if _duplicate_name(db, data.nombre, exclude_id=menu_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un menu de patios con ese nombre")
    pedido_service.validate_recetas_exist(db, data.receta_ids)
    menu.nombre = data.nombre
    menu.descripcion = data.descripcion
    menu.recetas = [PatioMenuReceta(receta_id=receta_id) for receta_id in data.receta_ids]
    db.commit()
    return get_menu_by_id(db, menu_id)


def toggle_active(db: Session, menu_id: int) -> PatioMenu:
    menu = get_menu_by_id(db, menu_id)
    menu.activo = not menu.activo
    db.commit()
    return get_menu_by_id(db, menu_id)


# ---------------------------------------------------------------------------
# Generacion de pedidos de patios (reusa el motor de pedido_service)
# ---------------------------------------------------------------------------

def _build_snapshot(db: Session, data: PatioPreviewRequest | PatioConfirmRequest) -> dict:
    menu = get_menu_by_id(db, data.patio_menu_id)
    if not menu.activo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El menu de patios esta inactivo")

    receta_ids = [item.receta_id for item in menu.recetas]
    recetas = pedido_service.load_recetas_con_ingredientes(db, receta_ids)
    schools = pedido_service.load_active_schools(db)
    comensales_by_school = {item.escuela_id: item.cantidad for item in data.comensales}
    demandas = pedido_service.demandas_por_comensales(schools, recetas, comensales_by_school)

    header = {
        "tipo": "PATIO",
        "titulo": f"Patios escolares - {menu.nombre}",
        "semana_inicio": data.fecha.isoformat(),
        "dias_habiles": [],
        "opcion_menu": None,
        "patio_menu_id": menu.id,
        "patio_menu_nombre": menu.nombre,
    }
    return pedido_service.build_snapshot_from_demandas(
        db,
        demandas=demandas,
        stock_overrides=data.stock_overrides,
        provider_reference_date=data.fecha,
        header=header,
    )


def preview(db: Session, data: PatioPreviewRequest) -> dict:
    return _build_snapshot(db, data)


def confirm(db: Session, data: PatioConfirmRequest, user: User) -> GeneracionPedido:
    snapshot = _build_snapshot(db, data)
    return pedido_service.persist_special_pedido(
        db,
        tipo="PATIO",
        semana_inicio=data.fecha,
        snapshot=snapshot,
        user=user,
        notas=data.notas,
    )


def list_pedidos_for_user(db: Session, user: User) -> list[GeneracionPedido]:
    return pedido_service.list_pedidos_for_user(db, user, tipo="PATIO")
