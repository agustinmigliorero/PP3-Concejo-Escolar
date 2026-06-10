from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.config.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.config.settings import settings
from app.models.refresh_token_model import RefreshToken
from app.models.user_model import User

_REFRESH_REUSE_GRACE_SECONDS = 10


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _get_active_user(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id, User.active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    return user


def login(db: Session, username: str, password: str) -> dict:
    user = db.query(User).filter(User.username == username, User.active == True).first()
    if not user or not verify_password(password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contrasena incorrectos",
        )

    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    refresh_token_str, jti, family = create_refresh_token(user.id)

    db_token = RefreshToken(
        user_id=user.id,
        jti=jti,
        token_family=family,
        expires_at=_now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(db_token)
    db.commit()

    return {"access_token": access_token, "refresh_token": refresh_token_str, "user": user}


def refresh_access_token(db: Session, refresh_token: str) -> dict:
    try:
        payload = decode_token(refresh_token)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido")

    try:
        jti: str = payload["jti"]
        user_id = int(payload["sub"])
        family: str = payload["family"]
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido")

    db_token = db.query(RefreshToken).filter(RefreshToken.jti == jti).first()
    if not db_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token no encontrado")

    if db_token.token_family != family or db_token.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido")

    if db_token.is_revoked:
        grace_result = _try_refresh_from_recent_rotation(db, db_token, user_id, family)
        if grace_result:
            return grace_result

        db.query(RefreshToken).filter(
            RefreshToken.token_family == family,
            RefreshToken.revoked_at == None,
        ).update({"revoked_at": _now()})
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesion comprometida, inicia sesion nuevamente",
        )

    if _is_expired(db_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")

    return _rotate_refresh_token(db, db_token, user_id, family)


def _try_refresh_from_recent_rotation(
    db: Session,
    db_token: RefreshToken,
    user_id: int,
    family: str,
) -> dict | None:
    if not db_token.replaced_by_jti or not db_token.revoked_at:
        return None

    revoked_at = _as_utc(db_token.revoked_at)
    if (_now() - revoked_at).total_seconds() > _REFRESH_REUSE_GRACE_SECONDS:
        return None

    replacement = (
        db.query(RefreshToken)
        .filter(RefreshToken.jti == db_token.replaced_by_jti)
        .first()
    )
    if (
        not replacement
        or replacement.is_revoked
        or replacement.token_family != family
        or replacement.user_id != user_id
        or _is_expired(replacement)
    ):
        return None

    # A concurrent refresh may still carry the just-replaced cookie. Do not
    # rotate again, because response ordering can overwrite the browser cookie
    # with a token that this request has already revoked.
    user = _get_active_user(db, user_id)
    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": access_token}


def _is_expired(db_token: RefreshToken) -> bool:
    return _as_utc(db_token.expires_at) < _now()


def _rotate_refresh_token(
    db: Session,
    db_token: RefreshToken,
    user_id: int,
    family: str,
) -> dict:
    user = _get_active_user(db, user_id)

    db_token.revoked_at = _now()

    new_access_token = create_access_token({"sub": str(user.id), "role": user.role})
    new_refresh_str, new_jti, _ = create_refresh_token(user.id, family)

    db_token.replaced_by_jti = new_jti

    new_db_token = RefreshToken(
        user_id=user.id,
        jti=new_jti,
        token_family=family,
        expires_at=_now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_db_token)
    db.commit()

    return {"access_token": new_access_token, "refresh_token": new_refresh_str}


def logout(db: Session, refresh_token: str) -> None:
    try:
        payload = decode_token(refresh_token)
        jti = payload.get("jti")
        db_token = db.query(RefreshToken).filter(RefreshToken.jti == jti).first()
        if db_token and not db_token.is_revoked:
            db_token.revoked_at = _now()
            db.commit()
    except JWTError:
        pass
