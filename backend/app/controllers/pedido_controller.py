from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StockOverrideRequest(BaseModel):
    escuela_id: int = Field(..., gt=0)
    ingrediente_id: int = Field(..., gt=0)
    cantidad: Decimal = Field(..., ge=0)


class PedidoBaseRequest(BaseModel):
    semana_inicio: date
    opcion_menu_id: int = Field(..., gt=0)
    dias_habiles: list[int] = Field(default_factory=lambda: [1, 2, 3, 4, 5])
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
        if self.semana_inicio.weekday() != 0:
            raise ValueError("La fecha de inicio de semana debe ser lunes")
        if not self.dias_habiles:
            raise ValueError("Debe seleccionarse al menos un dia habil")
        if any(dia < 1 or dia > 5 for dia in self.dias_habiles):
            raise ValueError("Los dias habiles deben estar entre 1 y 5")
        if len(self.dias_habiles) != len(set(self.dias_habiles)):
            raise ValueError("No se puede repetir un dia habil")

        stock_keys = [
            (item.escuela_id, item.ingrediente_id)
            for item in self.stock_overrides
        ]
        if len(stock_keys) != len(set(stock_keys)):
            raise ValueError("No se puede repetir stock para la misma escuela e ingrediente")
        self.dias_habiles = sorted(self.dias_habiles)
        return self


class PreviewPedidoRequest(PedidoBaseRequest):
    pass


class ConfirmPedidoRequest(PedidoBaseRequest):
    pass


class PedidoPreviewResponse(BaseModel):
    snapshot: dict[str, Any]


class PedidoResponse(BaseModel):
    id: int
    semana_inicio: date
    opcion_menu_id: int
    dias_habiles: list[int]
    generado_por_id: int
    generado_at: datetime
    notas: str | None
    datos_snapshot: dict[str, Any]

    model_config = ConfigDict(from_attributes=True)
