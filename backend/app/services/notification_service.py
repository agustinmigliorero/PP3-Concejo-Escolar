import json
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.controllers.notification_controller import (
    NotificationResponse,
    UnreadCountResponse,
)
from app.models.notification_model import Notification
from app.models.school_model import School
from app.models.user_model import User, UserRole

RETENTION_DAYS = 30


def _cleanup_old_read(db: Session) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    db.query(Notification).filter(
        Notification.read_at.isnot(None),
        Notification.read_at < cutoff,
    ).delete(synchronize_session=False)
    db.commit()


def create_stock_notification(
    db: Session,
    escuela: School,
    cargado_por: User,
    items: list[dict] | None = None,
) -> None:
    message = f"La escuela {escuela.name} cargó stock sobrante"
    details = json.dumps(items) if items else None
    admin_gestor = (
        db.query(User)
        .filter(
            User.active == True,
            User.role.in_([UserRole.admin, UserRole.gestor]),
        )
        .all()
    )

    for target_user in admin_gestor:
        notif = Notification(
            user_id=target_user.id,
            type="stock_cargado",
            message=message,
            escuela_id=escuela.id,
            escuela_nombre=escuela.name,
            cargado_por_username=cargado_por.username,
            details=details,
        )
        db.add(notif)

    db.commit()


def create_matriculation_notification(
    db: Session,
    escuela: School,
    modificado_por: User,
    old_matriculation: int | None = None,
) -> None:
    message = f"La escuela {escuela.name} actualizó su matrícula a {escuela.matriculation}"
    details = json.dumps({
        "old_value": old_matriculation,
        "new_value": escuela.matriculation,
    })
    admin_gestor = (
        db.query(User)
        .filter(
            User.active == True,
            User.role.in_([UserRole.admin, UserRole.gestor]),
        )
        .all()
    )

    for target_user in admin_gestor:
        notif = Notification(
            user_id=target_user.id,
            type="matricula_actualizada",
            message=message,
            escuela_id=escuela.id,
            escuela_nombre=escuela.name,
            cargado_por_username=modificado_por.username,
            details=details,
        )
        db.add(notif)

    db.commit()


def get_notifications(db: Session, user: User, limit: int = 20) -> list[NotificationResponse]:
    _cleanup_old_read(db)
    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    return [NotificationResponse.model_validate(n) for n in notifs]


def get_unread_count(db: Session, user: User) -> UnreadCountResponse:
    count = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read == False)
        .count()
    )
    return UnreadCountResponse(count=count)


def mark_as_read(db: Session, notification_id: int, user: User) -> NotificationResponse | None:
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user.id)
        .first()
    )
    if notif is None:
        return None
    notif.read = True
    notif.read_at = datetime.now(timezone.utc)
    db.commit()
    _cleanup_old_read(db)
    db.refresh(notif)
    return NotificationResponse.model_validate(notif)
