from fastapi import HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.controllers.menu_controller import (
    TemporadaMenuResponse,
    UpdateTemporadaMenuRequest,
)
from app.models.receta_model import Receta
from app.models.temporada_model import DiaMenu, OpcionMenu, Temporada
from app.services import tipo_comida_service


def _menu_response(temporada: Temporada) -> TemporadaMenuResponse:
    return TemporadaMenuResponse(
        temporada_id=temporada.id,
        opciones=[
            {
                "id": opcion.id,
                "numero_opcion": opcion.numero_opcion,
                "descripcion": opcion.descripcion,
                "dias_menu": [
                    {
                        "id": dia.id,
                        "opcion_menu_id": dia.opcion_menu_id,
                        "dia_semana": dia.dia_semana,
                        "tipo_comida_id": dia.tipo_comida_id,
                        "tipo_comida_nombre": dia.tipo_comida.nombre if dia.tipo_comida else "",
                        "receta_id": dia.receta_id,
                        "receta_nombre": dia.receta.nombre if dia.receta else "",
                    }
                    for dia in opcion.dias_menu
                ],
            }
            for opcion in temporada.opciones_menu
        ],
    )


def _load_temporada(db: Session, temporada_id: int) -> Temporada:
    temporada = (
        db.query(Temporada)
        .options(
            selectinload(Temporada.opciones_menu)
            .selectinload(OpcionMenu.dias_menu)
            .joinedload(DiaMenu.receta),
            selectinload(Temporada.opciones_menu)
            .selectinload(OpcionMenu.dias_menu)
            .joinedload(DiaMenu.tipo_comida),
        )
        .filter(Temporada.id == temporada_id)
        .first()
    )
    if not temporada:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Temporada no encontrada")
    return temporada


def get_temporada_menu(db: Session, temporada_id: int) -> TemporadaMenuResponse:
    return _menu_response(_load_temporada(db, temporada_id))


def update_temporada_menu(
    db: Session,
    temporada_id: int,
    data: UpdateTemporadaMenuRequest,
) -> TemporadaMenuResponse:
    temporada = _load_temporada(db, temporada_id)
    opcion_ids = {opcion.id for opcion in temporada.opciones_menu}
    incoming_opcion_ids = {item.opcion_menu_id for item in data.items}
    invalid_opciones = incoming_opcion_ids - opcion_ids
    if invalid_opciones:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hay opciones de menu que no pertenecen a la temporada",
        )

    tipo_ids = {item.tipo_comida_id for item in data.items}
    if tipo_ids:
        tipo_comida_service.get_tipos_comida_by_ids(db, list(tipo_ids))

    receta_ids = {item.receta_id for item in data.items}
    recetas = (
        db.query(Receta).options(selectinload(Receta.tipos_comida)).filter(Receta.id.in_(receta_ids)).all()
        if receta_ids
        else []
    )
    recetas_by_id = {receta.id: receta for receta in recetas}
    missing_recetas = receta_ids - set(recetas_by_id)
    if missing_recetas:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Una o mas recetas no existen")

    for receta in recetas:
        if not receta.activo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La receta {receta.nombre} esta inactiva",
            )
        if receta.temporada_id != temporada_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La receta {receta.nombre} no pertenece a esta temporada",
            )

    for item in data.items:
        receta = recetas_by_id[item.receta_id]
        receta_tipo_ids = {tipo.id for tipo in receta.tipos_comida}
        if item.tipo_comida_id not in receta_tipo_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La receta {receta.nombre} no esta habilitada para ese tipo de comida",
            )

    db.query(DiaMenu).filter(DiaMenu.opcion_menu_id.in_(opcion_ids)).delete(
        synchronize_session=False,
    )
    for item in data.items:
        db.add(
            DiaMenu(
                opcion_menu_id=item.opcion_menu_id,
                dia_semana=item.dia_semana,
                tipo_comida_id=item.tipo_comida_id,
                receta_id=item.receta_id,
            )
        )

    db.commit()
    return get_temporada_menu(db, temporada_id)
