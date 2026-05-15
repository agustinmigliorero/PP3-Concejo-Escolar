from typing import Optional

from pydantic import BaseModel, field_validator

from app.models.user_model import UserRole


class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: UserRole
    school_id: Optional[int] = None

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("El nombre de usuario debe tener al menos 3 caracteres")
        return v

    @field_validator("password")
    @classmethod
    def password_valid(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("La contraseña debe tener al menos 6 caracteres")
        return v


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    school_id: Optional[int]
    active: bool

    model_config = {"from_attributes": True}
