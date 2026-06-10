from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.receta_controller import (
    CreateRecetaRequest,
    RecetaResponse,
    UpdateRecetaRequest,
)
from app.middlewares.auth_middleware import require_admin
from app.services import receta_service

router = APIRouter(prefix="/recetas", tags=["recetas"])


@router.get("", response_model=list[RecetaResponse])
def list_recetas(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return receta_service.get_all_recetas(db, include_inactive)


@router.get("/{receta_id}", response_model=RecetaResponse)
def get_receta(
    receta_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return receta_service.get_receta_by_id(db, receta_id)


@router.post("", response_model=RecetaResponse, status_code=201)
def create_receta(
    body: CreateRecetaRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return receta_service.create_receta(db, body)


@router.put("/{receta_id}", response_model=RecetaResponse)
def update_receta(
    receta_id: int,
    body: UpdateRecetaRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return receta_service.update_receta(db, receta_id, body)


@router.patch("/{receta_id}/toggle-active", response_model=RecetaResponse)
def toggle_receta_active(
    receta_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return receta_service.toggle_active(db, receta_id)
