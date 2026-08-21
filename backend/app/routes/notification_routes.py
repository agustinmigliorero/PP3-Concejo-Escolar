from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.notification_controller import (
    NotificationResponse,
    UnreadCountResponse,
)
from app.middlewares.auth_middleware import get_current_user, require_gestor_or_admin
from app.models.user_model import User
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gestor_or_admin),
):
    return notification_service.get_notifications(db, current_user)


@router.get("/unread-count", response_model=UnreadCountResponse)
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gestor_or_admin),
):
    return notification_service.get_unread_count(db, current_user)


@router.put("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gestor_or_admin),
):
    notif = notification_service.mark_as_read(db, notification_id, current_user)
    if notif is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notificacion no encontrada",
        )
    return notif
