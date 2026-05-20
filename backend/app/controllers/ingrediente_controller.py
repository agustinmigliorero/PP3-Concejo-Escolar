from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CreateIngredienteRequest(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)
    unidad_medida: str = Field(..., min_length=1, max_length=50)
    contenido_por_unidad: Optional[Decimal] = Field(None, ge=0)
    unidad_contenido: Optional[str] = Field(None, max_length=50)
    indice_correccion: Decimal = Field(default=Decimal("1.0"), ge=0.01)

    @field_validator("nombre", "unidad_medida", "unidad_contenido")
    @classmethod
    def strip_strings(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return v.strip()
        return v

    @field_validator("contenido_por_unidad")
    @classmethod
    def validate_contenido(cls, v: Optional[Decimal], info) -> Optional[Decimal]:
        unidad_medida = info.data.get("unidad_medida")
        if unidad_medida and unidad_medida.lower() == "unidades" and v is None:
            raise ValueError("contenido_por_unidad es requerido cuando unidad_medida es 'unidades'")
        return v


class UpdateIngredienteRequest(CreateIngredienteRequest):
    pass


class IngredienteResponse(BaseModel):
    id: int
    nombre: str
    unidad_medida: str
    contenido_por_unidad: Optional[Decimal]
    unidad_contenido: Optional[str]
    indice_correccion: Decimal
    activo: bool

    model_config = ConfigDict(from_attributes=True)
