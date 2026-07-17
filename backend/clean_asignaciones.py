"""
Limpia todas las asignaciones proveedor-ingrediente-localidad
(asignaciones_proveedor), vigentes e historicas.

Para borrar solo el historial (cerradas) y conservar las vigentes,
usa clean_historial.py.

Uso:
    docker compose exec backend python clean_asignaciones.py
    # o en local, desde backend/:
    python clean_asignaciones.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.config.database import SessionLocal
import app.models  # noqa: F401
from app.models.asignacion_proveedor_model import AsignacionProveedor


def clean() -> None:
    db = SessionLocal()
    try:
        deleted = db.query(AsignacionProveedor).delete(synchronize_session=False)
        db.commit()
        print(f"[clean:asignaciones] Eliminadas {deleted} fila(s) de asignaciones_proveedor.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    clean()
