from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CreateAsignacionRequest(BaseModel):
    proveedor_id: int = Field(..., gt=0)
    ingrediente_id: int = Field(..., gt=0)
    localidad_id: int = Field(..., gt=0)
    precio_unitario: Decimal = Field(..., gt=0)
    # Si no se envía, el servicio usa la fecha de hoy.
    fecha_desde: Optional[date] = None


class PrecioLocalidadRequest(BaseModel):
    localidad_id: int = Field(..., gt=0)
    precio_unitario: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2)


class CreateAsignacionesLoteRequest(BaseModel):
    proveedor_id: int = Field(..., gt=0)
    ingrediente_id: int = Field(..., gt=0)
    fecha_desde: Optional[date] = None
    localidades: list[PrecioLocalidadRequest] = Field(..., min_length=1)

    @model_validator(mode="after")
    def validate_localidades_unicas(self):
        ids = [localidad.localidad_id for localidad in self.localidades]
        if len(ids) != len(set(ids)):
            raise ValueError("Cada localidad debe aparecer una sola vez")
        return self


class UpdatePrecioRequest(BaseModel):
    """Solo se permite editar el precio de la asignación vigente."""

    precio_unitario: Decimal = Field(..., gt=0)


class AsignacionPrecioHistorialResponse(BaseModel):
    """Un cambio de precio ya ocurrido. `variacion` es `precio_nuevo -
    precio_anterior`: negativa si el precio bajó."""

    id: int
    asignacion_id: int
    precio_anterior: Decimal
    precio_nuevo: Decimal
    variacion: Decimal
    variacion_pct: Optional[Decimal] = None
    proveedor_nombre: Optional[str] = None
    precio_actual: Optional[Decimal] = None
    vigente: bool = False
    modificado_por_username: Optional[str] = None
    modificado_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AsignacionResponse(BaseModel):
    id: int
    proveedor_id: int
    ingrediente_id: int
    localidad_id: int
    precio_unitario: Decimal
    fecha_desde: date
    fecha_hasta: Optional[date]
    vigente: bool

    proveedor_nombre: Optional[str] = None
    ingrediente_nombre: Optional[str] = None
    localidad_nombre: Optional[str] = None
    unidad_medida: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
