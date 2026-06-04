import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.pedido_controller import (
    ConfirmPedidoRequest,
    PedidoPreviewResponse,
    PedidoResponse,
    PreviewPedidoRequest,
)
from app.middlewares.auth_middleware import get_current_user, require_gestor_or_admin
from app.models.user_model import User
from app.services import pedido_service

router = APIRouter(prefix="/pedidos", tags=["pedidos"])


def _pedido_response(pedido, current_user: User) -> PedidoResponse:
    return PedidoResponse(
        id=pedido.id,
        semana_inicio=pedido.semana_inicio,
        opcion_menu_id=pedido.opcion_menu_id,
        dias_habiles=json.loads(pedido.dias_habiles),
        generado_por_id=pedido.generado_por_id,
        generado_at=pedido.generado_at,
        notas=pedido.notas,
        datos_snapshot=pedido_service.school_snapshot_for_user(pedido.datos_snapshot, current_user),
    )


@router.post("/preview", response_model=PedidoPreviewResponse)
def preview_pedido(
    body: PreviewPedidoRequest,
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    return PedidoPreviewResponse(snapshot=pedido_service.preview_pedido(db, body))


@router.post("", response_model=PedidoResponse, status_code=201)
def confirm_pedido(
    body: ConfirmPedidoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gestor_or_admin),
):
    return _pedido_response(pedido_service.confirm_pedido(db, body, current_user), current_user)


@router.get("", response_model=list[PedidoResponse])
def list_pedidos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return [
        _pedido_response(pedido, current_user)
        for pedido in pedido_service.list_pedidos_for_user(db, current_user)
    ]


@router.get("/{pedido_id}", response_model=PedidoResponse)
def get_pedido(
    pedido_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _pedido_response(pedido_service.get_pedido_for_user(db, pedido_id, current_user), current_user)


@router.get("/{pedido_id}/export/excel")
def export_pedido_excel(
    pedido_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pedido = pedido_service.get_pedido_for_user(db, pedido_id, current_user)
    content = pedido_service.export_resumen_excel(pedido, current_user)
    filename = f"resumen_pedido_{pedido.id}_{pedido.semana_inicio.isoformat()}.xlsx"
    return StreamingResponse(
        content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{pedido_id}/export/pdf")
def export_pedido_pdf(
    pedido_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pedido = pedido_service.get_pedido_for_user(db, pedido_id, current_user)
    content = pedido_service.export_resumen_pdf(pedido, current_user)
    filename = f"resumen_pedido_{pedido.id}_{pedido.semana_inicio.isoformat()}.pdf"
    return StreamingResponse(
        content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{pedido_id}/export/proveedores/excel")
def export_proveedores_excel(
    pedido_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pedido = pedido_service.get_pedido_for_user(db, pedido_id, current_user)
    content = pedido_service.export_proveedores_zip(pedido, current_user, "excel")
    filename = f"ordenes_proveedores_{pedido.id}_{pedido.semana_inicio.isoformat()}.zip"
    return StreamingResponse(
        content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{pedido_id}/export/proveedores/pdf")
def export_proveedores_pdf(
    pedido_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pedido = pedido_service.get_pedido_for_user(db, pedido_id, current_user)
    content = pedido_service.export_proveedores_zip(pedido, current_user, "pdf")
    filename = f"ordenes_proveedores_{pedido.id}_{pedido.semana_inicio.isoformat()}.zip"
    return StreamingResponse(
        content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
