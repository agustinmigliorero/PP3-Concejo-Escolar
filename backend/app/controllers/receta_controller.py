from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.controllers.tipo_comida_controller import TipoComidaResponse


class RecetaIngredienteItemRequest(BaseModel):
    ingrediente_id: int = Field(..., gt=0)
    cantidad_por_porcion: Decimal = Field(..., gt=0)


class CreateRecetaRequest(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=200)
    tipos_comida_ids: list[int] = Field(..., min_length=1)
    temporada_id: int = Field(..., gt=0)
    ingredientes: list[RecetaIngredienteItemRequest]

    @field_validator("nombre")
    @classmethod
    def strip_nombre(cls, value: str) -> str:
        return value.strip()

    @field_validator("tipos_comida_ids")
    @classmethod
    def validate_tipos_comida(cls, value: list[int]) -> list[int]:
        if any(tipo_id <= 0 for tipo_id in value):
            raise ValueError("Tipo de comida invalido")
        if len(value) != len(set(value)):
            raise ValueError("No se puede repetir un tipo de comida en la receta")
        return value

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
    tipos_comida: list[TipoComidaResponse]
    temporada_id: int | None
    temporada_nombre: str | None
    temporada_anio: int | None
    activo: bool
    ingredientes: list[RecetaIngredienteResponse]

    model_config = ConfigDict(from_attributes=True)
