"""
Seed de stock sobrante - SEMANA 1 (carga inicial).

Simula que la escuela EP 1 cargo ingredientes hace 7 dias.
Ingredinetes y cantidades distintas al seeder 2.

Uso:
    docker compose exec backend python seed_stock_semana1.py
    # o en local, desde backend/:
    python seed_stock_semana1.py

Requiere haber ejecutado seed.py y seed_data.py primero.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
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

# Ingredientes y cantidades de la SEMANA 1
SEMANA1_STOCK: dict[str, str] = {
    "MANZANA": "30",
    "BANANA": "12",
    "NARANJA O MANDARINA": "20",
    "Papa": "50",
    "Cebolla": "25",
    "Zanahoria": "15",
    "Tomate": "10",
    "Ajo": "1",
    "Huevo de gallina x doc": "4",
    "Leche fluida x litro": "8",
    "Azucar kg": "6",
    "Te en saquito x 25 u": "3",
    "Queso cremoso x kg": "2",
    "Aceite girasol por 900 cc": "5",
    "Arroz 00000 por kg": "10",
    "Fideo tirabuzon x 500 g": "7",
    "Harina 000 x kg": "4",
    "POLLO por Kg.": "20",
    "Dulce de leche por 400 gr": "3",
    "Pan rallado x kg": "2",
}

# Escuela objetivo (solo 1)
TARGET_SCHOOL_CODES: list[str] = [
    "EP 1",
]

# Fecha: hace exactamente 7 dias
SEVEN_DAYS_AGO = datetime.now(timezone.utc) - timedelta(days=7)


def seed() -> None:
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        for ddl in [
            "ALTER TABLE notifications ADD COLUMN details TEXT",
            "ALTER TABLE stock_previo ADD COLUMN previous_cantidad NUMERIC(12, 2)",
        ]:
            try:
                conn.execute(text(ddl))
                conn.commit()
            except Exception:
                conn.rollback()

    db = SessionLocal()
    try:
        usuario1 = db.query(User).filter(User.username == "Usuario1").first()
        if usuario1 is None:
            usuario1 = User(
                username="Usuario1",
                password=hash_password("Usuario1234"),
                role=UserRole.escuela,
                active=True,
            )
            db.add(usuario1)
            db.flush()
            print("[semana1] Usuario 'Usuario1' creado.")

        ingredientes = {i.nombre: i for i in db.query(Ingrediente).filter(Ingrediente.activo == True).all()}
        if not ingredientes:
            print("[semana1] ERROR: No hay ingredientes activos.")
            return

        schools = (
            db.query(School)
            .filter(School.active == True, School.code.in_(TARGET_SCHOOL_CODES))
            .all()
        )
        if not schools:
            print("[semana1] ERROR: No se encontraron escuelas.")
            return

        stock_count = 0
        notif_count = 0

        for school in schools:
            items_detail = []
            all_ingredientes = db.query(Ingrediente).filter(Ingrediente.activo == True).order_by(Ingrediente.nombre).all()
            for ingrediente in all_ingredientes:
                nombre = ingrediente.nombre
                is_loaded = nombre in SEMANA1_STOCK
                cantidad_str = SEMANA1_STOCK.get(nombre, "0")
                cantidad = Decimal(cantidad_str)

                if is_loaded:
                    existing = (
                        db.query(StockPrevio)
                        .filter(
                            StockPrevio.escuela_id == school.id,
                            StockPrevio.ingrediente_id == ingrediente.id,
                        )
                        .first()
                    )
                    if existing:
                        existing.previous_cantidad = Decimal("0")
                        existing.cantidad = cantidad
                        existing.cargado_por_id = usuario1.id
                        existing.cargado_at = SEVEN_DAYS_AGO
                    else:
                        stock = StockPrevio(
                            escuela_id=school.id,
                            ingrediente_id=ingrediente.id,
                            cantidad=cantidad,
                            previous_cantidad=Decimal("0"),
                            cargado_por_id=usuario1.id,
                            cargado_at=SEVEN_DAYS_AGO,
                        )
                        db.add(stock)
                        stock_count += 1

                items_detail.append({
                    "nombre": nombre,
                    "unidad_medida": ingrediente.unidad_medida,
                    "cantidad": cantidad_str if is_loaded else "0",
                    "cantidad_anterior": "0",
                    "actualizado": is_loaded,
                })

            admin_gestor = (
                db.query(User)
                .filter(User.active == True, User.role.in_([UserRole.admin, UserRole.gestor]))
                .all()
            )
            for target_user in admin_gestor:
                notif = Notification(
                    user_id=target_user.id,
                    type="stock_cargado",
                    message=f"La escuela {school.name} cargó stock sobrante",
                    escuela_id=school.id,
                    escuela_nombre=school.name,
                    cargado_por_username=usuario1.username,
                    details=json.dumps(items_detail),
                )
                db.add(notif)
                notif_count += 1

        db.commit()
        print(f"[semana1] Stock de la semana 1 sembrado.")
        print(f"[semana1] Escuela: {schools[0].name}")
        print(f"[semana1] Ingredientes totales: {len(items_detail)} (cargados: {len(SEMANA1_STOCK)})")
        print(f"[semana1] Registros nuevos: {stock_count}")
        print(f"[semana1] Notificaciones: {notif_count}")
        print(f"[semana1] Fecha de carga: {SEVEN_DAYS_AGO.strftime('%d/%m/%Y %H:%M')} (hace 7 dias)")
        print()
        print("Carga inicial: todos los ingredientes aparecen en la notificacion.")
        print("Los cargados muestran cantidad_anterior = 0 y actualizado = true.")
        print("Los no cargados muestran cantidad = 0 y actualizado = false.")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
