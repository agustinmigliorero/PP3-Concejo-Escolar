from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.auth_controller import LoginRequest, LoginResponse, RefreshResponse, UserInfo
from app.middlewares.auth_middleware import get_current_user
from app.models.user_model import User
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

_COOKIE_MAX_AGE = 7 * 24 * 60 * 60  # 7 days in seconds


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=_COOKIE_MAX_AGE,
        path="/auth/refresh",
    )


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    result = auth_service.login(db, body.username, body.password)
    _set_refresh_cookie(response, result["refresh_token"])
    return LoginResponse(
        access_token=result["access_token"],
        user=UserInfo.model_validate(result["user"]),
    )


@router.post("/refresh", response_model=RefreshResponse)
def refresh(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No hay sesión activa")
    result = auth_service.refresh_access_token(db, refresh_token)
    _set_refresh_cookie(response, result["refresh_token"])
    return RefreshResponse(access_token=result["access_token"])


@router.post("/logout")
def logout(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
):
    if refresh_token:
        auth_service.logout(db, refresh_token)
    response.delete_cookie("refresh_token", path="/auth/refresh")
    return {"message": "Sesión cerrada correctamente"}


@router.get("/me", response_model=UserInfo)
def me(current_user: User = Depends(get_current_user)):
    return current_user
