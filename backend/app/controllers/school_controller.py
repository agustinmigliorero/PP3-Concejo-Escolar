from typing import Optional

from pydantic import BaseModel, field_validator


class CreateSchoolRequest(BaseModel):
    name: str
    code: str
    locality_id: int
    matriculation: int = 0
    offers_breakfast: bool = False
    offers_lunch: bool = False
    offers_snack: bool = False

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


class UpdateSchoolRequest(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    locality_id: Optional[int] = None
    matriculation: Optional[int] = None
    offers_breakfast: Optional[bool] = None
    offers_lunch: Optional[bool] = None
    offers_snack: Optional[bool] = None
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


class SchoolResponse(BaseModel):
    id: int
    name: str
    code: str
    locality_id: int
    locality_name: str = ""
    matriculation: int
    offers_breakfast: bool
    offers_lunch: bool
    offers_snack: bool
    active: bool

    model_config = {"from_attributes": True}
