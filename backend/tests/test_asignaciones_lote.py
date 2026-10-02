import unittest
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.config.database import Base, get_db
from app.controllers.asignacion_proveedor_controller import (
    CreateAsignacionRequest,
    CreateAsignacionesLoteRequest,
)
from app.middlewares.auth_middleware import get_current_user, require_admin
from app.models import AsignacionProveedor, Ingrediente, Localidad, Proveedor, User, UserRole
from app.routes.asignacion_proveedor_routes import router
from app.services.asignacion_proveedor_service import (
    create_asignacion,
    create_asignaciones_lote,
    get_historial,
)


class AsignacionesLoteTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.db.add_all([
            Proveedor(id=1, nombre="Proveedor", contacto="Contacto", activo=True),
            Ingrediente(id=1, nombre="Arroz", unidad_medida="kg", activo=True),
            Localidad(id=1, nombre="Azul", activo=True),
            Localidad(id=2, nombre="Cacharí", activo=True),
            Localidad(id=3, nombre="Chillar", activo=False),
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def payload(self, **changes):
        data = {
            "proveedor_id": 1,
            "ingrediente_id": 1,
            "fecha_desde": "2026-10-02",
            "localidades": [
                {"localidad_id": 1, "precio_unitario": "1900.25"},
                {"localidad_id": 2, "precio_unitario": "2100.50"},
            ],
        }
        return {**data, **changes}

    def seed_previous(self, localidad_id, fecha_desde=date(2026, 9, 1)):
        return create_asignacion(self.db, CreateAsignacionRequest(
            proveedor_id=1, ingrediente_id=1, localidad_id=localidad_id,
            precio_unitario=Decimal("1000"), fecha_desde=fecha_desde,
        ))

    def test_creates_independent_prices_and_preserves_each_history(self):
        previous = [self.seed_previous(1), self.seed_previous(2)]
        rows = create_asignaciones_lote(
            self.db, CreateAsignacionesLoteRequest(**self.payload())
        )
        self.assertEqual([row.precio_unitario for row in rows], [Decimal("1900.25"), Decimal("2100.50")])
        self.assertTrue(all(row.vigente for row in rows))
        self.assertEqual([row.localidad_nombre for row in rows], ["Azul", "Cacharí"])
        for old in previous:
            history = get_historial(self.db, 1, old.localidad_id)
            self.assertEqual(len(history), 2)
            self.assertEqual(history[1].fecha_hasta, date(2026, 10, 2))
            self.assertFalse(history[1].vigente)

    def test_invalid_locality_does_not_create_or_close_any_assignment(self):
        old = self.seed_previous(1)
        for localidad_id in [3, 999]:
            with self.subTest(localidad_id=localidad_id):
                payload = self.payload(localidades=[
                    {"localidad_id": 1, "precio_unitario": "1900"},
                    {"localidad_id": localidad_id, "precio_unitario": "2100"},
                ])
                with self.assertRaises(HTTPException):
                    create_asignaciones_lote(self.db, CreateAsignacionesLoteRequest(**payload))
                self.assertEqual(self.db.query(AsignacionProveedor).count(), 1)
                self.assertIsNone(self.db.get(AsignacionProveedor, old.id).fecha_hasta)

    def test_invalid_date_in_last_locality_keeps_all_previous_assignments(self):
        previous = [self.seed_previous(1), self.seed_previous(2, date(2026, 11, 1))]
        with self.assertRaises(HTTPException) as error:
            create_asignaciones_lote(self.db, CreateAsignacionesLoteRequest(**self.payload()))
        self.assertIn("Cacharí", error.exception.detail)
        self.assertEqual(self.db.query(AsignacionProveedor).count(), 2)
        for old in previous:
            self.assertIsNone(self.db.get(AsignacionProveedor, old.id).fecha_hasta)

    def test_commit_failure_rolls_back_insertions_and_history_changes(self):
        old = self.seed_previous(1)
        with patch.object(self.db, "commit", side_effect=RuntimeError("fallo de guardado")):
            with self.assertRaises(RuntimeError):
                create_asignaciones_lote(self.db, CreateAsignacionesLoteRequest(**self.payload()))
        self.assertEqual(self.db.query(AsignacionProveedor).count(), 1)
        self.assertIsNone(self.db.get(AsignacionProveedor, old.id).fecha_hasta)

    def test_rejects_duplicate_localities_empty_batch_and_invalid_prices(self):
        for localidades in [
            [],
            [{"localidad_id": 1, "precio_unitario": "10"}] * 2,
            [{"localidad_id": 1, "precio_unitario": "0"}],
            [{"localidad_id": 1, "precio_unitario": "-10"}],
            [{"localidad_id": 1, "precio_unitario": "NaN"}],
            [{"localidad_id": 1, "precio_unitario": "0.001"}],
            [{"localidad_id": 1, "precio_unitario": "10000000000"}],
        ]:
            with self.subTest(localidades=localidades), self.assertRaises(ValidationError):
                CreateAsignacionesLoteRequest(**self.payload(localidades=localidades))

    def test_inactive_ingredient_or_provider_cannot_create_assignments(self):
        for model in [Ingrediente, Proveedor]:
            with self.subTest(model=model):
                record = self.db.get(model, 1)
                record.activo = False
                self.db.commit()
                with self.assertRaises(HTTPException) as error:
                    create_asignaciones_lote(self.db, CreateAsignacionesLoteRequest(**self.payload()))
                self.assertEqual(error.exception.status_code, 400)
                self.assertEqual(self.db.query(AsignacionProveedor).count(), 0)
                record.activo = True
                self.db.commit()

    def test_missing_date_defaults_to_today_and_single_locality_is_supported(self):
        rows = create_asignaciones_lote(self.db, CreateAsignacionesLoteRequest(**self.payload(
            fecha_desde=None, localidades=[{"localidad_id": 1, "precio_unitario": "10"}],
        )))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].fecha_desde, date.today())

    def test_batch_route_validation_and_existing_single_route(self):
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[require_admin] = lambda: True
        with TestClient(app) as client:
            response = client.post("/asignaciones/lote", json=self.payload())
            self.assertEqual(response.status_code, 201)
            self.assertEqual(len(response.json()), 2)
            response = client.post("/asignaciones/lote", json=self.payload(localidades=[]))
            self.assertEqual(response.status_code, 422)
            response = client.post("/asignaciones", json={
                "proveedor_id": 1, "ingrediente_id": 1, "localidad_id": 1,
                "precio_unitario": 2200, "fecha_desde": "2026-10-03",
            })
            self.assertEqual(response.status_code, 201)
            self.assertTrue(response.json()["vigente"])

    def test_batch_route_requires_admin(self):
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_db] = lambda: self.db
        with TestClient(app) as client:
            self.assertEqual(client.post("/asignaciones/lote", json=self.payload()).status_code, 401)
            app.dependency_overrides[get_current_user] = lambda: User(role=UserRole.gestor)
            self.assertEqual(client.post("/asignaciones/lote", json=self.payload()).status_code, 403)
        self.assertEqual(self.db.query(AsignacionProveedor).count(), 0)

    def test_batch_price_edits_and_replacements_preserve_both_histories(self):
        admin = User(username="audit_admin", password="test", role=UserRole.admin)
        self.db.add(admin)
        self.db.commit()
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[require_admin] = lambda: admin
        with TestClient(app) as client:
            created = client.post("/asignaciones/lote", json=self.payload()).json()
            for row, price in zip(created, [2500, 2400]):
                response = client.put(f"/asignaciones/{row['id']}", json={"precio_unitario": price})
                self.assertEqual(response.status_code, 200)
                # Repetir el precio no crea un segundo cambio de auditoría.
                self.assertEqual(client.put(
                    f"/asignaciones/{row['id']}", json={"precio_unitario": price},
                ).status_code, 200)

            response = client.post("/asignaciones/lote", json=self.payload(localidades=[
                {"localidad_id": 1, "precio_unitario": 2700},
                {"localidad_id": 3, "precio_unitario": 2800},
            ]))
            self.assertEqual(response.status_code, 400)
            self.assertEqual(self.db.query(AsignacionProveedor).count(), 2)

            response = client.post("/asignaciones/lote", json=self.payload(fecha_desde="2026-10-03"))
            self.assertEqual(response.status_code, 201)
            for row, previous, price in zip(created, ["1900.25", "2100.50"], ["2500.00", "2400.00"]):
                params = {"ingrediente_id": 1, "localidad_id": row["localidad_id"]}
                history = client.get("/asignaciones/historial-precio", params=params)
                self.assertEqual(history.status_code, 200)
                changes = history.json()
                self.assertEqual(len(changes), 1)
                self.assertEqual(changes[0]["precio_anterior"], previous)
                self.assertEqual(changes[0]["precio_nuevo"], price)
                self.assertEqual(changes[0]["modificado_por_username"], "audit_admin")
                self.assertFalse(changes[0]["vigente"])
                periods = client.get("/asignaciones/historial", params=params).json()
                self.assertEqual(len(periods), 2)
                self.assertEqual(sum(period["vigente"] for period in periods), 1)
                self.assertEqual(client.put(
                    f"/asignaciones/{row['id']}", json={"precio_unitario": 1},
                ).status_code, 409)


if __name__ == "__main__":
    unittest.main()
