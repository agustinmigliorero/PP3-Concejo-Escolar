"""Shared pytest fixtures: in-memory SQLite, FastAPI TestClient and domain seeds.

The app reads its configuration (SECRET_KEY, DATABASE_URL) at import time from
backend/.env, and app.main captures the engine binding when it is imported.
Tests therefore pin a test-only SECRET_KEY and rebind the engine to an
in-memory SQLite database BEFORE any app module is imported.
"""

import os
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

# Settings refuses to boot without a usable SECRET_KEY; the developer's local
# .env may still hold the placeholder, and tests must not depend on it.
# Environment variables win over dotenv values in pydantic-settings.
os.environ.setdefault("SECRET_KEY", "sdd-stock-sobrante-test-secret-key")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.config import database as database_module  # noqa: E402
from app.config.security import create_access_token  # noqa: E402

# A single shared in-memory connection: every session (requests included)
# sees the same database regardless of the thread FastAPI runs on.
TEST_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TEST_SESSION_FACTORY = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)

# Rebind before importing app.main: main.py does `from app.config.database import
# engine` (a captured reference) and its startup hook creates the tables there.
database_module.engine = TEST_ENGINE
database_module.SessionLocal = TEST_SESSION_FACTORY

import app.main as main_module  # noqa: E402

main_module.engine = TEST_ENGINE
app = main_module.app

from app.models.ingrediente_model import Ingrediente  # noqa: E402
from app.models.location_model import Localidad  # noqa: E402
from app.models.receta_model import Receta, RecetaIngrediente  # noqa: E402
from app.models.school_model import School  # noqa: E402
from app.models.stock_previo_model import StockPrevio  # noqa: E402
from app.models.temporada_model import NombreTemporada, Temporada  # noqa: E402
from app.models.tipo_comida_model import TipoComida  # noqa: E402
from app.models.user_model import User, UserRole  # noqa: E402


@dataclass
class SeedData:
    """Handles of the canonical dataset every scope test runs against."""

    escuela_a: School
    escuela_b: School
    escuela_c: School
    user_escuela_a: User
    user_escuela_c: User
    user_admin: User
    pan: Ingrediente
    sal: Ingrediente
    azucar: Ingrediente
    pimienta: Ingrediente
    verano: Temporada
    invierno: Temporada


@pytest.fixture()
def db() -> Iterator:
    """Fresh schema plus an open session bound to the in-memory engine."""
    database_module.Base.metadata.drop_all(bind=TEST_ENGINE)
    database_module.Base.metadata.create_all(bind=TEST_ENGINE)
    session = TEST_SESSION_FACTORY()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def seed(db) -> SeedData:
    """Two schools with different tipos, two temporadas and escuela/admin users.

    - Escuela A (tipo Almuerzo): recetas "Receta Almuerzo" (VERANO: pan, sal)
      and "Receta Base Sin Temporada" (sin temporada: azucar) -> union
      {azucar, pan, sal}; in-season set {pan, sal}.
    - Escuela B (tipo Colacion): receta "Receta Colacion" (VERANO: pimienta)
      -> pimienta is global-only relative to Escuela A.
    - Escuela C (tipo Merienda): NO recetas at all -> empty scoped state.
    - No DiaMenu rows on purpose: the scoped list must be menu-independent.
    - Escuela A already holds stock 7 of pan (used by the atomicity test).
    """
    localidad = Localidad(nombre="Localidad Test")
    tipo_almuerzo = TipoComida(nombre="Almuerzo")
    tipo_colacion = TipoComida(nombre="Colacion")
    tipo_merienda = TipoComida(nombre="Merienda")
    pan = Ingrediente(nombre="pan", unidad_medida="unidades")
    sal = Ingrediente(nombre="sal", unidad_medida="kg")
    azucar = Ingrediente(nombre="azucar", unidad_medida="kg")
    pimienta = Ingrediente(nombre="pimienta", unidad_medida="kg")
    verano = Temporada(nombre=NombreTemporada.VERANO, anio=2026, activo=True)
    invierno = Temporada(nombre=NombreTemporada.INVIERNO, anio=2026, activo=False)
    db.add_all(
        [
            localidad,
            tipo_almuerzo,
            tipo_colacion,
            tipo_merienda,
            pan,
            sal,
            azucar,
            pimienta,
            verano,
            invierno,
        ]
    )
    db.commit()

    escuela_a = School(
        name="Escuela A",
        code="EA-TEST",
        locality_id=localidad.id,
        address="Direccion 1",
        tipos_comida=[tipo_almuerzo],
    )
    escuela_b = School(
        name="Escuela B",
        code="EB-TEST",
        locality_id=localidad.id,
        address="Direccion 2",
        tipos_comida=[tipo_colacion],
    )
    escuela_c = School(
        name="Escuela C",
        code="EC-TEST",
        locality_id=localidad.id,
        address="Direccion 3",
        tipos_comida=[tipo_merienda],
    )
    user_admin = User(username="admin_test", password="x", role=UserRole.admin)
    user_escuela_a = User(
        username="escuela_a_test",
        password="x",
        role=UserRole.escuela,
        school=escuela_a,
    )
    user_escuela_c = User(
        username="escuela_c_test",
        password="x",
        role=UserRole.escuela,
        school=escuela_c,
    )
    db.add_all([escuela_a, escuela_b, escuela_c, user_admin, user_escuela_a, user_escuela_c])
    db.commit()

    receta_almuerzo = Receta(
        nombre="Receta Almuerzo",
        temporadas=[verano],
        tipos_comida=[tipo_almuerzo],
    )
    receta_base = Receta(
        nombre="Receta Base Sin Temporada",
        temporadas=[],
        tipos_comida=[tipo_almuerzo],
    )
    receta_colacion = Receta(
        nombre="Receta Colacion",
        temporadas=[verano],
        tipos_comida=[tipo_colacion],
    )
    db.add_all([receta_almuerzo, receta_base, receta_colacion])
    db.commit()

    db.add_all(
        [
            RecetaIngrediente(
                receta=receta_almuerzo, ingrediente=pan, cantidad_por_porcion=Decimal("1")
            ),
            RecetaIngrediente(
                receta=receta_almuerzo, ingrediente=sal, cantidad_por_porcion=Decimal("1")
            ),
            RecetaIngrediente(
                receta=receta_base, ingrediente=azucar, cantidad_por_porcion=Decimal("1")
            ),
            RecetaIngrediente(
                receta=receta_colacion, ingrediente=pimienta, cantidad_por_porcion=Decimal("1")
            ),
        ]
    )
    db.commit()

    db.add(
        StockPrevio(
            escuela_id=escuela_a.id,
            ingrediente_id=pan.id,
            cantidad=Decimal("7"),
            previous_cantidad=Decimal("0"),
            cargado_por_id=user_escuela_a.id,
            cargado_at=datetime.now(timezone.utc),
        )
    )
    db.commit()

    return SeedData(
        escuela_a=escuela_a,
        escuela_b=escuela_b,
        escuela_c=escuela_c,
        user_escuela_a=user_escuela_a,
        user_escuela_c=user_escuela_c,
        user_admin=user_admin,
        pan=pan,
        sal=sal,
        azucar=azucar,
        pimienta=pimienta,
        verano=verano,
        invierno=invierno,
    )


@pytest.fixture()
def client(seed) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def auth_headers():
    """Bearer headers for a user, mirroring the real JWT access-token flow."""

    def _headers(user: User) -> dict[str, str]:
        token = create_access_token({"sub": str(user.id)})
        return {"Authorization": f"Bearer {token}"}

    return _headers


@pytest.fixture()
def json_items():
    """Response items keyed by ingrediente_nombre for order-insensitive checks."""

    def _by_name(payload: dict) -> dict[str, dict]:
        return {item["ingrediente_nombre"]: item for item in payload["items"]}

    return _by_name
