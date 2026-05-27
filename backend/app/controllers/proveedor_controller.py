from pydantic import BaseModel, Field, field_validator


class CreateProveedorRequest(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=150)
    contacto: str = Field(..., min_length=2, max_length=300)

    @field_validator("nombre", "contacto")
    @classmethod
    def strip_strings(cls, v: str) -> str:
        return v.strip()


class UpdateProveedorRequest(CreateProveedorRequest):
    pass


class ProveedorResponse(BaseModel):
    id: int
    nombre: str
    contacto: str
    activo: bool

    model_config = {"from_attributes": True}
