from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.localidad_controller import (
    CreateLocalidadRequest,
    LocalidadResponse,
    UpdateLocalidadRequest,
)
from app.middlewares.auth_middleware import require_admin, require_gestor_or_admin
from app.services import localidad_service

router = APIRouter(prefix="/localidades", tags=["localidades"])


@router.get("", response_model=list[LocalidadResponse])
def list_localidades(db: Session = Depends(get_db), _=Depends(require_gestor_or_admin)):
    return localidad_service.get_all_localidades(db)


@router.post("", response_model=LocalidadResponse, status_code=201)
def create_localidad(
    body: CreateLocalidadRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return localidad_service.create_localidad(db, body.nombre)


@router.put("/{localidad_id}", response_model=LocalidadResponse)
def update_localidad(
    localidad_id: int,
    body: UpdateLocalidadRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return localidad_service.update_localidad(db, localidad_id, body.nombre)


@router.patch("/{localidad_id}/toggle-active", response_model=LocalidadResponse)
def toggle_active(
    localidad_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return localidad_service.toggle_active(db, localidad_id)
