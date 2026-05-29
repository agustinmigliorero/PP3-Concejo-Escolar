from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.asignacion_proveedor_controller import (
    AsignacionResponse,
    CreateAsignacionRequest,
    UpdatePrecioRequest,
)
from app.middlewares.auth_middleware import require_admin
from app.services import asignacion_proveedor_service

router = APIRouter(prefix="/asignaciones", tags=["asignaciones"])


@router.get("", response_model=list[AsignacionResponse])
def list_asignaciones(
    ingrediente_id: Optional[int] = Query(None),
    localidad_id: Optional[int] = Query(None),
    proveedor_id: Optional[int] = Query(None),
    solo_vigentes: bool = Query(True),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return asignacion_proveedor_service.list_asignaciones(
        db,
        ingrediente_id=ingrediente_id,
        localidad_id=localidad_id,
        proveedor_id=proveedor_id,
        solo_vigentes=solo_vigentes,
    )


@router.get("/historial", response_model=list[AsignacionResponse])
def get_historial(
    ingrediente_id: int = Query(...),
    localidad_id: int = Query(...),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return asignacion_proveedor_service.get_historial(db, ingrediente_id, localidad_id)


@router.post("", response_model=AsignacionResponse, status_code=201)
def create_asignacion(
    body: CreateAsignacionRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return asignacion_proveedor_service.create_asignacion(db, body)


@router.put("/{asignacion_id}", response_model=AsignacionResponse)
def update_precio(
    asignacion_id: int,
    body: UpdatePrecioRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return asignacion_proveedor_service.update_precio(db, asignacion_id, body)
