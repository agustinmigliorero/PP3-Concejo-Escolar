"""Historial de cambios de precio de las asignaciones de proveedor.

Editar el precio sobreescribe `asignaciones_proveedor.precio_unitario`, así que
sin la tabla `asignaciones_precio_historial` el valor anterior se pierde. Estos
tests fijan esa garantía: toda baja de precio queda asentada con su valor
previo y su autor.
"""

import os
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

# El engine de app.config.database se arma al importarse, leyendo settings. Se
# desvía la URL a una base temporal ANTES de importar app para que los tests no
# toquen la base real de desarrollo. SECRET_KEY es obligatoria en settings.
_TMP_DIR = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_TMP_DIR) / 'precio_historial_test.db'}"
os.environ.setdefault("SECRET_KEY", "clave_de_pruebas_no_usar_en_produccion")

from fastapi import HTTPException  # noqa: E402

from app.config.database import Base, SessionLocal  # noqa: E402
from app.controllers.asignacion_proveedor_controller import (  # noqa: E402
    CreateAsignacionRequest,
    UpdatePrecioRequest,
)
from app.models.asignacion_precio_historial_model import (  # noqa: E402
    AsignacionPrecioHistorial,
)
from app.models.asignacion_proveedor_model import AsignacionProveedor  # noqa: E402
from app.models.ingrediente_model import Ingrediente  # noqa: E402
from app.models.location_model import Localidad  # noqa: E402
from app.models.proveedor_model import Proveedor  # noqa: E402
from app.models.user_model import User, UserRole  # noqa: E402
from app.services import asignacion_proveedor_service as svc  # noqa: E402


class PrecioHistorialTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._engine = SessionLocal.kw["bind"]

    def setUp(self):
        # proveedores/ingredientes/localidades/users tienen nombre único: se
        # recrea el esquema para que cada test arranque limpio.
        Base.metadata.drop_all(bind=self._engine)
        Base.metadata.create_all(bind=self._engine)
        self.db = SessionLocal()
        proveedor = Proveedor(nombre="Proveedor", contacto="c", activo=True)
        ingrediente = Ingrediente(nombre="Arroz", unidad_medida="kg", activo=True)
        localidad = Localidad(nombre="Localidad", activo=True)
        self.usuario = User(username="admin", password="x", role=UserRole.admin)
        self.db.add_all([proveedor, ingrediente, localidad, self.usuario])
        self.db.commit()

        self.asignacion = svc.create_asignacion(
            self.db,
            CreateAsignacionRequest(
                proveedor_id=proveedor.id,
                ingrediente_id=ingrediente.id,
                localidad_id=localidad.id,
                precio_unitario=Decimal("1900.00"),
            ),
        )
        self.combo = (ingrediente.id, localidad.id)

    def tearDown(self):
        self.db.close()

    def _cambiar_precio(self, precio: str) -> None:
        svc.update_precio(
            self.db,
            self.asignacion.id,
            UpdatePrecioRequest(precio_unitario=Decimal(precio)),
            self.usuario,
        )

    def _entradas(self):
        return svc.get_precio_historial(self.db, *self.combo)

    def test_crear_asignacion_no_asienta_historial(self):
        self.assertEqual(self.db.query(AsignacionPrecioHistorial).count(), 0)

    def test_registra_previo_nuevo_autor_y_orden_de_forma_decresciente(self):
        self._cambiar_precio("2100.00")
        self._cambiar_precio("1850.50")

        entradas = self._entradas()
        self.assertEqual(len(entradas), 2)

        reciente, anterior = entradas
        self.assertEqual(reciente.precio_anterior, Decimal("2100.00"))
        self.assertEqual(reciente.precio_nuevo, Decimal("1850.50"))
        self.assertEqual(reciente.variacion, Decimal("-249.50"))
        self.assertEqual(reciente.variacion_pct, Decimal("-11.88"))
        self.assertEqual(reciente.modificado_por_username, "admin")
        self.assertEqual(reciente.precio_actual, Decimal("1850.50"))
        self.assertTrue(reciente.vigente)

        self.assertEqual(anterior.precio_anterior, Decimal("1900.00"))
        self.assertEqual(anterior.precio_nuevo, Decimal("2100.00"))
        self.assertEqual(anterior.variacion, Decimal("200.00"))
        self.assertEqual(anterior.variacion_pct, Decimal("10.53"))

    def test_guardar_el_mismo_precio_no_asienta_historial(self):
        self._cambiar_precio("2100.00")
        # Mismo valor con distinto formato: tampoco es un cambio.
        self._cambiar_precio("2100.00")
        self._cambiar_precio("2100")

        self.assertEqual(len(self._entradas()), 1)

    def test_rechazar_edicion_de_no_vigente_no_asienta_historial(self):
        self._cambiar_precio("2100.00")

        orm = (
            self.db.query(AsignacionProveedor)
            .filter(AsignacionProveedor.id == self.asignacion.id)
            .first()
        )
        orm.fecha_hasta = orm.fecha_desde
        self.db.commit()

        with self.assertRaises(HTTPException) as ctx:
            self._cambiar_precio("1.00")
        self.assertEqual(ctx.exception.status_code, 409)

        self.assertEqual(len(self._entradas()), 1)

    def test_el_historial_no_se_mezcla_con_otras_combinaciones(self):
        self._cambiar_precio("2100.00")

        self.assertEqual(svc.get_precio_historial(self.db, self.combo[0], 999999), [])


if __name__ == "__main__":
    unittest.main()