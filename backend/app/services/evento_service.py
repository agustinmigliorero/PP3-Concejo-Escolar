from fastapi import HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.controllers.evento_controller import (
    CreateEventoRequest,
    EventoConfirmRequest,
    EventoPreviewRequest,
    UpdateEventoRequest,
)
from app.models.evento_model import Evento, EventoReceta
from app.models.pedido_model import GeneracionPedido
from app.models.user_model import User
from app.services import pedido_service


# ---------------------------------------------------------------------------
# CRUD de eventos
# ---------------------------------------------------------------------------

def _evento_query(db: Session):
    return db.query(Evento).options(
        selectinload(Evento.recetas).joinedload(EventoReceta.receta)
    )


def get_all_eventos(db: Session, include_inactive: bool = False) -> list[Evento]:
    query = _evento_query(db)
    if not include_inactive:
        query = query.filter(Evento.activo == True)
    return query.order_by(Evento.fecha.desc()).all()


def get_evento_by_id(db: Session, evento_id: int) -> Evento:
    evento = _evento_query(db).filter(Evento.id == evento_id).first()
    if not evento:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evento no encontrado")
    return evento


def create_evento(db: Session, data: CreateEventoRequest) -> Evento:
    pedido_service.validate_recetas_exist(db, data.receta_ids)
    evento = Evento(nombre=data.nombre, fecha=data.fecha, descripcion=data.descripcion)
    evento.recetas = [EventoReceta(receta_id=receta_id) for receta_id in data.receta_ids]
    db.add(evento)
    db.commit()
    return get_evento_by_id(db, evento.id)


def update_evento(db: Session, evento_id: int, data: UpdateEventoRequest) -> Evento:
    evento = get_evento_by_id(db, evento_id)
    pedido_service.validate_recetas_exist(db, data.receta_ids)
    evento.nombre = data.nombre
    evento.fecha = data.fecha
    evento.descripcion = data.descripcion
    evento.recetas = [EventoReceta(receta_id=receta_id) for receta_id in data.receta_ids]
    db.commit()
    return get_evento_by_id(db, evento_id)


def toggle_active(db: Session, evento_id: int) -> Evento:
    evento = get_evento_by_id(db, evento_id)
    evento.activo = not evento.activo
    db.commit()
    return get_evento_by_id(db, evento_id)


# ---------------------------------------------------------------------------
# Generacion de pedidos de eventos (reusa el motor de pedido_service)
# ---------------------------------------------------------------------------

def _build_snapshot(db: Session, data: EventoPreviewRequest | EventoConfirmRequest) -> tuple[Evento, dict]:
    evento = get_evento_by_id(db, data.evento_id)
    if not evento.activo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El evento esta inactivo")

    receta_ids = [item.receta_id for item in evento.recetas]
    recetas = pedido_service.load_recetas_con_ingredientes(db, receta_ids)
    schools = pedido_service.load_active_schools(db)
    comensales_by_school = {item.escuela_id: item.cantidad for item in data.comensales}
    demandas = pedido_service.demandas_por_comensales(schools, recetas, comensales_by_school)

    header = {
        "tipo": "EVENTO",
        "titulo": f"Evento - {evento.nombre}",
        "semana_inicio": evento.fecha.isoformat(),
        "dias_habiles": [],
        "opcion_menu": None,
        "evento_id": evento.id,
        "evento_nombre": evento.nombre,
    }
    snapshot = pedido_service.build_snapshot_from_demandas(
        db,
        demandas=demandas,
        stock_overrides=data.stock_overrides,
        provider_reference_date=evento.fecha,
        header=header,
    )
    return evento, snapshot


def preview(db: Session, data: EventoPreviewRequest) -> dict:
    _, snapshot = _build_snapshot(db, data)
    return snapshot


def confirm(db: Session, data: EventoConfirmRequest, user: User) -> GeneracionPedido:
    evento, snapshot = _build_snapshot(db, data)
    return pedido_service.persist_special_pedido(
        db,
        tipo="EVENTO",
        semana_inicio=evento.fecha,
        snapshot=snapshot,
        user=user,
        notas=data.notas,
        evento_id=evento.id,
    )


def list_pedidos_for_user(db: Session, user: User) -> list[GeneracionPedido]:
    return pedido_service.list_pedidos_for_user(db, user, tipo="EVENTO")
