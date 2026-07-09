"""
Seed de stock sobrante para testing del historial de modificaciones.

Uso:
    docker compose exec backend python seed_dataStockSob.py
    # o en local, desde backend/:
    python seed_dataStockSob.py

Requiere haber ejecutado seed.py y seed_data.py primero (escuelas, ingredientes,
usuarios y demas datos base).
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from decimal import Decimal

sys.path.insert(0, os.path.dirname(__file__))

import json

from sqlalchemy import text

from app.config.database import Base, SessionLocal, engine
from app.config.security import hash_password
import app.models  # noqa: F401
from app.models.ingrediente_model import Ingrediente
from app.models.notification_model import Notification
from app.models.school_model import School
from app.models.stock_previo_model import StockPrevio
from app.models.user_model import User, UserRole

# Stock de prueba por ingrediente (nombre -> cantidad)
STOCK_VALUES: dict[str, str] = {
    "MANZANA": "25",
    "BANANA": "18",
    "NARANJA O MANDARINA": "30",
    "PERA": "0",
    "Zapallo ANCO": "12.5",
    "Zapallo verde": "0",
    "Papa": "40",
    "Cebolla": "15",
    "Zanahoria": "20",
    "Tomate": "8",
    "Ajo": "0.5",
    "Perejil": "0.2",
    "Huevo de gallina x doc": "3",
    "Leche fluida x litro": "10",
    "Azucar kg": "5",
    "Te en saquito x 25 u": "4",
    "Cacao en polvo x 360 g": "2",
    "Dulce de leche por 400 gr": "6",
    "Dulce de batata x kg": "1",
    "Queso cremoso x kg": "2.5",
    "Aceite girasol por 900 cc": "8",
    "Arroz 00000 por kg": "7",
    "Arvejas x 340 gr Tetra Brik": "0",
    "Lentejas remojadas x 350 gr": "3",
    "Pimenton x 25 gr": "0",
    "Oregano x 25 gr": "0",
    "Condimento para pizza x 25 gr": "0",
    "Sal fina x 500 gr": "1",
    "Fideo tirabuzon x 500 g": "5",
    "Tomate triturado en tetrabrik x 500 gr": "4",
    "Pan rallado x kg": "2",
    "Almidon de maiz x 500 g": "1",
    "Esencia de vainilla x 100 cc": "0",
    "Harina Leudante x kg": "3",
    "Harina 000 x kg": "4",
    "Levadura seca x 20 gr": "0",
    "PULPA DE CERDO fileteada por Kg.": "0",
    "POLLO por Kg.": "15",
    "NALGA CERDO fileteada para milanesa por Kg.": "10",
    "Pan": "0",
}

# Escuelas que recibiran stock (por codigo). Vacias = todas las activas.
TARGET_SCHOOL_CODES: list[str] = [
    "EP 1",
    "EP 13",
    "EES 8",
    "EEST 1",
    "EP4",
    "EP23",
    "CEC801",
    "PP8",
    "PP56",
    "JI903",
]


def seed() -> None:
    Base.metadata.create_all(bind=engine)

    # Migracion: agrega columna details si no existe (SQLite no tiene IF NOT EXISTS)
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE notifications ADD COLUMN details TEXT"))
            conn.commit()
        except Exception:
            conn.rollback()

    db = SessionLocal()
    try:
        # --- Crea usuario escuela para las pruebas de stock ---
        usuario1 = (
            db.query(User).filter(User.username == "Usuario1").first()
        )
        if usuario1 is None:
            usuario1 = User(
                username="Usuario1",
                password=hash_password("Usuario1234"),
                role=UserRole.escuela,
                active=True,
            )
            db.add(usuario1)
            db.flush()
            print("[seed:stock] Usuario 'Usuario1' (escuela) creado.")

        # --- Valida ingredientes ---
        ingredientes = {i.nombre: i for i in db.query(Ingrediente).filter(Ingrediente.activo == True).all()}
        if not ingredientes:
            print("[seed:stock] ERROR: No hay ingredientes activos. Ejecuta seed_data.py primero.")
            return

        # --- Escuelas objetivo ---
        schools_query = db.query(School).filter(School.active == True)
        if TARGET_SCHOOL_CODES:
            schools_query = schools_query.filter(School.code.in_(TARGET_SCHOOL_CODES))

        schools = schools_query.all()
        if not schools:
            print("[seed:stock] ERROR: No se encontraron escuelas activas con los codigos indicados.")
            return

        stock_count = 0
        notif_count = 0

        for school in schools:
            cargado_por = usuario1

            for nombre_ingrediente, cantidad_str in STOCK_VALUES.items():
                ingrediente = ingredientes.get(nombre_ingrediente)
                if ingrediente is None:
                    continue

                existing = (
                    db.query(StockPrevio)
                    .filter(
                        StockPrevio.escuela_id == school.id,
                        StockPrevio.ingrediente_id == ingrediente.id,
                    )
                    .first()
                )

                cantidad = Decimal(cantidad_str)
                if existing:
                    existing.cantidad = cantidad
                    existing.cargado_por_id = cargado_por.id
                    existing.cargado_at = datetime.now(timezone.utc)
                else:
                    stock = StockPrevio(
                        escuela_id=school.id,
                        ingrediente_id=ingrediente.id,
                        cantidad=cantidad,
                        cargado_por_id=cargado_por.id,
                        cargado_at=datetime.now(timezone.utc),
                    )
                    db.add(stock)
                    stock_count += 1

            # Notificacion para admin y gestor con detalle de ingredientes
            items_detail = [
                {"nombre": nombre, "cantidad": cantidad_str}
                for nombre, cantidad_str in STOCK_VALUES.items()
                if nombre in ingredientes
            ]
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
                    message=f"La escuela {school.name} cargó stock sobrante",
                    escuela_id=school.id,
                    escuela_nombre=school.name,
                    cargado_por_username=cargado_por.username,
                    details=json.dumps(items_detail),
                )
                db.add(notif)
                notif_count += 1

        db.commit()
        print("[seed:stock] Stock sobrante de prueba sembrado correctamente.")
        print(f"[seed:stock] Escuelas procesadas: {len(schools)}")
        print(f"[seed:stock] Registros de stock nuevos: {stock_count}")
        print(f"[seed:stock] Notificaciones creadas: {notif_count}")
        print()

        print("Verificacion del historial de modificaciones:")
        print(f"  - Abri /dashboard/historial")
        print(f"  - Deberias ver {notif_count} notificaciones de tipo 'Stock sobrante'")
        print(f"  - Cada noti debe decir 'La escuela [nombre] cargo stock sobrante'")
        print(f"  - Al hacer click en una escuela, los ingredientes aparecen con fondo ambar y badge 'Nuevo'")
        print(f"  - La campanita en el navbar debe mostrar un badge rojo con el total de notis")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
