import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.config.database import Base, get_db
from app.middlewares.auth_middleware import get_current_user
from app.models import Localidad, School, SchoolTipoComidaMatricula, TipoComida, User, UserRole
from app.models.notification_model import Notification
from app.routes.school_routes import router


class SchoolMatriculationPermissionsTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.school = School(
            id=1, name="Escuela de prueba", code="EP1", address="Calle 123",
            locality=Localidad(nombre="Azul"), matriculation=100,
            tipos_comida=[TipoComida(id=1, nombre="Almuerzo")],
            matriculas_por_tipo=[SchoolTipoComidaMatricula(tipo_comida_id=1, cantidad=80)],
        )
        self.school_user = User(username="escuela", password="test", role=UserRole.escuela, school=self.school)
        self.admin = User(username="admin", password="test", role=UserRole.admin)
        self.gestor = User(username="gestor", password="test", role=UserRole.gestor)
        self.db.add_all([self.school_user, self.admin, self.gestor])
        self.db.commit()
        self.current_user = self.school_user
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_user] = lambda: self.current_user
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.db.close()
        self.engine.dispose()

    def test_school_can_edit_general_enrollment_without_changing_service_quotas(self):
        response = self.client.patch("/schools/me/matriculation", json={"matriculation": 120})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["matriculation"], 120)
        self.assertEqual(response.json()["matriculas_por_tipo"][0]["cantidad"], 80)
        self.assertEqual(self.db.query(Notification).count(), 2)

    def test_school_cannot_send_service_quotas_through_enrollment_endpoint(self):
        response = self.client.patch("/schools/me/matriculation", json={
            "matriculation": 120,
            "matriculas_por_tipo": [{"tipo_comida_id": 1, "cantidad": 999}],
        })
        self.assertEqual(response.status_code, 422)
        self.db.refresh(self.school)
        self.assertEqual(self.school.matriculation, 100)
        self.assertEqual(self.school.matriculas_por_tipo[0].cantidad, 80)
        self.assertEqual(self.db.query(Notification).count(), 0)

    def test_school_cannot_edit_quotas_through_administrative_endpoint(self):
        response = self.client.put("/schools/1", json={
            "matriculas_por_tipo": [{"tipo_comida_id": 1, "cantidad": 999}],
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.school.matriculas_por_tipo[0].cantidad, 80)

    def test_admin_and_gestor_can_still_edit_service_quotas(self):
        for user, quota in [(self.admin, 90), (self.gestor, 95)]:
            with self.subTest(role=user.role):
                self.current_user = user
                response = self.client.put("/schools/1", json={
                    "matriculas_por_tipo": [{"tipo_comida_id": 1, "cantidad": quota}],
                })
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["matriculas_por_tipo"][0]["cantidad"], quota)
                self.assertEqual(response.json()["matriculation"], 100)


if __name__ == "__main__":
    unittest.main()
