from datetime import datetime, timezone
import uuid

from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.security import (
    create_access_token,
    create_refresh_token,
    hash_token,
    verify_password,
)
from app.config.settings import settings
from app.models.refresh_token_model import RefreshToken
from app.models.user_model import User


class AuthError(Exception):
    pass


def _utc_naive_from_ts(ts: int) -> datetime:
    return datetime.fromtimestamp(ts, tz=timezone.utc).replace(tzinfo=None)


def _utc_naive_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def login(db: Session, username: str, password: str) -> dict:
    user = db.execute(
        select(User).where(User.username == username, User.active.is_(True))
    ).scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        raise AuthError("Credenciales invalidas")

    access_token = create_access_token(str(user.id))
    refresh_token, refresh_jti = create_refresh_token(str(user.id))
    token_family = str(uuid.uuid4())

    decoded = jwt.decode(
        refresh_token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )

    db_token = RefreshToken(
        user_id=user.id,
        jti=refresh_jti,
        token_hash=hash_token(refresh_token),
        token_family=token_family,
        expires_at=_utc_naive_from_ts(int(decoded["exp"])),
    )
    db.add(db_token)
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


def refresh(db: Session, refresh_token: str) -> dict:
    try:
        payload = jwt.decode(
            refresh_token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError as exc:
        raise AuthError("Refresh token invalido") from exc

    if payload.get("type") != "refresh":
        raise AuthError("Tipo de token invalido")

    user_id = int(payload["sub"])
    jti = payload["jti"]

    db_token = db.execute(select(RefreshToken).where(RefreshToken.jti == jti)).scalar_one_or_none()
    if not db_token:
        raise AuthError("Refresh token no reconocido")
    if db_token.revoked_at is not None:
        raise AuthError("Refresh token revocado")
    if db_token.token_hash != hash_token(refresh_token):
        raise AuthError("Refresh token alterado")
    if db_token.expires_at < _utc_naive_now():
        raise AuthError("Refresh token expirado")

    user = db.execute(
        select(User).where(User.id == user_id, User.active.is_(True))
    ).scalar_one_or_none()
    if not user:
        raise AuthError("Usuario invalido o inactivo")

    new_access = create_access_token(str(user.id))
    new_refresh, new_jti = create_refresh_token(str(user.id))

    new_payload = jwt.decode(
        new_refresh,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )

    db_token.revoked_at = _utc_naive_now()
    db_token.replaced_by_jti = new_jti

    new_db_token = RefreshToken(
        user_id=user.id,
        jti=new_jti,
        token_hash=hash_token(new_refresh),
        token_family=db_token.token_family,
        expires_at=_utc_naive_from_ts(int(new_payload["exp"])),
    )
    db.add(new_db_token)
    db.commit()

    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
    }


def logout(db: Session, refresh_token: str) -> None:
    try:
        payload = jwt.decode(
            refresh_token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError:
        return

    if payload.get("type") != "refresh":
        return

    jti = payload.get("jti")
    if not jti:
        return

    db_token = db.execute(select(RefreshToken).where(RefreshToken.jti == jti)).scalar_one_or_none()
    if db_token and db_token.revoked_at is None:
        db_token.revoked_at = _utc_naive_now()
        db.commit()
