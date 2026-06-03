from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config.security import hash_password
from app.controllers.user_controller import UpdateUserRequest
from app.models.school_model import School
from app.models.user_model import User, UserRole


def _normalize_school_assignment(
    db: Session,
    role: UserRole,
    school_id: int | None,
    user_id: int | None = None,
) -> int | None:
    if role != UserRole.escuela:
        return None

    if school_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los usuarios con rol escuela deben tener una escuela asociada",
        )

    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La escuela asociada no existe",
        )
    if not school.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede asociar un usuario a una escuela inactiva",
        )

    query = db.query(User).filter(
        User.role == UserRole.escuela,
        User.school_id == school_id,
    )
    if user_id is not None:
        query = query.filter(User.id != user_id)
    if query.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario escuela asociado a esa escuela",
        )

    return school_id


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
    normalized_school_id = _normalize_school_assignment(db, role, school_id)
    user = User(
        username=username,
        password=hash_password(password),
        role=role,
        school_id=normalized_school_id,
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


def update_user(
    db: Session,
    user_id: int,
    data: UpdateUserRequest,
) -> User:
    user = get_user_by_id(db, user_id)
    update_data = data.model_dump(exclude_unset=True)

    username = update_data.get("username")
    if username and username != user.username:
        if db.query(User).filter(User.username == username, User.id != user_id).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El nombre de usuario ya existe")
        user.username = username

    password = update_data.get("password")
    if password:
        user.password = hash_password(password)

    next_role = update_data.get("role", user.role)
    next_school_id = update_data.get("school_id", user.school_id)
    user.role = next_role
    user.school_id = _normalize_school_assignment(
        db,
        next_role,
        next_school_id,
        user_id=user.id,
    )

    db.commit()
    db.refresh(user)
    return user


def toggle_active(db: Session, user_id: int) -> User:
    user = get_user_by_id(db, user_id)
    user.active = not user.active
    db.commit()
    db.refresh(user)
    return user
