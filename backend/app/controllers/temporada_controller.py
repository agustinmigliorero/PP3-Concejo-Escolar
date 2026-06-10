from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.temporada_model import NombreTemporada


class OpcionMenuUpdateItem(BaseModel):
    numero_opcion: int = Field(..., ge=1, le=2)
    descripcion: Optional[str] = Field(None, max_length=255)

    @field_validator("descripcion")
    @classmethod
    def strip_descripcion(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        stripped = value.strip()
        return stripped or None


class CreateTemporadaRequest(BaseModel):
    nombre: NombreTemporada
    anio: int = Field(..., ge=2000, le=2100)
    activo: bool = False


class UpdateTemporadaRequest(CreateTemporadaRequest):
    pass


class UpdateTemporadaOpcionesRequest(BaseModel):
    opciones: list[OpcionMenuUpdateItem]

    @model_validator(mode="after")
    def validate_options(self):
        numeros = sorted(opcion.numero_opcion for opcion in self.opciones)
        if numeros != [1, 2]:
            raise ValueError("Se deben informar exactamente las opciones 1 y 2")
        return self


class OpcionMenuResponse(BaseModel):
    id: int
    numero_opcion: int
    descripcion: Optional[str]

    model_config = ConfigDict(from_attributes=True)


class TemporadaResponse(BaseModel):
    id: int
    nombre: NombreTemporada
    anio: int
    activo: bool
    opciones_menu: list[OpcionMenuResponse]

    model_config = ConfigDict(from_attributes=True)
