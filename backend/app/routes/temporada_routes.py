from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.temporada_controller import (
    CreateTemporadaRequest,
    TemporadaResponse,
    UpdateTemporadaOpcionesRequest,
    UpdateTemporadaRequest,
)
from app.middlewares.auth_middleware import require_admin, require_gestor_or_admin
from app.services import temporada_service

router = APIRouter(prefix="/temporadas", tags=["temporadas"])


@router.get("", response_model=list[TemporadaResponse])
def list_temporadas(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return temporada_service.get_all_temporadas(db, include_inactive)


@router.get("/active", response_model=TemporadaResponse)
def get_temporada_activa(
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    return temporada_service.get_temporada_activa(db)


@router.get("/{temporada_id}", response_model=TemporadaResponse)
def get_temporada(
    temporada_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return temporada_service.get_temporada_by_id(db, temporada_id)


@router.post("", response_model=TemporadaResponse, status_code=201)
def create_temporada(
    body: CreateTemporadaRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return temporada_service.create_temporada(db, body)


@router.put("/{temporada_id}", response_model=TemporadaResponse)
def update_temporada(
    temporada_id: int,
    body: UpdateTemporadaRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return temporada_service.update_temporada(db, temporada_id, body)


@router.put("/{temporada_id}/opciones", response_model=TemporadaResponse)
def update_temporada_opciones(
    temporada_id: int,
    body: UpdateTemporadaOpcionesRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return temporada_service.update_menu_options(db, temporada_id, body)


@router.patch("/{temporada_id}/toggle-active", response_model=TemporadaResponse)
def toggle_temporada_active(
    temporada_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return temporada_service.toggle_active(db, temporada_id)
