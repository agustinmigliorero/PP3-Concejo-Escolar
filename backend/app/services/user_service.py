from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config.security import hash_password
from app.config.settings import settings
from app.models.school_model import School
from app.models.user_model import User
from app.schemas.user import UserCreate, UserUpdate


class UserServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def bootstrap_first_admin(db: Session) -> None:
    if not settings.FIRST_SUPERUSER_USERNAME or not settings.FIRST_SUPERUSER_PASSWORD:
        return
    count = db.execute(select(func.count()).select_from(User)).scalar_one()
    if count > 0:
        return
    user = User(
        username=settings.FIRST_SUPERUSER_USERNAME,
        role="admin",
        school_id=None,
        active=True,
        hashed_password=hash_password(settings.FIRST_SUPERUSER_PASSWORD),
    )
    db.add(user)
    db.commit()


def list_users(db: Session, *, skip: int = 0, limit: int = 100) -> list[User]:
    stmt = select(User).offset(skip).limit(min(limit, 500)).order_by(User.id)
    return list(db.execute(stmt).scalars().all())


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()


def create_user(db: Session, data: UserCreate) -> User:
    existing = db.execute(select(User).where(User.username == data.username)).scalar_one_or_none()
    if existing:
        raise UserServiceError("El nombre de usuario ya existe", status_code=409)

    if data.role == "escuela" and data.school_id is None:
        raise UserServiceError("El rol escuela requiere school_id", status_code=400)

    if data.school_id is not None:
        school = db.execute(select(School).where(School.id == data.school_id)).scalar_one_or_none()
        if not school:
            raise UserServiceError("La escuela no existe", status_code=400)

    user = User(
        username=data.username,
        role=data.role,
        school_id=data.school_id,
        active=data.active,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: int, data: UserUpdate) -> User:
    user = get_user_by_id(db, user_id)
    if not user:
        raise UserServiceError("Usuario no encontrado", status_code=404)

    patch = data.model_dump(exclude_unset=True)

    if "username" in patch:
        if patch["username"] != user.username:
            taken = db.execute(
                select(User).where(User.username == patch["username"])
            ).scalar_one_or_none()
            if taken:
                raise UserServiceError("El nombre de usuario ya existe", status_code=409)
        user.username = patch["username"]

    if "password" in patch:
        user.hashed_password = hash_password(patch["password"])

    if "role" in patch:
        user.role = patch["role"]
    if "school_id" in patch:
        user.school_id = patch["school_id"]
    if "active" in patch:
        user.active = patch["active"]

    merged_role = user.role
    merged_school_id = user.school_id
    if merged_role == "escuela" and merged_school_id is None:
        raise UserServiceError("El rol escuela requiere school_id", status_code=400)

    if merged_school_id is not None:
        school = db.execute(select(School).where(School.id == merged_school_id)).scalar_one_or_none()
        if not school:
            raise UserServiceError("La escuela no existe", status_code=400)

    db.commit()
    db.refresh(user)
    return user


def soft_delete_user(db: Session, user_id: int) -> None:
    user = get_user_by_id(db, user_id)
    if not user:
        raise UserServiceError("Usuario no encontrado", status_code=404)
    user.active = False
    db.commit()


def assert_can_view_user(actor: User, target_id: int) -> None:
    if actor.role in ("admin", "gestor"):
        return
    if actor.role == "escuela" and actor.id == target_id:
        return
    raise UserServiceError("No autorizado", status_code=403)
