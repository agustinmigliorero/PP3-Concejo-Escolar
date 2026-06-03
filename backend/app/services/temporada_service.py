from fastapi import HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.controllers.temporada_controller import (
    CreateTemporadaRequest,
    UpdateTemporadaOpcionesRequest,
    UpdateTemporadaRequest,
)
from app.models.temporada_model import OpcionMenu, Temporada


def _default_menu_description(temporada: Temporada, numero_opcion: int) -> str:
    letra = "A" if numero_opcion == 1 else "B"
    return f"Semana {letra} - {temporada.nombre.value.title()} {temporada.anio}"


def _load_temporada_query(db: Session):
    return db.query(Temporada).options(selectinload(Temporada.opciones_menu))


def _ensure_two_options(db: Session, temporada: Temporada) -> Temporada:
    existing_numbers = {opcion.numero_opcion for opcion in temporada.opciones_menu}
    created = False

    for numero_opcion in (1, 2):
        if numero_opcion not in existing_numbers:
            db.add(
                OpcionMenu(
                    temporada_id=temporada.id,
                    numero_opcion=numero_opcion,
                    descripcion=_default_menu_description(temporada, numero_opcion),
                )
            )
            created = True

    if created:
        db.commit()
        temporada = get_temporada_by_id(db, temporada.id)

    return temporada


def _deactivate_other_temporadas(db: Session, temporada_id: int) -> None:
    db.query(Temporada).filter(Temporada.id != temporada_id, Temporada.activo == True).update(
        {Temporada.activo: False},
        synchronize_session=False,
    )


def get_all_temporadas(db: Session, include_inactive: bool = False) -> list[Temporada]:
    query = _load_temporada_query(db)
    if not include_inactive:
        query = query.filter(Temporada.activo == True)

    temporadas = query.order_by(Temporada.activo.desc(), Temporada.anio.desc(), Temporada.nombre.asc()).all()
    return [_ensure_two_options(db, temporada) for temporada in temporadas]


def get_temporada_by_id(db: Session, temporada_id: int) -> Temporada:
    temporada = _load_temporada_query(db).filter(Temporada.id == temporada_id).first()
    if not temporada:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Temporada no encontrada")
    return _ensure_two_options(db, temporada)


def get_temporada_activa(db: Session) -> Temporada:
    temporada = (
        _load_temporada_query(db)
        .filter(Temporada.activo == True)
        .order_by(Temporada.anio.desc(), Temporada.nombre.asc())
        .first()
    )
    if not temporada:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No hay una temporada activa")
    return _ensure_two_options(db, temporada)


def create_temporada(db: Session, data: CreateTemporadaRequest) -> Temporada:
    existing = (
        db.query(Temporada)
        .filter(Temporada.nombre == data.nombre, Temporada.anio == data.anio)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una temporada para ese nombre y a\u00f1o",
        )

    temporada = Temporada(**data.model_dump())
    db.add(temporada)
    db.flush()

    for numero_opcion in (1, 2):
        db.add(
            OpcionMenu(
                temporada_id=temporada.id,
                numero_opcion=numero_opcion,
                descripcion=_default_menu_description(temporada, numero_opcion),
            )
        )

    if temporada.activo:
        _deactivate_other_temporadas(db, temporada.id)

    db.commit()
    return get_temporada_by_id(db, temporada.id)


def update_temporada(db: Session, temporada_id: int, data: UpdateTemporadaRequest) -> Temporada:
    temporada = get_temporada_by_id(db, temporada_id)

    duplicate = (
        db.query(Temporada)
        .filter(
            Temporada.nombre == data.nombre,
            Temporada.anio == data.anio,
            Temporada.id != temporada_id,
        )
        .first()
    )
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una temporada para ese nombre y a\u00f1o",
        )

    temporada.nombre = data.nombre
    temporada.anio = data.anio
    temporada.activo = data.activo

    if temporada.activo:
        _deactivate_other_temporadas(db, temporada.id)

    db.commit()
    return get_temporada_by_id(db, temporada.id)


def toggle_active(db: Session, temporada_id: int) -> Temporada:
    temporada = get_temporada_by_id(db, temporada_id)
    temporada.activo = not temporada.activo

    if temporada.activo:
        _deactivate_other_temporadas(db, temporada.id)

    db.commit()
    return get_temporada_by_id(db, temporada.id)


def update_menu_options(
    db: Session,
    temporada_id: int,
    data: UpdateTemporadaOpcionesRequest,
) -> Temporada:
    temporada = get_temporada_by_id(db, temporada_id)
    opciones_por_numero = {opcion.numero_opcion: opcion for opcion in temporada.opciones_menu}

    for opcion_data in data.opciones:
        opcion = opciones_por_numero.get(opcion_data.numero_opcion)
        if opcion is None:
            opcion = OpcionMenu(
                temporada_id=temporada.id,
                numero_opcion=opcion_data.numero_opcion,
            )
            db.add(opcion)
        opcion.descripcion = opcion_data.descripcion

    db.commit()
    return get_temporada_by_id(db, temporada.id)
