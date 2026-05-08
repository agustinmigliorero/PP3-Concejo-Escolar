from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers import user_controller
from app.middlewares.auth_middleware import get_current_user
from app.middlewares.role_middleware import require_roles
from app.models.user_model import User
from app.schemas.user import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["Usuarios"])


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _actor: User = Depends(require_roles("admin", "gestor")),
):
    return user_controller.list_users_controller(db)


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return user_controller.get_user_controller(db, user_id, actor)


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_roles("admin")),
):
    return user_controller.create_user_controller(db, payload)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_roles("admin")),
):
    return user_controller.update_user_controller(db, user_id, payload)


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_roles("admin")),
):
    return user_controller.delete_user_controller(db, user_id)
