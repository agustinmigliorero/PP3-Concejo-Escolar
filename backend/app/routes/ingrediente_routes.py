from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.ingrediente_controller import (
    CreateIngredienteRequest,
    IngredienteResponse,
    UpdateIngredienteRequest,
)
from app.middlewares.auth_middleware import require_admin, require_gestor_or_admin
from app.services import ingrediente_service

router = APIRouter(prefix="/ingredientes", tags=["ingredientes"])


@router.get("", response_model=list[IngredienteResponse])
def list_ingredientes(
    include_inactive: bool = False,
    db: Session = Depends(get_db), 
    _=Depends(require_gestor_or_admin)
):
    return ingrediente_service.get_all_ingredientes(db, include_inactive)


@router.get("/{ingrediente_id}", response_model=IngredienteResponse)
def get_ingrediente(
    ingrediente_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    return ingrediente_service.get_ingrediente_by_id(db, ingrediente_id)


@router.post("", response_model=IngredienteResponse, status_code=201)
def create_ingrediente(
    body: CreateIngredienteRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return ingrediente_service.create_ingrediente(db, body)


@router.put("/{ingrediente_id}", response_model=IngredienteResponse)
def update_ingrediente(
    ingrediente_id: int,
    body: UpdateIngredienteRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return ingrediente_service.update_ingrediente(db, ingrediente_id, body)


@router.patch("/{ingrediente_id}/toggle-active", response_model=IngredienteResponse)
def toggle_active(
    ingrediente_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return ingrediente_service.toggle_active(db, ingrediente_id)
