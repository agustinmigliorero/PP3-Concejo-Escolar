from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.stock_previo_controller import (
    StockPrevioSchoolResponse,
    UpdateStockPrevioRequest,
)
from app.middlewares.auth_middleware import get_current_user, require_gestor_or_admin
from app.models.user_model import User
from app.services import stock_previo_service

router = APIRouter(prefix="/stock-previo", tags=["stock-previo"])


@router.get("/me", response_model=StockPrevioSchoolResponse)
def get_my_stock(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return stock_previo_service.get_my_stock(db, current_user)


@router.put("/me", response_model=StockPrevioSchoolResponse)
def update_my_stock(
    body: UpdateStockPrevioRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return stock_previo_service.update_my_stock(db, body, current_user)


@router.get("/{school_id}", response_model=StockPrevioSchoolResponse)
def get_school_stock(
    school_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    return stock_previo_service.get_school_stock(db, school_id)


@router.put("/{school_id}", response_model=StockPrevioSchoolResponse)
def update_school_stock(
    school_id: int,
    body: UpdateStockPrevioRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gestor_or_admin),
):
    return stock_previo_service.update_school_stock(db, school_id, body, current_user)
