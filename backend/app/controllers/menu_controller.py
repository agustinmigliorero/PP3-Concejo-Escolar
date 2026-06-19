from pydantic import BaseModel, Field, model_validator


class DiaMenuItemRequest(BaseModel):
    opcion_menu_id: int = Field(..., gt=0)
    dia_semana: int = Field(..., ge=1, le=5)
    tipo_comida_id: int = Field(..., gt=0)
    receta_id: int = Field(..., gt=0)


class UpdateTemporadaMenuRequest(BaseModel):
    items: list[DiaMenuItemRequest]

    @model_validator(mode="after")
    def validate_unique_slots(self):
        slots = [
            (item.opcion_menu_id, item.dia_semana, item.tipo_comida_id)
            for item in self.items
        ]
        if len(slots) != len(set(slots)):
            raise ValueError("No se puede repetir opcion, dia y tipo de comida")
        return self


class DiaMenuResponse(BaseModel):
    id: int
    opcion_menu_id: int
    dia_semana: int
    tipo_comida_id: int
    tipo_comida_nombre: str
    receta_id: int
    receta_nombre: str


class OpcionMenuWithDiasResponse(BaseModel):
    id: int
    numero_opcion: int
    descripcion: str | None
    dias_menu: list[DiaMenuResponse]


class TemporadaMenuResponse(BaseModel):
    temporada_id: int
    opciones: list[OpcionMenuWithDiasResponse]
