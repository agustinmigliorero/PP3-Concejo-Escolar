from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.proveedor_controller import (
    CreateProveedorRequest,
    ProveedorResponse,
    UpdateProveedorRequest,
)
from app.middlewares.auth_middleware import require_admin
from app.services import proveedor_service

router = APIRouter(prefix="/proveedores", tags=["proveedores"])


@router.get("", response_model=list[ProveedorResponse])
def list_proveedores(db: Session = Depends(get_db), _=Depends(require_admin)):
    return proveedor_service.get_all_proveedores(db)


@router.get("/{proveedor_id}", response_model=ProveedorResponse)
def get_proveedor(
    proveedor_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return proveedor_service.get_proveedor_by_id(db, proveedor_id)


@router.post("", response_model=ProveedorResponse, status_code=201)
def create_proveedor(
    body: CreateProveedorRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return proveedor_service.create_proveedor(db, body)


@router.put("/{proveedor_id}", response_model=ProveedorResponse)
def update_proveedor(
    proveedor_id: int,
    body: UpdateProveedorRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return proveedor_service.update_proveedor(db, proveedor_id, body)


@router.patch("/{proveedor_id}/toggle-active", response_model=ProveedorResponse)
def toggle_active(
    proveedor_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return proveedor_service.toggle_active(db, proveedor_id)
