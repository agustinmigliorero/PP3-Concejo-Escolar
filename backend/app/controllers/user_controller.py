from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user_model import User
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.services import user_service


def list_users_controller(db: Session) -> list[UserOut]:
    users = user_service.list_users(db)
    return [UserOut.model_validate(u) for u in users]


def get_user_controller(db: Session, user_id: int, actor: User) -> UserOut:
    try:
        user_service.assert_can_view_user(actor, user_id)
    except user_service.UserServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    user = user_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return UserOut.model_validate(user)


def create_user_controller(db: Session, data: UserCreate) -> UserOut:
    try:
        user = user_service.create_user(db, data)
        return UserOut.model_validate(user)
    except user_service.UserServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


def update_user_controller(db: Session, user_id: int, data: UserUpdate) -> UserOut:
    try:
        user = user_service.update_user(db, user_id, data)
        return UserOut.model_validate(user)
    except user_service.UserServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


def delete_user_controller(db: Session, user_id: int) -> dict:
    try:
        user_service.soft_delete_user(db, user_id)
        return {"message": "Usuario desactivado"}
    except user_service.UserServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
