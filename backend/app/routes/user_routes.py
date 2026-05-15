from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.user_controller import CreateUserRequest, UpdateUserRequest, UserResponse
from app.middlewares.auth_middleware import require_admin
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserResponse, status_code=201)
def create_user(
    body: CreateUserRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return user_service.create_user(db, body.username, body.password, body.role, body.school_id)


@router.get("", response_model=list[UserResponse])
def list_users(db: Session = Depends(get_db), _=Depends(require_admin)):
    return user_service.get_all_users(db)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    return user_service.get_user_by_id(db, user_id)


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    body: UpdateUserRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return user_service.update_user(
        db, user_id, body.username, body.password, body.role, body.school_id
    )


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    user_service.delete_user(db, user_id)


@router.patch("/{user_id}/toggle-active", response_model=UserResponse)
def toggle_active(user_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    return user_service.toggle_active(db, user_id)
