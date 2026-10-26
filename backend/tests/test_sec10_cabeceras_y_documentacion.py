"""SEC-10 · Documentación de la API pública y ausencia de cabeceras de seguridad.

Hallazgo SEC-10 del "Informe_Seguridad_SAE.docx" (OWASP A05 · CWE-1021/693).
Cubre los tres tests asociados al hallazgo:

- test_sec10_documentacion_api_deshabilitada (3 rutas)
- test_sec10_cabeceras_de_seguridad
- test_sec10_cors_rechaza_origen_no_permitido

Y tres guardas de lo que el parche NO puede romper: el origen configurado
sigue permitido, el HSTS aparece solo con la cookie de refresh por HTTPS y
el CORS queda acotado a los metodos y headers que el frontend usa de verdad.
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit

import pytest
from fastapi.testclient import TestClient

from app.config.settings import settings
from app.main import app

ORIGEN_PERMITIDO = "http://localhost:3000"
ORIGEN_NO_PERMITIDO = "https://evil.example"
RAIZ_BACKEND = Path(__file__).resolve().parents[1]


@pytest.fixture()
def cliente():
    """Cliente HTTP sobre la app real (el startup crea el schema en memoria)."""
    with TestClient(app) as test_client:
        yield test_client


def test_sec10_documentacion_api_deshabilitada(cliente):
    """Sin ENABLE_API_DOCS, /docs, /redoc y /openapi.json no se publican.

    Swagger expone el mapa completo de la API (rutas, esquemas y roles), lo
    que acelera el reconocimiento por un atacante.
    """
    for ruta in ("/docs", "/redoc", "/openapi.json"):
        respuesta = cliente.get(ruta)
        assert respuesta.status_code == 404, f"{ruta} sigue expuesto"


def test_sec10_cabeceras_de_seguridad(cliente):
    """Toda respuesta debe llevar las cabeceras de endurecimiento."""
    respuesta = cliente.get("/")
    assert respuesta.status_code == 200

    encabezados = respuesta.headers
    assert encabezados["X-Content-Type-Options"] == "nosniff"
    assert encabezados["X-Frame-Options"] == "DENY"
    assert encabezados["Referrer-Policy"] == "no-referrer"
    assert "frame-ancestors 'none'" in encabezados["Content-Security-Policy"]
    assert encabezados["Cache-Control"] == "no-store"

    # HSTS solo tiene sentido si la cookie de refresh ya viaja por HTTPS.
    assert "Strict-Transport-Security" not in encabezados


def test_sec10_hsts_cuando_la_cookie_va_por_https(cliente, monkeypatch):
    """Con REFRESH_COOKIE_SECURE activo debe aparecer HSTS."""
    monkeypatch.setattr(settings, "REFRESH_COOKIE_SECURE", True)

    respuesta = cliente.get("/")

    hsts = respuesta.headers["Strict-Transport-Security"]
    assert "max-age=31536000" in hsts
    assert "includeSubDomains" in hsts


def test_sec10_cors_rechaza_origen_no_permitido(cliente):
    """Un origin fuera de CORS_ORIGINS no puede leer las respuestas."""
    # Peticion simple: el servidor responde, pero sin access-control-allow-origin
    # el navegador bloquea la lectura. Ese header ausente es el contrato.
    respuesta = cliente.get("/", headers={"Origin": ORIGEN_NO_PERMITIDO})
    assert "access-control-allow-origin" not in respuesta.headers

    # Preflight: el propio backend lo rechaza con 400.
    preflight = cliente.options(
        "/",
        headers={
            "Origin": ORIGEN_NO_PERMITIDO,
            "Access-Control-Request-Method": "POST",
        },
    )
    assert preflight.status_code == 400
    assert "access-control-allow-origin" not in preflight.headers


def test_sec10_cors_permite_el_origen_configurado(cliente):
    """El origen declarado en CORS_ORIGINS debe seguir funcionando."""
    respuesta = cliente.get("/", headers={"Origin": ORIGEN_PERMITIDO})

    assert respuesta.headers["access-control-allow-origin"] == ORIGEN_PERMITIDO
    assert respuesta.headers["access-control-allow-credentials"] == "true"


def test_sec10_cors_acota_metodos_y_headers(cliente):
    """CORS deja de aceptar cualquier metodo y cualquier header."""
    permitido = cliente.options(
        "/",
        headers={
            "Origin": ORIGEN_PERMITIDO,
            "Access-Control-Request-Method": "DELETE",
            "Access-Control-Request-Headers": "authorization, content-type",
        },
    )
    assert permitido.status_code == 200
    assert "DELETE" in permitido.headers["access-control-allow-methods"]

    metodo_no_permitido = cliente.options(
        "/",
        headers={
            "Origin": ORIGEN_PERMITIDO,
            "Access-Control-Request-Method": "TRACE",
        },
    )
    assert metodo_no_permitido.status_code == 400

    header_no_permitido = cliente.options(
        "/",
        headers={
            "Origin": ORIGEN_PERMITIDO,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "x-cualquier-cosa",
        },
    )
    assert header_no_permitido.status_code == 400


def _documentacion_interactiva() -> dict:
    """Arranca la app en un subproceso con ENABLE_API_DOCS=true.

    Las rutas de documentacion se arman al importar la app, asi que no se
    pueden encender parcheando settings en el proceso de test.
    """
    codigo = """
import json
from fastapi.testclient import TestClient
from app.main import app

cliente = TestClient(app)
salida = {}
for ruta in ("/docs", "/redoc"):
    respuesta = cliente.get(ruta)
    salida[ruta] = {
        "status": respuesta.status_code,
        "csp": respuesta.headers.get("content-security-policy", ""),
        "html": respuesta.text,
    }
print(json.dumps(salida))
"""
    env = os.environ.copy()
    env["ENABLE_API_DOCS"] = "true"
    resultado = subprocess.run(
        [sys.executable, "-c", codigo],
        cwd=str(RAIZ_BACKEND),
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(resultado.stdout.strip().splitlines()[-1])


def _directivas(csp: str) -> dict[str, list[str]]:
    directivas: dict[str, list[str]] = {}
    for parte in csp.split(";"):
        campos = parte.split()
        if campos:
            directivas[campos[0]] = campos[1:]
    return directivas


def _permite(directivas: dict[str, list[str]], directiva: str, url: str) -> bool:
    partes = urlsplit(url)
    origen = f"{partes.scheme}://{partes.netloc}"
    permitidas = directivas.get(directiva, directivas.get("default-src", []))
    return origen in permitidas or "*" in permitidas


def _enlaces(html: str) -> list[tuple[str, str]]:
    """Devuelve (rel, href) de cada <link>, sin importar el orden de los atributos."""
    resultado: list[tuple[str, str]] = []
    for etiqueta in re.findall(r"<link[^>]*>", html, re.I):
        rel = re.search(r'rel=["\']([^"\']*)["\']', etiqueta, re.I)
        href = re.search(r'href=["\']([^"\']+)["\']', etiqueta, re.I)
        if rel and href:
            resultado.append((rel.group(1).lower(), href.group(1)))
    return resultado


def test_sec10_documentacion_interactiva_es_utilizable():
    """Con ENABLE_API_DOCS=true, Swagger y ReDoc tienen que poder renderizarse.

    La CSP de la API (default-src 'none') bloquearia los assets del CDN y el
    bootstrap inline de Swagger: la documentacion quedaria inservible aunque
    las rutas respondan 200.
    """
    documentacion = _documentacion_interactiva()

    for ruta in ("/docs", "/redoc"):
        datos = documentacion[ruta]
        assert datos["status"] == 200
        directivas = _directivas(datos["csp"])
        html = datos["html"]

        for url in re.findall(r'<script[^>]+src=["\']([^"\']+)', html, re.I):
            assert _permite(directivas, "script-src", url), (ruta, url)
        for rel, url in _enlaces(html):
            if "stylesheet" in rel:
                assert _permite(directivas, "style-src", url), (ruta, rel, url)
            elif "icon" in rel:
                assert _permite(directivas, "img-src", url), (ruta, rel, url)

        # El bootstrap inline de Swagger necesita 'unsafe-inline' en script-src.
        if re.search(r"<script(?![^>]*\bsrc=)[^>]*>", html, re.I):
            assert "'unsafe-inline'" in directivas.get("script-src", [])

        # Las Google Fonts que usa ReDoc se descargan de otro host.
        if "fonts.googleapis.com" in html:
            assert "https://fonts.gstatic.com" in directivas.get("font-src", [])

        # Swagger UI consulta por defecto un validador online externo: sin ese
        # origen en la CSP la peticion se bloquea en runtime (no aparece en el
        # HTML, asi que el analisis del markup no la detecta).
        assert "https://validator.swagger.io" in directivas.get("connect-src", [])
