from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

UserRole = Literal["admin", "gestor", "escuela"]


class UserBase(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    role: UserRole = "escuela"
    school_id: int | None = None
    active: bool = True


class UserCreate(UserBase):
    password: str = Field(min_length=1, max_length=255)


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=1, max_length=255)
    password: str | None = Field(default=None, min_length=1, max_length=255)
    role: UserRole | None = None
    school_id: int | None = None
    active: bool | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: str
    school_id: int | None
    active: bool
    created_at: datetime | None = None
