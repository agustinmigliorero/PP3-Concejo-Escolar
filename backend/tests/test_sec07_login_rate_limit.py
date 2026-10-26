"""SEC-07 · Fuerza bruta, password spraying y enumeración de usuarios.

Hallazgo SEC-07 del "Informe_Seguridad_SAE.docx" (OWASP A07 · CWE-307/204/208).
Cubre los cuatro tests asociados al hallazgo:

- test_sec07_login_inexistente_ejecuta_bcrypt
- test_sec07_bloqueo_por_ip_contra_password_spraying
- test_sec07_bloqueo_por_usuario
- test_sec07_mensaje_generico_para_usuario_y_password

Y cuatro guardas adicionales de los controles que introduce el parche
(login válido tras fallos, separación por proxy de confianza, rechazo de
X-Forwarded-For sin proxy de confianza y cota del diccionario en memoria).
"""

import bcrypt
import pytest
from fastapi.testclient import TestClient

from app.config import security
from app.main import app
from app.models.user_model import User, UserRole
from app.routes import auth_routes
from app.services import auth_service

IP_A = "10.10.0.1"
IP_B = "10.10.0.2"
USUARIO = "admin_sec07"
CLAVE = "ClaveSegura123"

# Límites que fija el informe de seguridad. Se escriben como literales (y no
# como constantes del módulo) para que cambiar la constante en el código no
# pueda dejar pasar un test: el contrato verificado es 20 por par y 30 por IP.
MAX_FALLOS_POR_PAR = 20
MAX_FALLOS_POR_IP = 30

DETALLE_GENERICO = "Usuario o contrasena incorrectos"
DETALLE_LIMITE = "Demasiados intentos fallidos. Espera unos minutos e intenta nuevamente."


@pytest.fixture()
def cliente_ip(db):
    """Cliente HTTP con IP controlable y contadores de login limpios.

    El cliente de Starlette acepta la IP del peer en `client=`, así que cada
    TestClient simula un origen distinto para el limitador.
    """
    db.add(
        User(
            username=USUARIO,
            password=security.hash_password(CLAVE),
            role=UserRole.admin,
        )
    )
    db.commit()

    # Los contadores viven en memoria del proceso: se limpian para que cada
    # test arranque de cero y no contamine al siguiente.
    auth_routes._login_attempts.clear()
    with TestClient(app, client=(IP_A, 40000)) as cliente:
        yield cliente
    auth_routes._login_attempts.clear()


@pytest.fixture()
def bcrypt_rapido(monkeypatch):
    """Sustituye la comparación bcrypt por una que siempre falla.

    Los tests de bloqueo solo necesitan que el login falle; el bcrypt real
    cuesta ~250 ms por intento y esos tests disparan decenas de intentos.
    El test que comprueba que bcrypt SÍ se ejecuta usa el bcrypt real.
    """

    def _checkpw(plain: bytes, hashed: bytes) -> bool:
        return False

    monkeypatch.setattr(bcrypt, "checkpw", _checkpw)


def test_sec07_login_inexistente_ejecuta_bcrypt(cliente_ip, monkeypatch):
    """Un usuario inexistente también debe pasar por bcrypt.

    Si el hash real no se calcula, la respuesta es mucho más rápida que la de
    un usuario existente y eso permite enumerar cuentas midiendo la latencia.
    """
    hashes_evaluados: list[str] = []
    verify_original = auth_service.verify_password

    def espia(plain: str, hashed: str) -> bool:
        hashes_evaluados.append(hashed)
        return verify_original(plain, hashed)

    monkeypatch.setattr(auth_service, "verify_password", espia)

    respuesta = cliente_ip.post(
        "/auth/login", json={"username": "no_existe_sec07", "password": "cualquiera"}
    )

    assert respuesta.status_code == 401
    assert hashes_evaluados, "no se ejecutó bcrypt para un usuario inexistente"
    assert hashes_evaluados[0] == security.DUMMY_PASSWORD_HASH


def test_sec07_bloqueo_por_usuario(cliente_ip, bcrypt_rapido):
    """Una misma cuenta se bloquea tras demasiados intentos fallidos."""
    for _ in range(MAX_FALLOS_POR_PAR):
        respuesta = cliente_ip.post(
            "/auth/login", json={"username": USUARIO, "password": "incorrecta"}
        )
        assert respuesta.status_code == 401

    respuesta = cliente_ip.post(
        "/auth/login", json={"username": USUARIO, "password": "incorrecta"}
    )

    assert respuesta.status_code == 429
    assert respuesta.json()["detail"] == DETALLE_LIMITE


def test_sec07_bloqueo_por_ip_contra_password_spraying(cliente_ip, bcrypt_rapido):
    """Una contraseña común contra muchas cuentas se bloquea por IP."""
    for intento in range(MAX_FALLOS_POR_IP):
        respuesta = cliente_ip.post(
            "/auth/login",
            json={"username": f"inexistente_{intento}", "password": "incorrecta"},
        )
        assert respuesta.status_code == 401

    respuesta = cliente_ip.post(
        "/auth/login", json={"username": "otro_usuario", "password": "incorrecta"}
    )
    assert respuesta.status_code == 429
    assert respuesta.json()["detail"] == DETALLE_LIMITE

    # El límite es por IP: otra IP no queda bloqueada por lo que hizo la otra.
    with TestClient(app, client=(IP_B, 40000)) as otro_cliente:
        respuesta = otro_cliente.post(
            "/auth/login", json={"username": USUARIO, "password": "incorrecta"}
        )
        assert respuesta.status_code == 401


def test_sec07_mensaje_generico_para_usuario_y_password(cliente_ip):
    """La respuesta es la misma exista o no el usuario, sin revelar cuál."""
    inexistente = cliente_ip.post(
        "/auth/login", json={"username": "no_existe_sec07", "password": "incorrecta"}
    )
    existente = cliente_ip.post(
        "/auth/login", json={"username": USUARIO, "password": "incorrecta"}
    )

    assert inexistente.status_code == 401
    assert existente.status_code == 401
    assert inexistente.json()["detail"] == existente.json()["detail"]
    assert inexistente.json()["detail"] == DETALLE_GENERICO
    assert "no_existe_sec07" not in inexistente.json()["detail"]
    assert USUARIO not in existente.json()["detail"]


def test_sec07_login_valido_tras_fallos(cliente_ip):
    """Un login correcto sigue funcionando después de intentos fallidos."""
    for _ in range(5):
        respuesta = cliente_ip.post(
            "/auth/login", json={"username": USUARIO, "password": "incorrecta"}
        )
        assert respuesta.status_code == 401

    respuesta = cliente_ip.post(
        "/auth/login", json={"username": USUARIO, "password": CLAVE}
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["access_token"]
    assert "HttpOnly" in respuesta.headers.get("set-cookie", "")


def test_sec07_proxy_de_confianza_separa_clientes(cliente_ip, bcrypt_rapido, monkeypatch):
    """Con un proxy de confianza, cada cliente real tiene su propia cuota."""
    monkeypatch.setattr(auth_routes.settings, "TRUSTED_PROXY_IPS", IP_A)

    for _ in range(MAX_FALLOS_POR_PAR):
        respuesta = cliente_ip.post(
            "/auth/login",
            json={"username": USUARIO, "password": "incorrecta"},
            headers={"X-Forwarded-For": "198.51.100.10"},
        )
        assert respuesta.status_code == 401

    # Otro cliente real detrás del mismo proxy no hereda el bloqueo.
    respuesta = cliente_ip.post(
        "/auth/login",
        json={"username": USUARIO, "password": "incorrecta"},
        headers={"X-Forwarded-For": "198.51.100.11"},
    )

    assert respuesta.status_code == 401


def test_sec07_x_forwarded_for_se_ignora_sin_proxy_de_confianza(
    cliente_ip, bcrypt_rapido, monkeypatch
):
    """Sin proxy de confianza, la cabecera no sirve para falsear la IP."""
    monkeypatch.setattr(auth_routes.settings, "TRUSTED_PROXY_IPS", "")

    for _ in range(MAX_FALLOS_POR_PAR):
        respuesta = cliente_ip.post(
            "/auth/login",
            json={"username": USUARIO, "password": "incorrecta"},
            headers={"X-Forwarded-For": "198.51.100.10"},
        )
        assert respuesta.status_code == 401

    # La cabecera se ignora: el par sigue agotado para la IP real del peer.
    respuesta = cliente_ip.post(
        "/auth/login",
        json={"username": USUARIO, "password": "incorrecta"},
        headers={"X-Forwarded-For": "198.51.100.11"},
    )

    assert respuesta.status_code == 429


def test_sec07_diccionario_de_intentos_acotado():
    """El contador en memoria no crece sin tope con nombres aleatorios."""
    auth_routes._login_attempts.clear()
    ahora = auth_routes.monotonic()
    for indice in range(auth_routes._LOGIN_MAX_TRACKED_KEYS + 500):
        auth_routes._login_attempts[f"pair:10.0.0.1:usuario_{indice}"] = [ahora]

    auth_routes._bound_tracked_keys(ahora)

    assert len(auth_routes._login_attempts) <= auth_routes._LOGIN_MAX_TRACKED_KEYS
    auth_routes._login_attempts.clear()
