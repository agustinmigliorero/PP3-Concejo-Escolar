from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.controllers.tipo_comida_controller import (
    CreateTipoComidaRequest,
    UpdateTipoComidaRequest,
)
from app.models.tipo_comida_model import TipoComida


def get_all_tipos_comida(db: Session, include_inactive: bool = False) -> list[TipoComida]:
    query = db.query(TipoComida)
    if not include_inactive:
        query = query.filter(TipoComida.activo == True)
    return query.order_by(TipoComida.nombre).all()


def get_tipo_comida_by_id(db: Session, tipo_comida_id: int) -> TipoComida:
    tipo = db.query(TipoComida).filter(TipoComida.id == tipo_comida_id).first()
    if not tipo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tipo de comida no encontrado")
    return tipo


def _duplicate_exists(db: Session, nombre: str, exclude_id: int | None = None) -> bool:
    query = db.query(TipoComida).filter(func.lower(TipoComida.nombre) == nombre.lower())
    if exclude_id is not None:
        query = query.filter(TipoComida.id != exclude_id)
    return query.first() is not None


def create_tipo_comida(db: Session, data: CreateTipoComidaRequest) -> TipoComida:
    if _duplicate_exists(db, data.nombre):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un tipo de comida con ese nombre",
        )
    tipo = TipoComida(nombre=data.nombre)
    db.add(tipo)
    db.commit()
    db.refresh(tipo)
    return tipo


def update_tipo_comida(db: Session, tipo_comida_id: int, data: UpdateTipoComidaRequest) -> TipoComida:
    tipo = get_tipo_comida_by_id(db, tipo_comida_id)
    if _duplicate_exists(db, data.nombre, exclude_id=tipo_comida_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un tipo de comida con ese nombre",
        )
    tipo.nombre = data.nombre
    db.commit()
    db.refresh(tipo)
    return tipo


def toggle_active(db: Session, tipo_comida_id: int) -> TipoComida:
    tipo = get_tipo_comida_by_id(db, tipo_comida_id)
    tipo.activo = not tipo.activo
    db.commit()
    db.refresh(tipo)
    return tipo


def get_tipos_comida_by_ids(
    db: Session,
    ids: list[int],
    require_active: bool = True,
) -> list[TipoComida]:
    """Valida y devuelve los tipos de comida indicados, en el orden recibido.

    Reutilizado por recetas y escuelas para resolver las relaciones N:N.
    """
    unique_ids = list(dict.fromkeys(ids))
    if not unique_ids:
        return []

    tipos = db.query(TipoComida).filter(TipoComida.id.in_(unique_ids)).all()
    found = {tipo.id: tipo for tipo in tipos}

    missing = [tipo_id for tipo_id in unique_ids if tipo_id not in found]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Uno o más tipos de comida no existen",
        )

    if require_active:
        inactivos = [tipo.nombre for tipo in tipos if not tipo.activo]
        if inactivos:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Hay tipos de comida inactivos: {', '.join(inactivos)}",
            )

    return [found[tipo_id] for tipo_id in unique_ids]
