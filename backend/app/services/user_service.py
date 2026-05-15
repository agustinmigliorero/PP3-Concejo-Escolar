from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config.security import hash_password
from app.models.user_model import User, UserRole


def create_user(
    db: Session,
    username: str,
    password: str,
    role: UserRole,
    school_id: int | None = None,
) -> User:
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El nombre de usuario ya existe",
        )
    user = User(
        username=username,
        password=hash_password(password),
        role=role,
        school_id=school_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_all_users(db: Session) -> list[User]:
    return db.query(User).all()


def get_user_by_id(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return user


def toggle_active(db: Session, user_id: int) -> User:
    user = get_user_by_id(db, user_id)
    user.active = not user.active
    db.commit()
    db.refresh(user)
    return user
