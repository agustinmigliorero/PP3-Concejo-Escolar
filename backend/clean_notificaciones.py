"""
Limpia la tabla de notificaciones (notifications).

Incluye avisos de stock cargado y cambios de matricula.
Esa misma tabla alimenta la pantalla /dashboard/historial.

Uso:
    docker compose exec backend python clean_notificaciones.py
    # o en local, desde backend/:
    python clean_notificaciones.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.config.database import SessionLocal
import app.models  # noqa: F401
from app.models.notification_model import Notification


def clean() -> None:
    db = SessionLocal()
    try:
        deleted = db.query(Notification).delete(synchronize_session=False)
        db.commit()
        print(f"[clean:notificaciones] Eliminadas {deleted} fila(s) de notifications.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    clean()
