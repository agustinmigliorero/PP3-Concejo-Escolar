from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.services import auth_service


def login_controller(db: Session, username: str, password: str) -> dict:
    try:
        return auth_service.login(db, username, password)
    except auth_service.AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


def refresh_controller(db: Session, refresh_token: str) -> dict:
    try:
        return auth_service.refresh(db, refresh_token)
    except auth_service.AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


def logout_controller(db: Session, refresh_token: str) -> dict:
    auth_service.logout(db, refresh_token)
    return {"message": "Sesion cerrada"}
