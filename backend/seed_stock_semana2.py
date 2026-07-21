"""
Seed de stock sobrante - SEMANA 2 (consumo y recarga).

Simula lo que paso 7 dias despues de seed_stock_semana1:
  - Ingredientes de semana 1: algunos consumidos, otros recargados, otros sin cambio
  - Ingredientes nuevos que no estaban en semana 1

Uso:
    docker compose exec backend python seed_stock_semana2.py
    # o en local, desde backend/:
    python seed_stock_semana2.py

Requiere haber ejecutado seed_stock_semana1.py primero.
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
import app.models  # noqa: F401
from app.models.ingrediente_model import Ingrediente
from app.models.notification_model import Notification
from app.models.school_model import School
from app.models.stock_previo_model import StockPrevio
from app.models.user_model import User, UserRole

# Ingredientes de semana 1 que se CONSUMIERON (cantidad → 0)
CONSUMED = [
    "MANZANA",      # 30 → 0
    "BANANA",       # 12 → 0
    "Tomate",       # 10 → 0
    "POLLO por Kg.",# 20 → 0
]

# Ingredientes de semana 1 que se RECARGARON con nuevo valor
RELOADED: dict[str, str] = {
    "Papa": "35",           # 50 → 35
    "Cebolla": "18",        # 25 → 18
    "Azucar kg": "4",       # 6 → 4
    "Arroz 00000 por kg": "8",  # 10 → 8
    "Aceite girasol por 900 cc": "12",  # 5 → 12
}

# Ingredientes de semana 1 que quedaron IGUAL (sin cambios)
# (no se tocan, mantienen previous_cantidad = 0 de semana 1)

# Ingredientes NUEVOS que no estaban en semana 1
NEW_INGREDIENTS: dict[str, str] = {
    "Zapallo ANCO": "7",
    "Levadura seca x 20 gr": "2",
    "Cacao en polvo x 360 g": "1",
    "Dulce de batata x kg": "3",
    "Lentejas remojadas x 350 gr": "5",
    "Pimenton x 25 gr": "0.5",
}

# Escuela objetivo (solo 1)
TARGET_SCHOOL_CODES: list[str] = [
    "EP 1",
]


def seed() -> None:
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        usuario1 = db.query(User).filter(User.username == "Usuario1").first()
        if usuario1 is None:
            print("[semana2] ERROR: No existe 'Usuario1'. Ejecuta seed_stock_semana1.py primero.")
            return

        ingredientes = {i.nombre: i for i in db.query(Ingrediente).filter(Ingrediente.activo == True).all()}

        schools = (
            db.query(School)
            .filter(School.active == True, School.code.in_(TARGET_SCHOOL_CODES))
            .all()
        )
        if not schools:
            print("[semana2] ERROR: No se encontraron escuelas.")
            return

        stock_updates = 0
        notif_count = 0

        for school in schools:
            changed_names: set[str] = set()
            new_values: dict[str, str] = {}

            # --- Consumidos (semana 1 → 0) ---
            for nombre in CONSUMED:
                ingrediente = ingredientes.get(nombre)
                if ingrediente is None:
                    continue

                stock = (
                    db.query(StockPrevio)
                    .filter(
                        StockPrevio.escuela_id == school.id,
                        StockPrevio.ingrediente_id == ingrediente.id,
                    )
                    .first()
                )
                if stock is None:
                    continue

                stock.previous_cantidad = stock.cantidad
                stock.cantidad = Decimal("0")
                stock.cargado_por_id = usuario1.id
                stock.cargado_at = datetime.now(timezone.utc)
                stock_updates += 1
                changed_names.add(nombre)
                new_values[nombre] = "0"

            # --- Recargados (semana 1 → nuevo valor) ---
            for nombre, cantidad_str in RELOADED.items():
                ingrediente = ingredientes.get(nombre)
                if ingrediente is None:
                    continue

                stock = (
                    db.query(StockPrevio)
                    .filter(
                        StockPrevio.escuela_id == school.id,
                        StockPrevio.ingrediente_id == ingrediente.id,
                    )
                    .first()
                )
                if stock is None:
                    continue

                stock.previous_cantidad = stock.cantidad
                stock.cantidad = Decimal(cantidad_str)
                stock.cargado_por_id = usuario1.id
                stock.cargado_at = datetime.now(timezone.utc)
                stock_updates += 1
                changed_names.add(nombre)
                new_values[nombre] = cantidad_str

            # --- Nuevos (no existian en semana 1) ---
            for nombre, cantidad_str in NEW_INGREDIENTS.items():
                ingrediente = ingredientes.get(nombre)
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
                    existing.previous_cantidad = existing.cantidad
                    existing.cantidad = cantidad
                    existing.cargado_por_id = usuario1.id
                    existing.cargado_at = datetime.now(timezone.utc)
                else:
                    stock = StockPrevio(
                        escuela_id=school.id,
                        ingrediente_id=ingrediente.id,
                        cantidad=cantidad,
                        previous_cantidad=Decimal("0"),
                        cargado_por_id=usuario1.id,
                        cargado_at=datetime.now(timezone.utc),
                    )
                    db.add(stock)
                    stock_updates += 1

                changed_names.add(nombre)
                new_values[nombre] = cantidad_str

            # --- Construir items_detail con TODOS los ingredientes activos ---
            # Antes de commitear, leemos los valores actuales (semana 1) de cada ingrediente
            all_stock_rows = (
                db.query(StockPrevio)
                .filter(StockPrevio.escuela_id == school.id)
                .all()
            )
            stock_map = {row.ingrediente_id: row for row in all_stock_rows}

            items_detail = []
            for ingrediente in db.query(Ingrediente).filter(Ingrediente.activo == True).order_by(Ingrediente.nombre).all():
                if ingrediente.nombre in changed_names:
                    old_val = str(stock_map[ingrediente.id].previous_cantidad or "0") if ingrediente.id in stock_map else "0"
                    new_val = new_values[ingrediente.nombre]
                    was_updated = True
                else:
                    stock_row = stock_map.get(ingrediente.id)
                    val = str(stock_row.cantidad) if stock_row else "0"
                    old_val = val
                    new_val = val
                    was_updated = False

                items_detail.append({
                    "nombre": ingrediente.nombre,
                    "unidad_medida": ingrediente.unidad_medida,
                    "cantidad": new_val,
                    "cantidad_anterior": old_val,
                    "actualizado": was_updated,
                })

            if items_detail:
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
        print(f"[semana2] Stock de la semana 2 actualizado.")
        print(f"[semana2] Escuela: {schools[0].name}")
        print(f"[semana2] Ingredientes totales: {len(items_detail)} (modificados: {len(changed_names)})")
        print(f"[semana2] Registros modificados: {stock_updates}")
        print(f"[semana2] Notificaciones: {notif_count}")
        print()
        print("La notificacion incluye TODOS los ingredientes activos.")
        print("Stock Anterior = valor de semana 1 | Stock Nuevo = valor de semana 2.")
        print("Los modificados muestran badge MODIFICADO en el modal.")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
