"""
Seed del usuario admin inicial.

Uso:
    docker compose exec backend python seed.py
    # o en local, desde backend/:
    python seed.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.config.database import Base, SessionLocal, engine
from app.config.security import hash_password
import app.models  # noqa: F401
from app.models.user_model import User, UserRole


ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin1234")


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).filter(User.username == ADMIN_USERNAME).first():
            print(f"[seed:admin] El usuario '{ADMIN_USERNAME}' ya existe. Sin cambios.")
            return

        admin = User(
            username=ADMIN_USERNAME,
            password=hash_password(ADMIN_PASSWORD),
            role=UserRole.admin,
            active=True,
        )
        db.add(admin)
        db.commit()
        print(f"[seed:admin] Admin creado: usuario='{ADMIN_USERNAME}' password='{ADMIN_PASSWORD}'")
        print("[seed:admin] Cambia la contrasena en produccion.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
