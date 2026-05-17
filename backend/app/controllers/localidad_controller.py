from pydantic import BaseModel, field_validator


class CreateLocalidadRequest(BaseModel):
    nombre: str

    @field_validator("nombre")
    @classmethod
    def nombre_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("El nombre debe tener al menos 2 caracteres")
        return v


class UpdateLocalidadRequest(BaseModel):
    nombre: str

    @field_validator("nombre")
    @classmethod
    def nombre_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("El nombre debe tener al menos 2 caracteres")
        return v


class LocalidadResponse(BaseModel):
    id: int
    nombre: str
    activo: bool

    model_config = {"from_attributes": True}
