"""El rol escuela ve el historial de pedidos de su escuela con el proveedor de
cada articulo, pero sin precios ni costos, y solo descarga el PDF de su escuela.

Ver docs/requerimientos.md, seccion 5.12.
"""

import json
from datetime import date
from unittest.mock import patch

import pytest

from app.models.pedido_model import GeneracionPedido

PRECIO = "987654.32"
COSTO_ESCUELA = "1975308.64"
COSTO_TOTAL = "3950617.28"
PROVEEDOR = "Proveedor Prueba SA"


def _snapshot(escuela_a_id: int, escuela_b_id: int) -> dict:
    def item():
        return {
            "ingrediente_id": 1,
            "ingrediente_nombre": "Aceite",
            "unidad_final": "unidades",
            "localidad_id": 1,
            "localidad_nombre": "Localidad Test",
            "proveedor_id": 1,
            "proveedor_nombre": PROVEEDOR,
            "precio_unitario": PRECIO,
            "cantidad_final": "2.00",
            "costo_total": COSTO_ESCUELA,
        }

    def escuela(escuela_id, codigo, nombre):
        return {
            "escuela_id": escuela_id,
            "codigo": codigo,
            "nombre": nombre,
            "localidad_id": 1,
            "localidad_nombre": "Localidad Test",
            "ingredientes": [item()],
        }

    return {
        "tipo": "REGULAR",
        "semana_inicio": "2026-10-12",
        "dias_habiles": [1],
        "escuelas": [
            escuela(escuela_a_id, "EA-TEST", "Escuela A"),
            escuela(escuela_b_id, "EB-TEST", "Escuela B"),
        ],
        "proveedores": [
            {
                "proveedor_id": 1,
                "proveedor_nombre": PROVEEDOR,
                "localidad_id": 1,
                "localidad_nombre": "Localidad Test",
                "ingredientes": [
                    {
                        "ingrediente_id": 1,
                        "ingrediente_nombre": "Aceite",
                        "unidad": "unidades",
                        "precio_unitario": PRECIO,
                        "cantidad_total": "5.00",
                        "costo_total": COSTO_TOTAL,
                        "escuelas": [
                            {"escuela_id": escuela_a_id, "escuela_codigo": "EA-TEST",
                             "escuela_nombre": "Escuela A", "cantidad": "2.00"},
                            {"escuela_id": escuela_b_id, "escuela_codigo": "EB-TEST",
                             "escuela_nombre": "Escuela B", "cantidad": "3.00"},
                        ],
                    }
                ],
            }
        ],
        "advertencias": [],
        "resumen_global": [
            {"ingrediente_id": 1, "precio_unitario": PRECIO, "costo_total": COSTO_TOTAL},
        ],
        "costo_total": COSTO_TOTAL,
    }


def _crear_pedido(db, seed, snapshot, semana=date(2026, 10, 12)):
    pedido = GeneracionPedido(
        tipo="REGULAR",
        semana_inicio=semana,
        opcion_menu_id=1,
        dias_habiles=json.dumps([1]),
        generado_por_id=seed.user_admin.id,
        datos_snapshot=snapshot,
    )
    db.add(pedido)
    db.commit()
    db.refresh(pedido)
    return pedido


@pytest.fixture()
def pedido(db, seed):
    return _crear_pedido(db, seed, _snapshot(seed.escuela_a.id, seed.escuela_b.id))


def _claves(value):
    if isinstance(value, dict):
        for key, item in value.items():
            yield key
            yield from _claves(item)
    elif isinstance(value, list):
        for item in value:
            yield from _claves(item)


@pytest.mark.parametrize("ruta", ["/pedidos", "/pedidos/{id}"])
def test_escuela_ve_proveedor_pero_no_precios_ni_costos(client, seed, auth_headers, pedido, ruta):
    res = client.get(ruta.format(id=pedido.id), headers=auth_headers(seed.user_escuela_a))
    assert res.status_code == 200
    assert PRECIO not in res.text
    assert COSTO_ESCUELA not in res.text
    assert COSTO_TOTAL not in res.text
    assert PROVEEDOR in res.text

    data = res.json()
    snapshot = (data[0] if isinstance(data, list) else data)["datos_snapshot"]
    claves = set(_claves(snapshot))
    assert "precio_unitario" not in claves
    assert "costo_total" not in claves
    assert snapshot["resumen_global"] == []
    assert [s["escuela_id"] for s in snapshot["escuelas"]] == [seed.escuela_a.id]


def test_escuela_no_ve_cantidades_de_otras_escuelas(client, seed, auth_headers, pedido):
    res = client.get(f"/pedidos/{pedido.id}", headers=auth_headers(seed.user_escuela_a))
    ingrediente = res.json()["datos_snapshot"]["proveedores"][0]["ingredientes"][0]
    assert [row["escuela_id"] for row in ingrediente["escuelas"]] == [seed.escuela_a.id]
    # El total del proveedor se recalcula solo con la escuela (2), no 2 + 3.
    assert ingrediente["cantidad_total"] == "2.00"
    assert "EB-TEST" not in res.text


def test_admin_sigue_viendo_precios(client, seed, auth_headers, pedido):
    res = client.get(f"/pedidos/{pedido.id}", headers=auth_headers(seed.user_admin))
    assert res.status_code == 200
    assert PRECIO in res.text
    assert res.json()["datos_snapshot"]["costo_total"] == COSTO_TOTAL


@pytest.mark.parametrize(
    "ruta",
    [
        "export/excel",
        "export/pdf",
        "export/proveedores/excel",
        "export/proveedores/pdf",
        "export/proveedores/excel?incluir_precios=false",
        "export/proveedores/pdf?incluir_precios=false",
        "export/localidades/pdf",
        "export/escuelas/pdf",
    ],
)
def test_escuela_no_accede_a_exportaciones_del_consejo(client, seed, auth_headers, pedido, ruta):
    res = client.get(f"/pedidos/{pedido.id}/{ruta}", headers=auth_headers(seed.user_escuela_a))
    assert res.status_code == 403


def test_escuela_descarga_pdf_de_su_escuela_sin_precios(client, seed, auth_headers, pedido):
    with patch("reportlab.rl_config.pageCompression", 0):
        res = client.get(
            f"/pedidos/{pedido.id}/export/mi-escuela/pdf",
            headers=auth_headers(seed.user_escuela_a),
        )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert "pedido_EA-TEST_2026-10-12.pdf" in res.headers["content-disposition"]
    contenido = res.content
    assert b"Aceite" in contenido
    assert PROVEEDOR.encode() in contenido
    assert b"EA-TEST" in contenido
    assert b"EB-TEST" not in contenido
    assert PRECIO.encode() not in contenido
    assert COSTO_ESCUELA.encode() not in contenido
    assert b"Precio" not in contenido
    assert b"Costo" not in contenido


def test_pdf_mi_escuela_es_solo_para_rol_escuela(client, seed, auth_headers, pedido):
    res = client.get(f"/pedidos/{pedido.id}/export/mi-escuela/pdf", headers=auth_headers(seed.user_admin))
    assert res.status_code == 403


def test_escuela_no_descarga_pdf_de_pedido_ajeno(client, seed, db, auth_headers):
    snapshot = _snapshot(seed.escuela_b.id, seed.escuela_b.id)
    snapshot["escuelas"] = snapshot["escuelas"][1:]
    ajeno = _crear_pedido(db, seed, snapshot, semana=date(2026, 10, 19))
    headers = auth_headers(seed.user_escuela_a)
    assert client.get(f"/pedidos/{ajeno.id}", headers=headers).status_code == 403
    assert client.get(f"/pedidos/{ajeno.id}/export/mi-escuela/pdf", headers=headers).status_code == 403
    assert all(p["id"] != ajeno.id for p in client.get("/pedidos", headers=headers).json())
