from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.evento_controller import (
    CreateEventoRequest,
    EventoConfirmRequest,
    EventoPedidoResponse,
    EventoPreviewRequest,
    EventoPreviewResponse,
    EventoResponse,
    UpdateEventoRequest,
)
from app.middlewares.auth_middleware import get_current_user, require_gestor_or_admin
from app.models.evento_model import Evento
from app.models.pedido_model import GeneracionPedido
from app.models.user_model import User
from app.services import evento_service, pedido_service

router = APIRouter(prefix="/eventos", tags=["eventos"])


def _evento_response(evento: Evento) -> EventoResponse:
    return EventoResponse(
        id=evento.id,
        nombre=evento.nombre,
        fecha=evento.fecha,
        descripcion=evento.descripcion,
        activo=evento.activo,
        recetas=[
            {
                "receta_id": item.receta_id,
                "receta_nombre": item.receta.nombre if item.receta else "",
                "activo": item.receta.activo if item.receta else False,
            }
            for item in evento.recetas
        ],
    )


def _pedido_response(pedido: GeneracionPedido, user: User) -> EventoPedidoResponse:
    snapshot = pedido_service.school_snapshot_for_user(pedido.datos_snapshot, user)
    return EventoPedidoResponse(
        id=pedido.id,
        tipo=pedido.tipo,
        semana_inicio=pedido.semana_inicio,
        evento_id=pedido.evento_id,
        evento_nombre=snapshot.get("evento_nombre"),
        generado_por_id=pedido.generado_por_id,
        generado_at=pedido.generado_at,
        notas=pedido.notas,
        datos_snapshot=snapshot,
    )


# --- Eventos ----------------------------------------------------------------

@router.get("", response_model=list[EventoResponse])
def list_eventos(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    return [_evento_response(evento) for evento in evento_service.get_all_eventos(db, include_inactive)]


@router.get("/{evento_id}", response_model=EventoResponse)
def get_evento(evento_id: int, db: Session = Depends(get_db), _=Depends(require_gestor_or_admin)):
    return _evento_response(evento_service.get_evento_by_id(db, evento_id))


@router.post("", response_model=EventoResponse, status_code=201)
def create_evento(
    body: CreateEventoRequest,
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    return _evento_response(evento_service.create_evento(db, body))


@router.put("/{evento_id}", response_model=EventoResponse)
def update_evento(
    evento_id: int,
    body: UpdateEventoRequest,
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    return _evento_response(evento_service.update_evento(db, evento_id, body))


@router.patch("/{evento_id}/toggle-active", response_model=EventoResponse)
def toggle_evento(evento_id: int, db: Session = Depends(get_db), _=Depends(require_gestor_or_admin)):
    return _evento_response(evento_service.toggle_active(db, evento_id))


# --- Pedidos de eventos -----------------------------------------------------

@router.post("/pedidos/preview", response_model=EventoPreviewResponse)
def preview_evento(
    body: EventoPreviewRequest,
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    return EventoPreviewResponse(snapshot=evento_service.preview(db, body))


@router.post("/pedidos", response_model=EventoPedidoResponse, status_code=201)
def confirm_evento(
    body: EventoConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gestor_or_admin),
):
    return _pedido_response(evento_service.confirm(db, body, current_user), current_user)


@router.get("/pedidos/listado", response_model=list[EventoPedidoResponse])
def list_evento_pedidos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return [
        _pedido_response(pedido, current_user)
        for pedido in evento_service.list_pedidos_for_user(db, current_user)
    ]


@router.get("/pedidos/{pedido_id}", response_model=EventoPedidoResponse)
def get_evento_pedido(
    pedido_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _pedido_response(pedido_service.get_pedido_for_user(db, pedido_id, current_user), current_user)
