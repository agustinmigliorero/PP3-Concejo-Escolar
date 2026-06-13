from pydantic import BaseModel, ConfigDict, Field, field_validator


class CreateTipoComidaRequest(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=50)

    @field_validator("nombre")
    @classmethod
    def strip_nombre(cls, v: str) -> str:
        return v.strip()


class UpdateTipoComidaRequest(CreateTipoComidaRequest):
    pass


class TipoComidaResponse(BaseModel):
    id: int
    nombre: str
    activo: bool

    model_config = ConfigDict(from_attributes=True)
