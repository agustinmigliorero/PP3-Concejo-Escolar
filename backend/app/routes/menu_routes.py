from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.menu_controller import TemporadaMenuResponse, UpdateTemporadaMenuRequest
from app.middlewares.auth_middleware import require_admin
from app.services import menu_service

router = APIRouter(prefix="/temporadas", tags=["menu"])


@router.get("/{temporada_id}/menu", response_model=TemporadaMenuResponse)
def get_temporada_menu(
    temporada_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return menu_service.get_temporada_menu(db, temporada_id)


@router.put("/{temporada_id}/menu", response_model=TemporadaMenuResponse)
def update_temporada_menu(
    temporada_id: int,
    body: UpdateTemporadaMenuRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return menu_service.update_temporada_menu(db, temporada_id, body)
