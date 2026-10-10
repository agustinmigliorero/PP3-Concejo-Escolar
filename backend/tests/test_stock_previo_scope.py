"""Scope tests for GET/PUT /stock-previo/me (school-stock-scope capability).

Maps 1:1 to the spec scenarios of openspec/changes/stock-sobrante-filtrar-cero:
read scope, menu independence, re-scoped fallback, empty state, atomic
write allow-list, global consumers unchanged, notification global and no
hide-0 filtering.
"""

from decimal import Decimal
from unittest.mock import patch

from app.models.ingrediente_model import Ingrediente
from app.models.receta_model import Receta, RecetaIngrediente
from app.models.stock_previo_model import StockPrevio
from app.models.temporada_model import DiaMenu, Temporada


def test_read_scope_returns_only_in_season_school_union(client, seed, db, auth_headers, json_items):
    # Guard for the "union not menu-narrowed" scenario: no seed receta is on
    # any DiaMenu, yet the scoped list still comes back (DD-1).
    assert db.query(DiaMenu).count() == 0

    res = client.get("/stock-previo/me", headers=auth_headers(seed.user_escuela_a))

    assert res.status_code == 200
    body = res.json()
    # union {azucar, pan, sal} INTERSECT season {pan, sal, pimienta}.
    assert [item["ingrediente_nombre"] for item in body["items"]] == ["pan", "sal"]
    assert "pimienta" not in json_items(body)  # other school's ingredient absent
    assert "azucar" not in json_items(body)  # receta without active temporada
    assert body["sin_recetas"] is False


def test_fallback_without_active_temporada_returns_school_union(client, seed, db, auth_headers):
    db.query(Temporada).update({"activo": False}, synchronize_session=False)
    db.commit()

    res = client.get("/stock-previo/me", headers=auth_headers(seed.user_escuela_a))

    assert res.status_code == 200
    names = [item["ingrediente_nombre"] for item in res.json()["items"]]
    assert names == ["azucar", "pan", "sal"]  # school union, not the global list
    assert "pimienta" not in names  # global-only ingredient never leaks in


def test_fallback_with_active_temporada_without_recetas(client, seed, db, auth_headers):
    db.query(Temporada).filter(Temporada.id == seed.verano.id).update(
        {"activo": False}, synchronize_session=False
    )
    db.query(Temporada).filter(Temporada.id == seed.invierno.id).update(
        {"activo": True}, synchronize_session=False
    )
    db.commit()

    res = client.get("/stock-previo/me", headers=auth_headers(seed.user_escuela_a))

    assert res.status_code == 200
    names = [item["ingrediente_nombre"] for item in res.json()["items"]]
    assert names == ["azucar", "pan", "sal"]  # season set empty -> union fallback
    assert "pimienta" not in names


def test_active_temporada_with_empty_intersection_returns_no_items(
    client, seed, db, auth_headers
):
    # DD-5: an active temporada EXISTS and its season set is non-empty, but
    # Escuela A's union {azucar, pan, sal} has zero overlap with it. Season
    # INVIERNO holds one real receta (Colacion) whose only ingredient is
    # pimienta, so the intersection is legitimately empty.
    db.query(Temporada).filter(Temporada.id == seed.verano.id).update(
        {"activo": False}, synchronize_session=False
    )
    db.query(Temporada).filter(Temporada.id == seed.invierno.id).update(
        {"activo": True}, synchronize_session=False
    )
    receta_invierno = Receta(
        nombre="Receta Invierno Colacion",
        temporadas=[seed.invierno],
        tipos_comida=[seed.escuela_b.tipos_comida[0]],
    )
    db.add(receta_invierno)
    db.commit()
    db.add(
        RecetaIngrediente(
            receta=receta_invierno,
            ingrediente=seed.pimienta,
            cantidad_por_porcion=Decimal("1"),
        )
    )
    db.commit()

    res = client.get("/stock-previo/me", headers=auth_headers(seed.user_escuela_a))

    assert res.status_code == 200
    body = res.json()
    # NOT the union fallback: that would return ["azucar", "pan", "sal"]
    # (two of them outside any season), and never the global list either.
    assert body["items"] == []
    assert body["sin_recetas"] is True


def test_school_without_recetas_returns_empty_items(client, seed, auth_headers):
    res = client.get("/stock-previo/me", headers=auth_headers(seed.user_escuela_c))

    assert res.status_code == 200
    body = res.json()
    assert body["items"] == []
    assert body["sin_recetas"] is True


def test_mixed_payload_put_rejects_atomically(client, seed, db, auth_headers):
    payload = {
        "items": [
            {"ingrediente_id": seed.pan.id, "cantidad": 5},
            {"ingrediente_id": seed.pimienta.id, "cantidad": 2},
        ]
    }

    res = client.put("/stock-previo/me", json=payload, headers=auth_headers(seed.user_escuela_a))

    assert res.status_code == 400
    assert "fuera del alcance" in res.json()["detail"]

    db.expire_all()
    rows = db.query(StockPrevio).filter(StockPrevio.escuela_id == seed.escuela_a.id).all()
    by_id = {row.ingrediente_id: row for row in rows}
    assert set(by_id) == {seed.pan.id}  # no pimienta row was created
    assert Decimal(str(by_id[seed.pan.id].cantidad)) == Decimal("7")  # pan unchanged


def test_in_scope_put_returns_scoped_response(client, seed, db, auth_headers):
    payload = {"items": [{"ingrediente_id": seed.pan.id, "cantidad": 5}]}

    res = client.put("/stock-previo/me", json=payload, headers=auth_headers(seed.user_escuela_a))

    assert res.status_code == 200
    body = res.json()
    assert [item["ingrediente_nombre"] for item in body["items"]] == ["pan", "sal"]
    assert body["sin_recetas"] is False

    db.expire_all()
    row = (
        db.query(StockPrevio)
        .filter(
            StockPrevio.escuela_id == seed.escuela_a.id,
            StockPrevio.ingrediente_id == seed.pan.id,
        )
        .one()
    )
    assert Decimal(str(row.cantidad)) == Decimal("5")


def test_admin_get_returns_identical_global_list_for_two_schools(client, seed, auth_headers):
    headers = auth_headers(seed.user_admin)
    res_a = client.get(f"/stock-previo/{seed.escuela_a.id}", headers=headers)
    res_b = client.get(f"/stock-previo/{seed.escuela_b.id}", headers=headers)

    assert res_a.status_code == 200
    assert res_b.status_code == 200
    items_a = res_a.json()["items"]
    items_b = res_b.json()["items"]
    # Same global ids in the same order: matrix columns stay aligned (D3).
    assert [item["ingrediente_id"] for item in items_a] == [
        item["ingrediente_id"] for item in items_b
    ]
    assert "pimienta" in [item["ingrediente_nombre"] for item in items_a]
    assert "sin_recetas" in res_a.json()  # additive field present, ignored by globals


def test_admin_put_accepts_out_of_scope_ingrediente(client, seed, db, auth_headers):
    # pimienta is outside Escuela A's scope; the admin/gestor path is global.
    payload = {"items": [{"ingrediente_id": seed.pimienta.id, "cantidad": 3}]}

    res = client.put(
        f"/stock-previo/{seed.escuela_a.id}",
        json=payload,
        headers=auth_headers(seed.user_admin),
    )

    assert res.status_code == 200
    db.expire_all()
    row = (
        db.query(StockPrevio)
        .filter(
            StockPrevio.escuela_id == seed.escuela_a.id,
            StockPrevio.ingrediente_id == seed.pimienta.id,
        )
        .one()
    )
    assert Decimal(str(row.cantidad)) == Decimal("3")


def test_notification_payload_stays_global(client, seed, auth_headers):
    payload = {"items": [{"ingrediente_id": seed.pan.id, "cantidad": 4}]}

    with patch(
        "app.services.stock_previo_service.notification_service.create_stock_notification"
    ) as create_notification:
        res = client.put(
            "/stock-previo/me", json=payload, headers=auth_headers(seed.user_escuela_a)
        )

    assert res.status_code == 200
    create_notification.assert_called_once()
    items = create_notification.call_args.kwargs["items"]
    # Notification items derive from the GLOBAL active list, even for PUT /me.
    assert {item["nombre"] for item in items} == {"azucar", "pan", "pimienta", "sal"}


def test_zero_cantidad_items_remain_visible(client, seed, auth_headers, json_items):
    res = client.get("/stock-previo/me", headers=auth_headers(seed.user_escuela_a))

    assert res.status_code == 200
    items = json_items(res.json())
    assert "sal" in items  # never got a stock row: quantity 0, still listed
    assert Decimal(str(items["sal"]["cantidad"])) == Decimal("0")
    assert Decimal(str(items["pan"]["cantidad"])) == Decimal("7")


def test_multi_temporada_receta_in_season_for_active_membership(
    client, seed, db, auth_headers
):
    # N:N: Pizza belongs to BOTH temporadas, so it is in season whichever
    # one is active. New ingredientes (nombre is globally unique) extend
    # Escuela A's union beyond the seed's {azucar, pan, sal}.
    harina = Ingrediente(nombre="harina", unidad_medida="kg", activo=True)
    queso = Ingrediente(nombre="queso", unidad_medida="kg", activo=True)
    db.add_all([harina, queso])
    db.commit()
    receta_pizza = Receta(
        nombre="Pizza",
        temporadas=[seed.verano, seed.invierno],
        tipos_comida=[seed.escuela_a.tipos_comida[0]],
    )
    db.add(receta_pizza)
    db.commit()
    db.add_all(
        [
            RecetaIngrediente(
                receta=receta_pizza,
                ingrediente=harina,
                cantidad_por_porcion=Decimal("1"),
            ),
            RecetaIngrediente(
                receta=receta_pizza,
                ingrediente=queso,
                cantidad_por_porcion=Decimal("1"),
            ),
        ]
    )
    db.commit()

    # VERANO active: Almuerzo (pan, sal) + Pizza (harina, queso) in season;
    # azucar stays out (no membership), pimienta stays out (other school).
    res = client.get("/stock-previo/me", headers=auth_headers(seed.user_escuela_a))

    assert res.status_code == 200
    names = [item["ingrediente_nombre"] for item in res.json()["items"]]
    assert names == ["harina", "pan", "queso", "sal"]

    # Switch active temporada: Pizza remains in season via INVIERNO membership.
    db.query(Temporada).filter(Temporada.id == seed.verano.id).update(
        {"activo": False}, synchronize_session=False
    )
    db.query(Temporada).filter(Temporada.id == seed.invierno.id).update(
        {"activo": True}, synchronize_session=False
    )
    db.commit()

    res = client.get("/stock-previo/me", headers=auth_headers(seed.user_escuela_a))

    assert res.status_code == 200
    names = [item["ingrediente_nombre"] for item in res.json()["items"]]
    assert names == ["harina", "queso"]
    assert "pimienta" not in names  # escuela B's ingredient never leaks in


def test_receta_without_temporada_membership_excluded(client, seed, db, auth_headers):
    papa = Ingrediente(nombre="papa", unidad_medida="kg", activo=True)
    db.add(papa)
    db.commit()
    receta_sin_membresia = Receta(
        nombre="Receta Sin Membresia Extra",
        temporadas=[],
        tipos_comida=[seed.escuela_a.tipos_comida[0]],
    )
    db.add(receta_sin_membresia)
    db.commit()
    db.add(
        RecetaIngrediente(
            receta=receta_sin_membresia,
            ingrediente=papa,
            cantidad_por_porcion=Decimal("1"),
        )
    )
    db.commit()

    res = client.get("/stock-previo/me", headers=auth_headers(seed.user_escuela_a))

    assert res.status_code == 200
    names = [item["ingrediente_nombre"] for item in res.json()["items"]]
    # Same contract as azucar (test_read_scope...): a union member with NO
    # temporada membership is out of season while one is active.
    assert names == ["pan", "sal"]
    assert "papa" not in names


def test_receta_non_active_temporada_excluded(client, seed, db, auth_headers):
    zapallo = Ingrediente(nombre="zapallo", unidad_medida="kg", activo=True)
    db.add(zapallo)
    db.commit()
    receta_guiso = Receta(
        nombre="Guiso",
        temporadas=[seed.invierno],
        tipos_comida=[seed.escuela_a.tipos_comida[0]],
    )
    db.add(receta_guiso)
    db.commit()
    db.add(
        RecetaIngrediente(
            receta=receta_guiso,
            ingrediente=zapallo,
            cantidad_por_porcion=Decimal("1"),
        )
    )
    db.commit()

    # VERANO active: Guiso's INVIERNO-only membership keeps zapallo out.
    res = client.get("/stock-previo/me", headers=auth_headers(seed.user_escuela_a))

    assert res.status_code == 200
    names = [item["ingrediente_nombre"] for item in res.json()["items"]]
    assert names == ["pan", "sal"]
    assert "zapallo" not in names

    # Activate INVIERNO: Guiso becomes the only in-season escuela A receta.
    db.query(Temporada).filter(Temporada.id == seed.verano.id).update(
        {"activo": False}, synchronize_session=False
    )
    db.query(Temporada).filter(Temporada.id == seed.invierno.id).update(
        {"activo": True}, synchronize_session=False
    )
    db.commit()

    res = client.get("/stock-previo/me", headers=auth_headers(seed.user_escuela_a))

    assert res.status_code == 200
    names = [item["ingrediente_nombre"] for item in res.json()["items"]]
    assert names == ["zapallo"]  # no union fallback: season set is non-empty
