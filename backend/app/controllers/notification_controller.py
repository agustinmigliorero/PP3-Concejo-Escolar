import json
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class NotificationResponse(BaseModel):
    id: int
    type: str
    message: str
    escuela_id: int | None = None
    escuela_nombre: str | None = None
    cargado_por_username: str | None = None
    details: list | dict | None = None
    read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator("details", mode="before")
    @classmethod
    def parse_details(cls, value: str | list | dict | None) -> list | dict | None:
        if isinstance(value, str) and value:
            return json.loads(value)
        return value


class UnreadCountResponse(BaseModel):
    count: int
