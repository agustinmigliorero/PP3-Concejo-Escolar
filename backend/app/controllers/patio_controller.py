from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.controllers.pedido_controller import StockOverrideRequest


class PatioMenuRecetaResponse(BaseModel):
    receta_id: int
    receta_nombre: str
    activo: bool


class PatioMenuResponse(BaseModel):
    id: int
    nombre: str
    descripcion: str | None
    activo: bool
    recetas: list[PatioMenuRecetaResponse]


class CreatePatioMenuRequest(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=120)
    descripcion: str | None = Field(None, max_length=255)
    receta_ids: list[int] = Field(default_factory=list)

    @field_validator("nombre")
    @classmethod
    def strip_nombre(cls, v: str) -> str:
        return v.strip()

    @field_validator("descripcion")
    @classmethod
    def strip_descripcion(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        return stripped or None

    @field_validator("receta_ids")
    @classmethod
    def unique_recetas(cls, v: list[int]) -> list[int]:
        return list(dict.fromkeys(v))


class UpdatePatioMenuRequest(CreatePatioMenuRequest):
    pass


class ComensalesItem(BaseModel):
    escuela_id: int = Field(..., gt=0)
    cantidad: int = Field(..., ge=0)


class PatioPedidoBaseRequest(BaseModel):
    fecha: date
    patio_menu_id: int = Field(..., gt=0)
    comensales: list[ComensalesItem] = Field(default_factory=list)
    stock_overrides: list[StockOverrideRequest] = Field(default_factory=list)
    notas: str | None = Field(None, max_length=500)

    @field_validator("notas")
    @classmethod
    def strip_notas(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @model_validator(mode="after")
    def validate_payload(self):
        # Los patios escolares son un servicio de los sabados.
        if self.fecha.weekday() != 5:
            raise ValueError("La fecha de patios debe ser un sabado")

        escuela_keys = [item.escuela_id for item in self.comensales]
        if len(escuela_keys) != len(set(escuela_keys)):
            raise ValueError("No se puede repetir una escuela en los comensales")

        stock_keys = [(item.escuela_id, item.ingrediente_id) for item in self.stock_overrides]
        if len(stock_keys) != len(set(stock_keys)):
            raise ValueError("No se puede repetir stock para la misma escuela e ingrediente")
        return self


class PatioPreviewRequest(PatioPedidoBaseRequest):
    pass


class PatioConfirmRequest(PatioPedidoBaseRequest):
    pass


class PatioPreviewResponse(BaseModel):
    snapshot: dict[str, Any]


class PatioPedidoResponse(BaseModel):
    id: int
    tipo: str
    semana_inicio: date
    patio_menu_id: int | None
    generado_por_id: int
    generado_at: datetime
    notas: str | None
    datos_snapshot: dict[str, Any]

    model_config = ConfigDict(from_attributes=True)
