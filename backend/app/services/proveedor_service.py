from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.controllers.proveedor_controller import (
    CreateProveedorRequest,
    UpdateProveedorRequest,
)
from app.models.proveedor_model import Proveedor


def get_all_proveedores(db: Session) -> list[Proveedor]:
    return db.query(Proveedor).order_by(Proveedor.nombre).all()


def get_proveedor_by_id(db: Session, proveedor_id: int) -> Proveedor:
    proveedor = db.query(Proveedor).filter(Proveedor.id == proveedor_id).first()
    if not proveedor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proveedor no encontrado")
    return proveedor


def create_proveedor(db: Session, data: CreateProveedorRequest) -> Proveedor:
    if db.query(Proveedor).filter(Proveedor.nombre == data.nombre).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un proveedor con ese nombre")

    proveedor = Proveedor(**data.model_dump())
    db.add(proveedor)
    db.commit()
    db.refresh(proveedor)
    return proveedor


def update_proveedor(db: Session, proveedor_id: int, data: UpdateProveedorRequest) -> Proveedor:
    proveedor = get_proveedor_by_id(db, proveedor_id)

    if db.query(Proveedor).filter(Proveedor.nombre == data.nombre, Proveedor.id != proveedor_id).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un proveedor con ese nombre")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(proveedor, key, value)

    db.commit()
    db.refresh(proveedor)
    return proveedor


def toggle_active(db: Session, proveedor_id: int) -> Proveedor:
    proveedor = get_proveedor_by_id(db, proveedor_id)
    proveedor.activo = not proveedor.activo
    db.commit()
    db.refresh(proveedor)
    return proveedor
