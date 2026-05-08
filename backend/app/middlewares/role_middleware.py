from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from app.middlewares.auth_middleware import get_current_user
from app.models.user_model import User


def require_roles(*roles: str) -> Callable[..., User]:
    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permisos insuficientes",
            )
        return current_user

    return checker
