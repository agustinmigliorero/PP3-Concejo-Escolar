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
            detail="Usuario o contraseña incorrectos",
        )

    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    refresh_token_str, jti, family = create_refresh_token(user.id)

    db_token = RefreshToken(
        user_id=user.id,
        jti=jti,
        token_family=family,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(db_token)
    db.commit()

    return {"access_token": access_token, "refresh_token": refresh_token_str, "user": user}


def refresh_access_token(db: Session, refresh_token: str) -> dict:
    try:
        payload = decode_token(refresh_token)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    jti: str = payload["jti"]
    user_id: int = int(payload["sub"])
    family: str = payload["family"]

    db_token = db.query(RefreshToken).filter(RefreshToken.jti == jti).first()
    if not db_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token no encontrado")

    if db_token.is_revoked:
        # Token reuse detected — revoke whole family
        db.query(RefreshToken).filter(
            RefreshToken.token_family == family,
            RefreshToken.revoked_at == None,
        ).update({"revoked_at": datetime.now(timezone.utc)})
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión comprometida, iniciá sesión nuevamente")

    if db_token.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")

    user = _get_active_user(db, user_id)

    # Rotate: revoke old, issue new
    db_token.revoked_at = datetime.now(timezone.utc)

    new_access_token = create_access_token({"sub": str(user.id), "role": user.role})
    new_refresh_str, new_jti, _ = create_refresh_token(user.id, family)

    db_token.replaced_by_jti = new_jti

    new_db_token = RefreshToken(
        user_id=user.id,
        jti=new_jti,
        token_family=family,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
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
            db_token.revoked_at = datetime.now(timezone.utc)
            db.commit()
    except JWTError:
        pass
