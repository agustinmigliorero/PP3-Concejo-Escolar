from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import settings
from app.models.user_model import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_PREFIX}/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autorizado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError:
        raise credentials_exception

    if payload.get("type") != "access":
        raise credentials_exception

    sub = payload.get("sub")
    if sub is None:
        raise credentials_exception

    user = db.execute(
        select(User).where(User.id == int(sub), User.active.is_(True))
    ).scalar_one_or_none()
    if not user:
        raise credentials_exception

    return user
