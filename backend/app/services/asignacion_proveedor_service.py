from datetime import date
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.controllers.asignacion_proveedor_controller import (
    AsignacionResponse,
    CreateAsignacionRequest,
    CreateAsignacionesLoteRequest,
    UpdatePrecioRequest,
)
from app.models.asignacion_proveedor_model import AsignacionProveedor
from app.models.ingrediente_model import Ingrediente
from app.models.location_model import Localidad
from app.models.proveedor_model import Proveedor


def _to_response(asignacion: AsignacionProveedor) -> AsignacionResponse:
    return AsignacionResponse(
        id=asignacion.id,
        proveedor_id=asignacion.proveedor_id,
        ingrediente_id=asignacion.ingrediente_id,
        localidad_id=asignacion.localidad_id,
        precio_unitario=asignacion.precio_unitario,
        fecha_desde=asignacion.fecha_desde,
        fecha_hasta=asignacion.fecha_hasta,
        vigente=asignacion.fecha_hasta is None,
        proveedor_nombre=asignacion.proveedor.nombre if asignacion.proveedor else None,
        ingrediente_nombre=asignacion.ingrediente.nombre if asignacion.ingrediente else None,
        localidad_nombre=asignacion.localidad.nombre if asignacion.localidad else None,
        unidad_medida=asignacion.ingrediente.unidad_medida if asignacion.ingrediente else None,
    )


def _get_active_for_combo(
    db: Session, ingrediente_id: int, localidad_id: int
) -> Optional[AsignacionProveedor]:
    return (
        db.query(AsignacionProveedor)
        .filter(
            AsignacionProveedor.ingrediente_id == ingrediente_id,
            AsignacionProveedor.localidad_id == localidad_id,
            AsignacionProveedor.fecha_hasta.is_(None),
        )
        .first()
    )


def list_asignaciones(
    db: Session,
    ingrediente_id: Optional[int] = None,
    localidad_id: Optional[int] = None,
    proveedor_id: Optional[int] = None,
    solo_vigentes: bool = True,
) -> list[AsignacionResponse]:
    query = db.query(AsignacionProveedor)
    if ingrediente_id is not None:
        query = query.filter(AsignacionProveedor.ingrediente_id == ingrediente_id)
    if localidad_id is not None:
        query = query.filter(AsignacionProveedor.localidad_id == localidad_id)
    if proveedor_id is not None:
        query = query.filter(AsignacionProveedor.proveedor_id == proveedor_id)
    if solo_vigentes:
        query = query.filter(AsignacionProveedor.fecha_hasta.is_(None))

    rows = query.order_by(
        AsignacionProveedor.fecha_desde.desc(), AsignacionProveedor.id.desc()
    ).all()
    return [_to_response(r) for r in rows]


def get_historial(
    db: Session, ingrediente_id: int, localidad_id: int
) -> list[AsignacionResponse]:
    """Historial completo de asignaciones para un (ingrediente, localidad)."""
    rows = (
        db.query(AsignacionProveedor)
        .filter(
            AsignacionProveedor.ingrediente_id == ingrediente_id,
            AsignacionProveedor.localidad_id == localidad_id,
        )
        .order_by(AsignacionProveedor.fecha_desde.desc(), AsignacionProveedor.id.desc())
        .all()
    )
    return [_to_response(r) for r in rows]


def _prepare_asignacion(
    db: Session, data: CreateAsignacionRequest
) -> tuple[AsignacionProveedor, Optional[AsignacionProveedor]]:
    proveedor = db.query(Proveedor).filter(Proveedor.id == data.proveedor_id).first()
    if not proveedor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proveedor no encontrado")
    if not proveedor.activo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El proveedor está inactivo")

    ingrediente = db.query(Ingrediente).filter(Ingrediente.id == data.ingrediente_id).first()
    if not ingrediente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingrediente no encontrado")
    if not ingrediente.activo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El ingrediente está inactivo")

    localidad = db.query(Localidad).filter(Localidad.id == data.localidad_id).first()
    if not localidad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Localidad no encontrada")
    if not localidad.activo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La localidad está inactiva")

    fecha_desde = data.fecha_desde or date.today()

    # Cierre automático de la asignación vigente anterior para esta combinación.
    actual = _get_active_for_combo(db, data.ingrediente_id, data.localidad_id)
    if actual is not None:
        if fecha_desde < actual.fecha_desde:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "La fecha desde no puede ser anterior al inicio de la asignación "
                    f"vigente en {localidad.nombre} ({actual.fecha_desde.isoformat()})"
                ),
            )

    nueva = AsignacionProveedor(
        proveedor_id=data.proveedor_id,
        ingrediente_id=data.ingrediente_id,
        localidad_id=data.localidad_id,
        precio_unitario=data.precio_unitario,
        fecha_desde=fecha_desde,
        fecha_hasta=None,
    )
    return nueva, actual


def _create_asignaciones(
    db: Session, entries: list[CreateAsignacionRequest]
) -> list[AsignacionResponse]:
    try:
        # Validar todo antes de cerrar vigencias o insertar filas.
        prepared = [_prepare_asignacion(db, entry) for entry in entries]
        for nueva, actual in prepared:
            if actual is not None:
                # Fecha de cierre exclusiva: la anterior termina al iniciar la nueva.
                actual.fecha_hasta = nueva.fecha_desde
            db.add(nueva)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return [_to_response(nueva) for nueva, _ in prepared]


def create_asignacion(db: Session, data: CreateAsignacionRequest) -> AsignacionResponse:
    return _create_asignaciones(db, [data])[0]


def create_asignaciones_lote(
    db: Session, data: CreateAsignacionesLoteRequest
) -> list[AsignacionResponse]:
    fecha_desde = data.fecha_desde or date.today()
    return _create_asignaciones(db, [
        CreateAsignacionRequest(
            proveedor_id=data.proveedor_id,
            ingrediente_id=data.ingrediente_id,
            localidad_id=localidad.localidad_id,
            precio_unitario=localidad.precio_unitario,
            fecha_desde=fecha_desde,
        )
        for localidad in data.localidades
    ])


def update_precio(db: Session, asignacion_id: int, data: UpdatePrecioRequest) -> AsignacionResponse:
    asignacion = (
        db.query(AsignacionProveedor)
        .filter(AsignacionProveedor.id == asignacion_id)
        .first()
    )
    if not asignacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asignación no encontrada")
    if asignacion.fecha_hasta is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Solo se puede editar el precio de la asignación vigente",
        )

    asignacion.precio_unitario = data.precio_unitario
    db.commit()
    db.refresh(asignacion)
    return _to_response(asignacion)
