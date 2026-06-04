from time import monotonic
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import settings
from app.controllers.auth_controller import LoginRequest, LoginResponse, RefreshResponse, UserInfo
from app.middlewares.auth_middleware import get_current_user
from app.models.user_model import User
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

_COOKIE_MAX_AGE = 7 * 24 * 60 * 60  # 7 days in seconds
_LOGIN_WINDOW_SECONDS = 15 * 60
_LOGIN_MAX_FAILURES = 5
_login_attempts: dict[str, list[float]] = {}


def _login_attempt_key(request: Request, username: str) -> str:
    client_host = request.client.host if request.client else "unknown"
    return f"{client_host}:{username.strip().lower()}"


def _prune_attempts(key: str, now: float) -> list[float]:
    attempts = [
        attempt
        for attempt in _login_attempts.get(key, [])
        if now - attempt < _LOGIN_WINDOW_SECONDS
    ]
    if attempts:
        _login_attempts[key] = attempts
    else:
        _login_attempts.pop(key, None)
    return attempts


def _enforce_login_rate_limit(request: Request, username: str) -> str:
    key = _login_attempt_key(request, username)
    attempts = _prune_attempts(key, monotonic())
    if len(attempts) >= _LOGIN_MAX_FAILURES:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos fallidos. Espera unos minutos e intenta nuevamente.",
        )
    return key


def _record_failed_login(key: str) -> None:
    now = monotonic()
    attempts = _prune_attempts(key, now)
    attempts.append(now)
    _login_attempts[key] = attempts


def _clear_login_attempts(key: str) -> None:
    _login_attempts.pop(key, None)


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.REFRESH_COOKIE_SECURE,
        max_age=_COOKIE_MAX_AGE,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie("refresh_token", path="/")


def _refresh_unauthorized(detail: object) -> JSONResponse:
    response = JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": detail})
    _clear_refresh_cookie(response)
    return response


@router.post("/login", response_model=LoginResponse)
def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    attempt_key = _enforce_login_rate_limit(request, body.username)
    try:
        result = auth_service.login(db, body.username, body.password)
    except HTTPException:
        _record_failed_login(attempt_key)
        raise

    _clear_login_attempts(attempt_key)
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
        return _refresh_unauthorized("No hay sesion activa")

    try:
        result = auth_service.refresh_access_token(db, refresh_token)
    except HTTPException as exc:
        return _refresh_unauthorized(exc.detail)

    if result.get("refresh_token"):
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
    _clear_refresh_cookie(response)
    return {"message": "Sesion cerrada correctamente"}


@router.get("/me", response_model=UserInfo)
def me(current_user: User = Depends(get_current_user)):
    return current_user
