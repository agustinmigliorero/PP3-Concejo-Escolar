from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.controllers.ingrediente_controller import CreateIngredienteRequest, UpdateIngredienteRequest
from app.models.ingrediente_model import Ingrediente


def get_all_ingredientes(db: Session, include_inactive: bool = False) -> list[Ingrediente]:
    query = db.query(Ingrediente)
    if not include_inactive:
        query = query.filter(Ingrediente.activo == True)
    return query.order_by(Ingrediente.nombre).all()


def get_ingrediente_by_id(db: Session, ingrediente_id: int) -> Ingrediente:
    ingrediente = db.query(Ingrediente).filter(Ingrediente.id == ingrediente_id).first()
    if not ingrediente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingrediente no encontrado")
    return ingrediente


def create_ingrediente(db: Session, data: CreateIngredienteRequest) -> Ingrediente:
    if db.query(Ingrediente).filter(Ingrediente.nombre == data.nombre).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un ingrediente con ese nombre")
    
    ingrediente = Ingrediente(**data.model_dump())
    db.add(ingrediente)
    db.commit()
    db.refresh(ingrediente)
    return ingrediente


def update_ingrediente(db: Session, ingrediente_id: int, data: UpdateIngredienteRequest) -> Ingrediente:
    ingrediente = get_ingrediente_by_id(db, ingrediente_id)
    
    if db.query(Ingrediente).filter(Ingrediente.nombre == data.nombre, Ingrediente.id != ingrediente_id).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un ingrediente con ese nombre")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(ingrediente, key, value)
        
    db.commit()
    db.refresh(ingrediente)
    return ingrediente


def toggle_active(db: Session, ingrediente_id: int) -> Ingrediente:
    ingrediente = get_ingrediente_by_id(db, ingrediente_id)
    ingrediente.activo = not ingrediente.activo
    db.commit()
    db.refresh(ingrediente)
    return ingrediente
