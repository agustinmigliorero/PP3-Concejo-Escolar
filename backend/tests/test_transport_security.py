"""SEC-03: configuracion, cookies y transporte simulado sin certificado real."""

from http.cookies import SimpleCookie

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from pydantic import ValidationError
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.config.security import hash_password
from app.config.settings import Settings, settings
from app.main import app


@pytest.mark.parametrize("environment", ["production", "PRODUCTION", " production "])
def test_production_rejects_insecure_cookie(environment):
    with pytest.raises(ValidationError, match="REFRESH_COOKIE_SECURE"):
        Settings(_env_file=None, ENVIRONMENT=environment, REFRESH_COOKIE_SECURE=False)


def test_production_accepts_secure_cookie():
    config = Settings(_env_file=None, ENVIRONMENT="production", REFRESH_COOKIE_SECURE=True)
    assert config.ENVIRONMENT == "production"


def test_unknown_environment_cannot_bypass_production_validation():
    with pytest.raises(ValidationError, match="ENVIRONMENT"):
        Settings(_env_file=None, ENVIRONMENT="prodution", REFRESH_COOKIE_SECURE=False)


def test_development_accepts_http():
    config = Settings(_env_file=None, ENVIRONMENT="development", REFRESH_COOKIE_SECURE=False)
    assert config.REFRESH_COOKIE_SECURE is False


def _refresh_cookie(response):
    cookies = SimpleCookie()
    cookies.load(response.headers["set-cookie"])
    return cookies["refresh_token"]


def _assert_cookie_attributes(cookie, secure, domain):
    assert bool(cookie["secure"]) is secure
    assert cookie["httponly"]
    assert cookie["samesite"] == "lax"
    assert cookie["path"] == "/"
    assert cookie["domain"] == domain


@pytest.mark.parametrize(
    "environment,base_url,secure,domain",
    [
        ("development", "http://testserver", False, ""),
        ("production", "https://api.example.test", True, ".example.test"),
    ],
)
def test_login_refresh_logout_preserve_cookie_security(
    seed, db, monkeypatch, environment, base_url, secure, domain
):
    monkeypatch.setattr(settings, "ENVIRONMENT", environment)
    monkeypatch.setattr(settings, "REFRESH_COOKIE_SECURE", secure)
    monkeypatch.setattr(settings, "REFRESH_COOKIE_DOMAIN", domain)
    seed.user_admin.password = hash_password("Clave-solo-para-tests-2026")
    db.commit()

    with TestClient(app, base_url=base_url) as browser:
        login = browser.post("/auth/login", json={
            "username": seed.user_admin.username,
            "password": "Clave-solo-para-tests-2026",
        })
        assert login.status_code == 200
        login_cookie = _refresh_cookie(login)
        _assert_cookie_attributes(login_cookie, secure, domain)
        assert int(login_cookie["max-age"]) > 0
        assert browser.get("/auth/me", headers={
            "Authorization": f"Bearer {login.json()['access_token']}"
        }).status_code == 200

        refresh = browser.post("/auth/refresh")
        assert refresh.status_code == 200
        rotated_cookie = _refresh_cookie(refresh)
        _assert_cookie_attributes(rotated_cookie, secure, domain)
        assert rotated_cookie.value != login_cookie.value

        logout = browser.post("/auth/logout")
        assert logout.status_code == 200
        deleted_cookie = _refresh_cookie(logout)
        _assert_cookie_attributes(deleted_cookie, secure, domain)
        assert deleted_cookie["max-age"] == "0"
        assert not browser.cookies.get("refresh_token")
        assert browser.post("/auth/refresh").status_code == 401
        # La sesion tambien se revoca en el servidor, no solo en el navegador.
        assert browser.post("/auth/refresh", headers={
            "Cookie": f"refresh_token={rotated_cookie.value}"
        }).status_code == 401


def test_secure_cookie_is_not_sent_over_http(seed, db, monkeypatch):
    monkeypatch.setattr(settings, "REFRESH_COOKIE_SECURE", True)
    monkeypatch.setattr(settings, "REFRESH_COOKIE_DOMAIN", "")
    seed.user_admin.password = hash_password("Clave-solo-para-tests-2026")
    db.commit()
    with TestClient(app, base_url="https://api.example.test") as browser:
        assert browser.post("/auth/login", json={
            "username": seed.user_admin.username,
            "password": "Clave-solo-para-tests-2026",
        }).status_code == 200
        browser.base_url = "http://api.example.test"
        response = browser.post("/auth/refresh")
        assert response.status_code == 401
        assert response.json()["detail"] == "No hay sesion activa"


def test_invalid_refresh_deletes_cookie_with_secure_attributes(client, monkeypatch):
    monkeypatch.setattr(settings, "REFRESH_COOKIE_SECURE", True)
    monkeypatch.setattr(settings, "REFRESH_COOKIE_DOMAIN", ".example.test")
    response = client.post("/auth/refresh", headers={"Cookie": "refresh_token=invalido"})
    assert response.status_code == 401
    cookie = _refresh_cookie(response)
    _assert_cookie_attributes(cookie, True, ".example.test")
    assert cookie["max-age"] == "0"


@pytest.mark.parametrize("path,status", [("/", 200), ("/auth/me", 401), ("/inexistente", 404)])
def test_production_https_responses_include_hsts(seed, monkeypatch, path, status):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    with TestClient(app, base_url="https://api.example.test") as browser:
        response = browser.get(path)
        assert response.status_code == status
        assert response.headers["strict-transport-security"] == "max-age=31536000"


@pytest.mark.parametrize(
    "environment,base_url", [("development", "http://testserver"),
                              ("development", "https://testserver"),
                              ("production", "http://testserver")],
)
def test_hsts_is_not_emitted_on_http_or_in_development(seed, monkeypatch, environment, base_url):
    monkeypatch.setattr(settings, "ENVIRONMENT", environment)
    with TestClient(app, base_url=base_url) as browser:
        response = browser.get("/", headers={"X-Forwarded-Proto": "https"})
        assert "strict-transport-security" not in response.headers


@pytest.mark.parametrize("peer,trusted", [("10.20.0.2", True), ("203.0.113.10", False)])
def test_uvicorn_only_accepts_forwarded_headers_from_trusted_proxy(peer, trusted):
    probe = FastAPI()

    @probe.get("/")
    def request_info(request: Request):
        return {"scheme": request.url.scheme, "client": request.client.host}

    behind_proxy = ProxyHeadersMiddleware(probe, trusted_hosts="10.20.0.2")
    with TestClient(behind_proxy, client=(peer, 50000)) as browser:
        response = browser.get("/", headers={
            "X-Forwarded-Proto": "https", "X-Forwarded-For": "198.51.100.20",
        })
    assert response.json() == {
        "scheme": "https" if trusted else "http",
        "client": "198.51.100.20" if trusted else peer,
    }
