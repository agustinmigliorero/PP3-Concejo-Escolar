"""
Limpia todas las asignaciones proveedor-ingrediente-localidad
(asignaciones_proveedor), vigentes e historicas, junto con el historial
de cambios de precio (asignaciones_precio_historial).

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
from app.models.asignacion_precio_historial_model import AsignacionPrecioHistorial
from app.models.asignacion_proveedor_model import AsignacionProveedor


def clean() -> None:
    db = SessionLocal()
    try:
        # Primero el historial de precios: referencia a asignaciones_proveedor.
        borrados_historial = db.query(AsignacionPrecioHistorial).delete(
            synchronize_session=False
        )
        deleted = db.query(AsignacionProveedor).delete(synchronize_session=False)
        db.commit()
        print(
            f"[clean:asignaciones] Eliminadas {borrados_historial} fila(s) de "
            f"asignaciones_precio_historial y {deleted} de asignaciones_proveedor."
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    clean()
