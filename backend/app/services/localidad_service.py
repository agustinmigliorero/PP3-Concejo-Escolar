from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.location_model import Localidad


def get_all_localidades(db: Session) -> list[Localidad]:
    return db.query(Localidad).order_by(Localidad.nombre).all()


def get_localidad_by_id(db: Session, localidad_id: int) -> Localidad:
    localidad = db.query(Localidad).filter(Localidad.id == localidad_id).first()
    if not localidad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Localidad no encontrada")
    return localidad


def create_localidad(db: Session, nombre: str) -> Localidad:
    if db.query(Localidad).filter(Localidad.nombre == nombre).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe una localidad con ese nombre")
    localidad = Localidad(nombre=nombre)
    db.add(localidad)
    db.commit()
    db.refresh(localidad)
    return localidad


def update_localidad(db: Session, localidad_id: int, nombre: str) -> Localidad:
    localidad = get_localidad_by_id(db, localidad_id)
    if db.query(Localidad).filter(Localidad.nombre == nombre, Localidad.id != localidad_id).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe una localidad con ese nombre")
    localidad.nombre = nombre
    db.commit()
    db.refresh(localidad)
    return localidad


def toggle_active(db: Session, localidad_id: int) -> Localidad:
    localidad = get_localidad_by_id(db, localidad_id)
    localidad.activo = not localidad.activo
    db.commit()
    db.refresh(localidad)
    return localidad
