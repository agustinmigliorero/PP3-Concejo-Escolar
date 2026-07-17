"""
Limpia la tabla de pedidos generados (generaciones_pedido).

No toca menus, escuelas, usuarios ni stock previo.

Uso:
    docker compose exec backend python clean_pedidos.py
    # o en local, desde backend/:
    python clean_pedidos.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.config.database import SessionLocal
import app.models  # noqa: F401
from app.models.pedido_model import GeneracionPedido


def clean() -> None:
    db = SessionLocal()
    try:
        deleted = db.query(GeneracionPedido).delete(synchronize_session=False)
        db.commit()
        print(f"[clean:pedidos] Eliminadas {deleted} fila(s) de generaciones_pedido.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    clean()
