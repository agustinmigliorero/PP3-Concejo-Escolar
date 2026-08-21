from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.patio_controller import (
    CreatePatioMenuRequest,
    PatioConfirmRequest,
    PatioMenuResponse,
    PatioPedidoResponse,
    PatioPreviewRequest,
    PatioPreviewResponse,
    UpdatePatioMenuRequest,
)
from app.middlewares.auth_middleware import (
    get_current_user,
    require_admin,
    require_gestor_or_admin,
)
from app.models.pedido_model import GeneracionPedido
from app.models.patio_model import PatioMenu
from app.models.user_model import User
from app.services import patio_service, pedido_service

router = APIRouter(prefix="/patios", tags=["patios"])


def _menu_response(menu: PatioMenu) -> PatioMenuResponse:
    return PatioMenuResponse(
        id=menu.id,
        nombre=menu.nombre,
        descripcion=menu.descripcion,
        activo=menu.activo,
        recetas=[
            {
                "receta_id": item.receta_id,
                "receta_nombre": item.receta.nombre if item.receta else "",
                "activo": item.receta.activo if item.receta else False,
            }
            for item in menu.recetas
        ],
    )


def _pedido_response(pedido: GeneracionPedido, user: User) -> PatioPedidoResponse:
    snapshot = pedido_service.school_snapshot_for_user(pedido.datos_snapshot, user)
    return PatioPedidoResponse(
        id=pedido.id,
        tipo=pedido.tipo,
        semana_inicio=pedido.semana_inicio,
        patio_menu_id=snapshot.get("patio_menu_id"),
        generado_por_id=pedido.generado_por_id,
        generado_at=pedido.generado_at,
        notas=pedido.notas,
        datos_snapshot=snapshot,
    )


# --- Menus de patio ---------------------------------------------------------

@router.get("/menus", response_model=list[PatioMenuResponse])
def list_menus(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    return [_menu_response(menu) for menu in patio_service.get_all_menus(db, include_inactive)]


@router.get("/menus/{menu_id}", response_model=PatioMenuResponse)
def get_menu(menu_id: int, db: Session = Depends(get_db), _=Depends(require_gestor_or_admin)):
    return _menu_response(patio_service.get_menu_by_id(db, menu_id))


@router.post("/menus", response_model=PatioMenuResponse, status_code=201)
def create_menu(
    body: CreatePatioMenuRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return _menu_response(patio_service.create_menu(db, body))


@router.put("/menus/{menu_id}", response_model=PatioMenuResponse)
def update_menu(
    menu_id: int,
    body: UpdatePatioMenuRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return _menu_response(patio_service.update_menu(db, menu_id, body))


@router.patch("/menus/{menu_id}/toggle-active", response_model=PatioMenuResponse)
def toggle_menu(menu_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    return _menu_response(patio_service.toggle_active(db, menu_id))


# --- Pedidos de patios ------------------------------------------------------

@router.post("/pedidos/preview", response_model=PatioPreviewResponse)
def preview_patio(
    body: PatioPreviewRequest,
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    return PatioPreviewResponse(snapshot=patio_service.preview(db, body))


@router.post("/pedidos", response_model=PatioPedidoResponse, status_code=201)
def confirm_patio(
    body: PatioConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gestor_or_admin),
):
    return _pedido_response(patio_service.confirm(db, body, current_user), current_user)


@router.get("/pedidos", response_model=list[PatioPedidoResponse])
def list_patio_pedidos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return [
        _pedido_response(pedido, current_user)
        for pedido in patio_service.list_pedidos_for_user(db, current_user)
    ]


@router.get("/pedidos/{pedido_id}", response_model=PatioPedidoResponse)
def get_patio_pedido(
    pedido_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _pedido_response(pedido_service.get_pedido_for_user(db, pedido_id, current_user), current_user)
