from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.receta_model import TipoComida


class RecetaIngredienteItemRequest(BaseModel):
    ingrediente_id: int = Field(..., gt=0)
    cantidad_por_porcion: Decimal = Field(..., gt=0)


class CreateRecetaRequest(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=200)
    tipo_comida: TipoComida
    temporada_id: int = Field(..., gt=0)
    ingredientes: list[RecetaIngredienteItemRequest]

    @field_validator("nombre")
    @classmethod
    def strip_nombre(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def validate_ingredientes(self):
        if not self.ingredientes:
            raise ValueError("La receta debe tener al menos un ingrediente")

        ingrediente_ids = [item.ingrediente_id for item in self.ingredientes]
        if len(ingrediente_ids) != len(set(ingrediente_ids)):
            raise ValueError("No se puede repetir un ingrediente dentro de la receta")
        return self


class UpdateRecetaRequest(CreateRecetaRequest):
    pass


class RecetaIngredienteResponse(BaseModel):
    id: int
    ingrediente_id: int
    ingrediente_nombre: str
    unidad_medida: str
    cantidad_por_porcion: Decimal


class RecetaResponse(BaseModel):
    id: int
    nombre: str
    tipo_comida: TipoComida
    temporada_id: int | None
    temporada_nombre: str | None
    temporada_anio: int | None
    activo: bool
    ingredientes: list[RecetaIngredienteResponse]

    model_config = ConfigDict(from_attributes=True)
