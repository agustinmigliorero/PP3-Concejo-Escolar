from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.tipo_comida_controller import (
    CreateTipoComidaRequest,
    TipoComidaResponse,
    UpdateTipoComidaRequest,
)
from app.middlewares.auth_middleware import require_admin, require_gestor_or_admin
from app.services import tipo_comida_service

router = APIRouter(prefix="/tipos-comida", tags=["tipos-comida"])


@router.get("", response_model=list[TipoComidaResponse])
def list_tipos_comida(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    return tipo_comida_service.get_all_tipos_comida(db, include_inactive)


@router.get("/{tipo_comida_id}", response_model=TipoComidaResponse)
def get_tipo_comida(
    tipo_comida_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    return tipo_comida_service.get_tipo_comida_by_id(db, tipo_comida_id)


@router.post("", response_model=TipoComidaResponse, status_code=201)
def create_tipo_comida(
    body: CreateTipoComidaRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return tipo_comida_service.create_tipo_comida(db, body)


@router.put("/{tipo_comida_id}", response_model=TipoComidaResponse)
def update_tipo_comida(
    tipo_comida_id: int,
    body: UpdateTipoComidaRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return tipo_comida_service.update_tipo_comida(db, tipo_comida_id, body)


@router.patch("/{tipo_comida_id}/toggle-active", response_model=TipoComidaResponse)
def toggle_active(
    tipo_comida_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return tipo_comida_service.toggle_active(db, tipo_comida_id)
