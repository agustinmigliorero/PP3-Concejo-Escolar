from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StockPrevioItemRequest(BaseModel):
    ingrediente_id: int = Field(..., gt=0)
    cantidad: Decimal = Field(..., ge=0)


class UpdateStockPrevioRequest(BaseModel):
    items: list[StockPrevioItemRequest]

    @model_validator(mode="after")
    def validate_unique_ingredientes(self):
        ingrediente_ids = [item.ingrediente_id for item in self.items]
        if len(ingrediente_ids) != len(set(ingrediente_ids)):
            raise ValueError("No se puede repetir el mismo ingrediente")
        return self


class StockPrevioResponse(BaseModel):
    ingrediente_id: int
    ingrediente_nombre: str
    unidad_medida: str
    cantidad: Decimal
    cargado_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class StockPrevioSchoolResponse(BaseModel):
    escuela_id: int
    escuela_nombre: str
    items: list[StockPrevioResponse]
