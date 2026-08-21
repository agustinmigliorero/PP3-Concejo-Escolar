import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.controllers.tipo_comida_controller import TipoComidaResponse

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_phone(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v = v.strip()
    if not v:
        return None
    if len(v) < 6:
        raise ValueError("El teléfono debe tener al menos 6 caracteres")
    return v


def _normalize_email(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v = v.strip()
    if not v:
        return None
    if not _EMAIL_RE.match(v):
        raise ValueError("El email no tiene un formato válido")
    return v


class MatriculaPorTipoRequest(BaseModel):
    tipo_comida_id: int
    cantidad: int = Field(..., ge=0)

    @field_validator("tipo_comida_id")
    @classmethod
    def tipo_comida_valid(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Tipo de comida inválido")
        return v


class MatriculaPorTipoResponse(BaseModel):
    tipo_comida_id: int
    tipo_comida_nombre: str
    cantidad: int


def _validate_matriculas_por_tipo(
    value: list[MatriculaPorTipoRequest] | None,
) -> list[MatriculaPorTipoRequest] | None:
    if value is None:
        return value
    ids = [item.tipo_comida_id for item in value]
    if len(ids) != len(set(ids)):
        raise ValueError("No se puede repetir la matrícula de un tipo de comida")
    return value


class CreateSchoolRequest(BaseModel):
    name: str
    code: str
    locality_id: int
    address: str
    phone: Optional[str] = None
    email: Optional[str] = None
    matriculation: int = 0
    tipos_comida_ids: list[int] = []
    matriculas_por_tipo: list[MatriculaPorTipoRequest] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def name_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("El nombre debe tener al menos 2 caracteres")
        return v

    @field_validator("code")
    @classmethod
    def code_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 1:
            raise ValueError("El código no puede estar vacío")
        return v

    @field_validator("matriculation")
    @classmethod
    def matriculation_valid(cls, v: int) -> int:
        if v < 0:
            raise ValueError("La matrícula no puede ser negativa")
        return v

    @field_validator("address")
    @classmethod
    def address_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("La dirección debe tener al menos 3 caracteres")
        return v

    @field_validator("phone")
    @classmethod
    def phone_valid(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_phone(v)

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_email(v)

    @field_validator("tipos_comida_ids")
    @classmethod
    def tipos_valid(cls, v: list[int]) -> list[int]:
        if any(tipo_id <= 0 for tipo_id in v):
            raise ValueError("Tipo de comida inválido")
        if len(v) != len(set(v)):
            raise ValueError("No se puede repetir un tipo de comida")
        return v

    @field_validator("matriculas_por_tipo")
    @classmethod
    def matriculas_valid(
        cls,
        v: list[MatriculaPorTipoRequest],
    ) -> list[MatriculaPorTipoRequest]:
        return _validate_matriculas_por_tipo(v) or []


class UpdateSchoolRequest(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    locality_id: Optional[int] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    matriculation: Optional[int] = None
    tipos_comida_ids: Optional[list[int]] = None
    matriculas_por_tipo: Optional[list[MatriculaPorTipoRequest]] = None
    active: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def name_valid(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if len(v) < 2:
                raise ValueError("El nombre debe tener al menos 2 caracteres")
        return v

    @field_validator("code")
    @classmethod
    def code_valid(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if len(v) < 1:
                raise ValueError("El código no puede estar vacío")
        return v

    @field_validator("matriculation")
    @classmethod
    def matriculation_valid(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("La matrícula no puede ser negativa")
        return v

    @field_validator("address")
    @classmethod
    def address_valid(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if len(v) < 3:
                raise ValueError("La dirección debe tener al menos 3 caracteres")
        return v

    @field_validator("phone")
    @classmethod
    def phone_valid(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_phone(v)

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_email(v)

    @field_validator("tipos_comida_ids")
    @classmethod
    def tipos_valid(cls, v: Optional[list[int]]) -> Optional[list[int]]:
        if v is None:
            return v
        if any(tipo_id <= 0 for tipo_id in v):
            raise ValueError("Tipo de comida inválido")
        if len(v) != len(set(v)):
            raise ValueError("No se puede repetir un tipo de comida")
        return v

    @field_validator("matriculas_por_tipo")
    @classmethod
    def matriculas_valid(
        cls,
        v: Optional[list[MatriculaPorTipoRequest]],
    ) -> Optional[list[MatriculaPorTipoRequest]]:
        return _validate_matriculas_por_tipo(v)


class UpdateMySchoolMatriculationRequest(BaseModel):
    # Se mantiene matriculation para compatibilidad con clientes existentes.
    matriculation: Optional[int] = Field(default=None, ge=0)
    matriculas_por_tipo: Optional[list[MatriculaPorTipoRequest]] = None

    @field_validator("matriculas_por_tipo")
    @classmethod
    def matriculas_valid(
        cls,
        v: Optional[list[MatriculaPorTipoRequest]],
    ) -> Optional[list[MatriculaPorTipoRequest]]:
        return _validate_matriculas_por_tipo(v)

    @model_validator(mode="after")
    def at_least_one_value(self):
        if self.matriculation is None and self.matriculas_por_tipo is None:
            raise ValueError("Debe informar la matrícula general o la matrícula por servicio")
        return self


class UpdateMySchoolContactRequest(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def phone_valid(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_phone(v)

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_email(v)


class SchoolResponse(BaseModel):
    id: int
    name: str
    code: str
    locality_id: int
    locality_name: str = ""
    address: str
    phone: Optional[str] = None
    email: Optional[str] = None
    matriculation: int
    matriculas_por_tipo: list[MatriculaPorTipoResponse] = []
    tipos_comida: list[TipoComidaResponse] = []
    active: bool

    model_config = {"from_attributes": True}
