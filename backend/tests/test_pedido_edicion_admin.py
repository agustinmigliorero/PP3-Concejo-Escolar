import json
import zipfile
from datetime import date
from decimal import Decimal
from io import BytesIO
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from openpyxl import load_workbook

from app.config.database import get_db
from app.config.security import create_access_token
from app.models.ingrediente_model import Ingrediente
from app.models.location_model import Localidad
from app.models.pedido_model import GeneracionPedido
from app.models.school_model import School
from app.models.stock_previo_model import StockPrevio
from app.models.temporada_model import NombreTemporada, OpcionMenu, Temporada
from app.models.user_model import User, UserRole
from app.routes.pedido_routes import router


@pytest.fixture()
def seed(db):
    localidad = Localidad(nombre="Localidad edicion test")
    ingrediente = Ingrediente(
        nombre="pan edicion test",
        unidad_medida="unidades",
        contenido_por_unidad=Decimal("900"),
        unidad_contenido="cc",
    )
    temporada = Temporada(nombre=NombreTemporada.VERANO, anio=2026, activo=True)
    opcion = OpcionMenu(numero_opcion=1, descripcion="Menu test", temporada=temporada)
    escuela_a = School(name="Escuela A", code="EA-EDIT", locality=localidad, address="Direccion A")
    escuela_b = School(name="Escuela B", code="EB-EDIT", locality=localidad, address="Direccion B")
    user_admin = User(username="admin_edicion_test", password="x", role=UserRole.admin)
    user_escuela = User(
        username="escuela_edicion_test",
        password="x",
        role=UserRole.escuela,
        school=escuela_a,
    )
    user_gestor = User(username="gestor_edicion_test", password="x", role=UserRole.gestor)
    db.add_all(
        [
            ingrediente,
            opcion,
            escuela_a,
            escuela_b,
            user_admin,
            user_escuela,
            user_gestor,
        ]
    )
    db.commit()
    db.add(
        StockPrevio(
            escuela_id=escuela_a.id,
            ingrediente_id=ingrediente.id,
            cantidad=Decimal("7.00"),
            cargado_por_id=user_escuela.id,
        )
    )
    db.commit()
    return SimpleNamespace(
        escuela_a=escuela_a,
        escuela_b=escuela_b,
        pan=ingrediente,
        user_admin=user_admin,
        user_escuela_a=user_escuela,
        user_gestor=user_gestor,
        opcion=opcion,
    )


@pytest.fixture()
def client(db):
    test_app = FastAPI()
    test_app.include_router(router)

    def override_get_db():
        yield db

    test_app.dependency_overrides[get_db] = override_get_db
    with TestClient(test_app) as test_client:
        yield test_client


def _order_item(seed, school, cantidad: str) -> dict:
    return {
        "ingrediente_id": seed.pan.id,
        "ingrediente_nombre": seed.pan.nombre,
        "unidad_calculo": "cc",
        "unidad_final": "unidades",
        "cantidad_base": "1800.00",
        "cantidad_corregida": "1800.00",
        "stock_descontado": "7.00" if school.code == "EA-EDIT" else "0.00",
        "cantidad_neta": "1800.00",
        "cantidad_final": cantidad,
        "contenido_por_unidad": "900.00",
        "unidad_contenido": "cc",
        "cantidad_contenido_final": str(Decimal(cantidad) * Decimal("900")),
        "proveedor_id": 12,
        "proveedor_nombre": "Proveedor test",
        "localidad_id": school.locality_id,
        "localidad_nombre": "Localidad Test",
        "precio_unitario": "12.50",
        "costo_total": str(Decimal(cantidad) * Decimal("12.50")),
    }


def _create_regular_order(db, seed) -> GeneracionPedido:
    school_a_item = _order_item(seed, seed.escuela_a, "2.00")
    school_b_item = _order_item(seed, seed.escuela_b, "3.00")
    snapshot = {
        "tipo": "REGULAR",
        "semana_inicio": "2026-10-12",
        "dias_habiles": [1, 2, 3, 4, 5],
        "opcion_menu": {
            "id": 1,
            "numero_opcion": 1,
            "descripcion": "Opcion de prueba",
            "temporada": {"id": 1, "nombre": "VERANO", "anio": 2026},
        },
        "escuelas": [
            {
                "escuela_id": seed.escuela_a.id,
                "codigo": seed.escuela_a.code,
                "nombre": seed.escuela_a.name,
                "localidad_id": seed.escuela_a.locality_id,
                "localidad_nombre": "Localidad Test",
                "matricula": 20,
                "ingredientes": [school_a_item],
            },
            {
                "escuela_id": seed.escuela_b.id,
                "codigo": seed.escuela_b.code,
                "nombre": seed.escuela_b.name,
                "localidad_id": seed.escuela_b.locality_id,
                "localidad_nombre": "Localidad Test",
                "matricula": 30,
                "ingredientes": [school_b_item],
            },
        ],
        "proveedores": [
            {
                "proveedor_id": 12,
                "proveedor_nombre": "Proveedor test",
                "localidad_id": seed.escuela_a.locality_id,
                "localidad_nombre": "Localidad Test",
                "ingredientes": [
                    {
                        "ingrediente_id": seed.pan.id,
                        "ingrediente_nombre": seed.pan.nombre,
                        "unidad": "unidades",
                        "contenido_por_unidad": "900.00",
                        "unidad_contenido": "cc",
                        "precio_unitario": "12.50",
                        "cantidad_total": "5.00",
                        "cantidad_contenido_total": "4500.00",
                        "costo_total": "62.50",
                        "escuelas": [
                            {
                                "escuela_id": seed.escuela_a.id,
                                "escuela_codigo": seed.escuela_a.code,
                                "escuela_nombre": seed.escuela_a.name,
                                "cantidad": "2.00",
                                "cantidad_contenido": "1800.00",
                            },
                            {
                                "escuela_id": seed.escuela_b.id,
                                "escuela_codigo": seed.escuela_b.code,
                                "escuela_nombre": seed.escuela_b.name,
                                "cantidad": "3.00",
                                "cantidad_contenido": "2700.00",
                            },
                        ],
                    }
                ],
            }
        ],
        "resumen_global": [
            {
                "ingrediente_id": seed.pan.id,
                "ingrediente_nombre": seed.pan.nombre,
                "unidad": "unidades",
                "contenido_por_unidad": "900.00",
                "unidad_contenido": "cc",
                "localidad_id": seed.escuela_a.locality_id,
                "localidad_nombre": "Localidad Test",
                "proveedor_id": 12,
                "proveedor_nombre": "Proveedor test",
                "precio_unitario": "12.50",
                "cantidad_total": "5.00",
                "cantidad_contenido_total": "4500.00",
                "costo_total": "62.50",
            }
        ],
        "advertencias": [],
        "costo_total": "62.50",
    }
    pedido = GeneracionPedido(
        tipo="REGULAR",
        semana_inicio=date(2026, 10, 12),
        opcion_menu_id=seed.opcion.id,
        dias_habiles=json.dumps([1, 2, 3, 4, 5]),
        generado_por_id=seed.user_admin.id,
        datos_snapshot=snapshot,
    )
    db.add(pedido)
    db.commit()
    db.refresh(pedido)
    return pedido


def test_admin_edits_order_and_rebuilds_exports_without_changing_stock(
    client, db, seed, auth_headers
):
    pedido = _create_regular_order(db, seed)
    original_stock = (
        db.query(StockPrevio)
        .filter(
            StockPrevio.escuela_id == seed.escuela_a.id,
            StockPrevio.ingrediente_id == seed.pan.id,
        )
        .first()
    )
    assert original_stock is not None
    assert original_stock.cantidad == Decimal("7.00")

    response = client.patch(
        f"/pedidos/{pedido.id}/items",
        headers=auth_headers(seed.user_admin),
        json={
            "items": [
                {
                    "escuela_id": seed.escuela_a.id,
                    "ingrediente_id": seed.pan.id,
                    "cantidad_final": 4,
                }
            ]
        },
    )

    assert response.status_code == 200
    snapshot = response.json()["datos_snapshot"]
    school_a = next(row for row in snapshot["escuelas"] if row["escuela_id"] == seed.escuela_a.id)
    school_b = next(row for row in snapshot["escuelas"] if row["escuela_id"] == seed.escuela_b.id)
    assert school_a["ingredientes"][0]["cantidad_final"] == "4.00"
    assert school_a["ingredientes"][0]["cantidad_contenido_final"] == "3600.00"
    assert school_a["ingredientes"][0]["costo_total"] == "50.00"
    assert school_b["ingredientes"][0]["cantidad_final"] == "3.00"
    assert school_a["ingredientes"][0]["stock_descontado"] == "7.00"

    provider_item = snapshot["proveedores"][0]["ingredientes"][0]
    assert provider_item["cantidad_total"] == "7.00"
    assert provider_item["cantidad_contenido_total"] == "6300.00"
    assert provider_item["costo_total"] == "87.50"
    assert provider_item["escuelas"][0]["cantidad"] == "4.00"
    assert snapshot["resumen_global"][0]["cantidad_total"] == "7.00"
    assert snapshot["resumen_global"][0]["costo_total"] == "87.50"
    assert snapshot["costo_total"] == "87.50"

    db.expire(original_stock)
    db.refresh(original_stock)
    assert original_stock.cantidad == Decimal("7.00")

    export = client.get(
        f"/pedidos/{pedido.id}/export/proveedores/excel",
        headers=auth_headers(seed.user_admin),
    )
    assert export.status_code == 200
    with zipfile.ZipFile(BytesIO(export.content)) as archive:
        workbook = load_workbook(BytesIO(archive.read(archive.namelist()[0])))
    rows = list(workbook.active.values)
    ingredient_row = next(row for row in rows if row and row[0] == seed.pan.nombre)
    assert ingredient_row[2:5] == ("4.00", "3.00", "7.00 (6.3 litros)")


@pytest.mark.parametrize("role", [UserRole.gestor, UserRole.escuela])
def test_non_admin_cannot_edit_order(role, client, db, seed, auth_headers):
    pedido = _create_regular_order(db, seed)
    if role == UserRole.escuela:
        user = seed.user_escuela_a
    else:
        user = seed.user_gestor

    response = client.patch(
        f"/pedidos/{pedido.id}/items",
        headers=auth_headers(user),
        json={
            "items": [
                {
                    "escuela_id": seed.escuela_a.id,
                    "ingrediente_id": seed.pan.id,
                    "cantidad_final": 4,
                }
            ]
        },
    )

    assert response.status_code == 403


def test_admin_cannot_edit_an_item_outside_order_snapshot(client, db, seed, auth_headers):
    pedido = _create_regular_order(db, seed)

    response = client.patch(
        f"/pedidos/{pedido.id}/items",
        headers=auth_headers(seed.user_admin),
        json={
            "items": [
                {
                    "escuela_id": seed.escuela_a.id,
                    "ingrediente_id": 99999,
                    "cantidad_final": 4,
                }
            ]
        },
    )

    assert response.status_code == 400
    db.refresh(pedido)
    assert pedido.datos_snapshot["costo_total"] == "62.50"


def test_admin_cannot_set_fractional_order_quantity(client, db, seed, auth_headers):
    pedido = _create_regular_order(db, seed)

    response = client.patch(
        f"/pedidos/{pedido.id}/items",
        headers=auth_headers(seed.user_admin),
        json={
            "items": [
                {
                    "escuela_id": seed.escuela_a.id,
                    "ingrediente_id": seed.pan.id,
                    "cantidad_final": 1.5,
                }
            ]
        },
    )

    assert response.status_code == 422
