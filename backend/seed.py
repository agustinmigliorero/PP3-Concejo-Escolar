"""
Script de inicialización: crea el usuario admin por defecto.

Uso:
    docker compose exec backend python seed.py
    # o en local:
    python seed.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.config.database import Base, SessionLocal, engine
import app.models.school_model  # noqa: F401
import app.models.user_model  # noqa: F401
import app.models.refresh_token_model  # noqa: F401
from app.models.user_model import User, UserRole
from app.config.security import hash_password

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin1234")


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).filter(User.username == ADMIN_USERNAME).first():
            print(f"[seed] El usuario '{ADMIN_USERNAME}' ya existe. Sin cambios.")
            return

        admin = User(
            username=ADMIN_USERNAME,
            password=hash_password(ADMIN_PASSWORD),
            role=UserRole.admin,
            active=True,
        )
        db.add(admin)
        db.commit()
        print(f"[seed] Admin creado — usuario: '{ADMIN_USERNAME}' | contraseña: '{ADMIN_PASSWORD}'")
        print("[seed] Cambiá la contraseña en producción.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
