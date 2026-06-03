from fastapi import HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.controllers.receta_controller import CreateRecetaRequest, UpdateRecetaRequest
from app.models.ingrediente_model import Ingrediente
from app.models.receta_model import Receta, RecetaIngrediente


def _receta_query(db: Session):
    return db.query(Receta).options(
        selectinload(Receta.ingredientes).joinedload(RecetaIngrediente.ingrediente)
    )


def _receta_to_response(receta: Receta) -> dict:
    return {
        "id": receta.id,
        "nombre": receta.nombre,
        "tipo_comida": receta.tipo_comida,
        "activo": receta.activo,
        "ingredientes": [
            {
                "id": item.id,
                "ingrediente_id": item.ingrediente_id,
                "ingrediente_nombre": item.ingrediente.nombre if item.ingrediente else "",
                "unidad_medida": item.ingrediente.unidad_medida if item.ingrediente else "",
                "cantidad_por_porcion": item.cantidad_por_porcion,
            }
            for item in receta.ingredientes
        ],
    }


def _get_ingredientes_map(db: Session, ingrediente_ids: list[int]) -> dict[int, Ingrediente]:
    ingredientes = (
        db.query(Ingrediente)
        .filter(Ingrediente.id.in_(ingrediente_ids))
        .all()
    )
    ingredientes_map = {ingrediente.id: ingrediente for ingrediente in ingredientes}

    faltantes = [ingrediente_id for ingrediente_id in ingrediente_ids if ingrediente_id not in ingredientes_map]
    if faltantes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Uno o más ingredientes no existen",
        )

    inactivos = [ingrediente.nombre for ingrediente in ingredientes if not ingrediente.activo]
    if inactivos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Hay ingredientes inactivos en la receta: {', '.join(inactivos)}",
        )

    return ingredientes_map


def get_all_recetas(db: Session, include_inactive: bool = False) -> list[dict]:
    query = _receta_query(db)
    if not include_inactive:
        query = query.filter(Receta.activo == True)

    recetas = query.order_by(Receta.tipo_comida.asc(), Receta.nombre.asc()).all()
    return [_receta_to_response(receta) for receta in recetas]


def get_receta_by_id(db: Session, receta_id: int) -> dict:
    receta = _receta_query(db).filter(Receta.id == receta_id).first()
    if not receta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receta no encontrada")
    return _receta_to_response(receta)


def create_receta(db: Session, data: CreateRecetaRequest) -> dict:
    if db.query(Receta).filter(Receta.nombre == data.nombre).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una receta con ese nombre",
        )

    _get_ingredientes_map(
        db,
        [item.ingrediente_id for item in data.ingredientes],
    )

    receta = Receta(nombre=data.nombre, tipo_comida=data.tipo_comida)
    db.add(receta)
    db.flush()

    for item in data.ingredientes:
        db.add(
            RecetaIngrediente(
                receta_id=receta.id,
                ingrediente_id=item.ingrediente_id,
                cantidad_por_porcion=item.cantidad_por_porcion,
            )
        )

    db.commit()
    receta = _receta_query(db).filter(Receta.id == receta.id).first()
    return _receta_to_response(receta)


def update_receta(db: Session, receta_id: int, data: UpdateRecetaRequest) -> dict:
    receta = db.query(Receta).options(selectinload(Receta.ingredientes)).filter(Receta.id == receta_id).first()
    if not receta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receta no encontrada")

    if (
        db.query(Receta)
        .filter(Receta.nombre == data.nombre, Receta.id != receta_id)
        .first()
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una receta con ese nombre",
        )

    _get_ingredientes_map(db, [item.ingrediente_id for item in data.ingredientes])

    receta.nombre = data.nombre
    receta.tipo_comida = data.tipo_comida
    receta.ingredientes.clear()
    db.flush()

    for item in data.ingredientes:
        receta.ingredientes.append(
            RecetaIngrediente(
                ingrediente_id=item.ingrediente_id,
                cantidad_por_porcion=item.cantidad_por_porcion,
            )
        )

    db.commit()
    return get_receta_by_id(db, receta_id)


def toggle_active(db: Session, receta_id: int) -> dict:
    receta = db.query(Receta).filter(Receta.id == receta_id).first()
    if not receta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receta no encontrada")

    receta.activo = not receta.activo
    db.commit()
    return get_receta_by_id(db, receta_id)
