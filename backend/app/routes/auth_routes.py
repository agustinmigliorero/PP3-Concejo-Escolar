import ipaddress
from time import monotonic
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import settings
from app.controllers.auth_controller import LoginRequest, LoginResponse, RefreshResponse, UserInfo
from app.middlewares.auth_middleware import get_current_user
from app.models.user_model import User
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

_COOKIE_MAX_AGE = 7 * 24 * 60 * 60  # 7 days in seconds
_LOGIN_WINDOW_SECONDS = 10 * 60
_LOGIN_MAX_FAILURES = 20  # por IP + usuario: fuerza bruta contra una cuenta
_LOGIN_MAX_FAILURES_PER_IP = 30  # por IP: password spraying y enumeración
_LOGIN_MAX_TRACKED_KEYS = 10_000  # cota del diccionario de intentos en memoria

# Intentos fallidos, en memoria del proceso. Las claves llevan prefijo para que
# una IPv6 no colisione con un par IP+usuario:
#   "ip:<host>"       -> intentos fallidos totales de esa IP
#   "pair:<host>:<usuario>" -> intentos fallidos contra esa cuenta desde esa IP
_login_attempts: dict[str, list[float]] = {}


def _normalize_host(host: str) -> str:
    """Normaliza la IP para que la misma dirección no genere claves distintas."""
    try:
        return ipaddress.ip_address(host).compressed
    except ValueError:
        return host.strip().lower()


def _trusted_proxy_networks() -> tuple:
    """Redes/IP de proxy de confianza declaradas en TRUSTED_PROXY_IPS."""
    networks = []
    for raw in settings.TRUSTED_PROXY_IPS.split(","):
        entry = raw.strip()
        if not entry:
            continue
        try:
            networks.append(ipaddress.ip_network(entry, strict=False))
        except ValueError:
            continue
    return tuple(networks)


def _client_ip(request: Request) -> str:
    """IP del cliente que intenta iniciar sesión.

    Detrás de un proxy inverso (Traefik) `request.client` es el proxy, así que
    todos los usuarios comparten la misma IP y el límite por IP bloquearía a
    todo el mundo a la vez (SEC-07). Por eso se lee X-Forwarded-For, pero SOLO
    si el peer directo está en TRUSTED_PROXY_IPS: con la lista vacía (valor por
    defecto) no se confía en ninguna cabecera y un atacante no puede falsear
    su IP para esquivar el límite.
    """
    peer = request.client.host if request.client else "unknown"
    peer_ip = _normalize_host(peer)

    networks = _trusted_proxy_networks()
    if not networks:
        return peer_ip

    try:
        peer_address = ipaddress.ip_address(peer_ip)
    except ValueError:
        return peer_ip

    if not any(peer_address in network for network in networks):
        return peer_ip

    forwarded = request.headers.get("x-forwarded-for", "")
    first_forwarded = forwarded.split(",")[0].strip()
    return _normalize_host(first_forwarded) if first_forwarded else peer_ip


def _ip_key(ip: str) -> str:
    return f"ip:{ip}"


def _pair_key(ip: str, username: str) -> str:
    return f"pair:{ip}:{username.strip().lower()}"


def _prune_attempts(key: str, now: float) -> list[float]:
    attempts = [
        attempt
        for attempt in _login_attempts.get(key, [])
        if now - attempt < _LOGIN_WINDOW_SECONDS
    ]
    if attempts:
        _login_attempts[key] = attempts
    else:
        _login_attempts.pop(key, None)
    return attempts


def _enforce_login_rate_limit(request: Request, username: str) -> tuple[str, str]:
    """Aplica los límites de intentos fallidos y devuelve las claves a contar.

    - por IP + usuario: fuerza bruta dirigida contra una cuenta;
    - por IP: password spraying (una contraseña común contra muchas cuentas).
    """
    ip = _client_ip(request)
    ip_key = _ip_key(ip)
    pair_key = _pair_key(ip, username)

    now = monotonic()
    ip_attempts = _prune_attempts(ip_key, now)
    pair_attempts = _prune_attempts(pair_key, now)

    if (
        len(pair_attempts) >= _LOGIN_MAX_FAILURES
        or len(ip_attempts) >= _LOGIN_MAX_FAILURES_PER_IP
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos fallidos. Espera unos minutos e intenta nuevamente.",
        )
    return ip_key, pair_key


def _record_failed_login(ip_key: str, pair_key: str) -> None:
    now = monotonic()
    for key in (ip_key, pair_key):
        attempts = _prune_attempts(key, now)
        attempts.append(now)
        _login_attempts[key] = attempts
    _bound_tracked_keys(now)


def _bound_tracked_keys(now: float) -> None:
    """Impide que el diccionario en memoria crezca sin tope.

    Probar nombres de usuario aleatorios genera una clave por intento; sin
    esta cota el proceso termina guardando miles de entradas (SEC-07).
    """
    if len(_login_attempts) <= _LOGIN_MAX_TRACKED_KEYS:
        return

    expired = [
        key
        for key, attempts in _login_attempts.items()
        if not any(now - attempt < _LOGIN_WINDOW_SECONDS for attempt in attempts)
    ]
    for key in expired:
        _login_attempts.pop(key, None)

    while len(_login_attempts) > _LOGIN_MAX_TRACKED_KEYS:
        oldest = min(_login_attempts, key=lambda key: _login_attempts[key][-1])
        _login_attempts.pop(oldest, None)


def _clear_login_attempts(pair_key: str) -> None:
    """Limpia el contador de la cuenta tras un login exitoso.

    El contador por IP NO se limpia: si se limpiara, un único login válido
    reiniciaría el presupuesto de password spraying del atacante.
    """
    _login_attempts.pop(pair_key, None)


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.REFRESH_COOKIE_SECURE,
        domain=settings.REFRESH_COOKIE_DOMAIN or None,
        max_age=_COOKIE_MAX_AGE,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    # El domain/path deben coincidir con los del set_cookie o el navegador no
    # borra la cookie (quedaría una sesión "fantasma" tras el logout).
    response.delete_cookie(
        "refresh_token",
        path="/",
        domain=settings.REFRESH_COOKIE_DOMAIN or None,
    )


def _refresh_unauthorized(detail: object) -> JSONResponse:
    response = JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": detail})
    _clear_refresh_cookie(response)
    return response


@router.post("/login", response_model=LoginResponse)
def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    ip_key, pair_key = _enforce_login_rate_limit(request, body.username)
    try:
        result = auth_service.login(db, body.username, body.password)
    except HTTPException:
        _record_failed_login(ip_key, pair_key)
        raise

    _clear_login_attempts(pair_key)
    _set_refresh_cookie(response, result["refresh_token"])
    return LoginResponse(
        access_token=result["access_token"],
        user=UserInfo.model_validate(result["user"]),
    )


@router.post("/refresh", response_model=RefreshResponse)
def refresh(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
):
    if not refresh_token:
        return _refresh_unauthorized("No hay sesion activa")

    try:
        result = auth_service.refresh_access_token(db, refresh_token)
    except HTTPException as exc:
        return _refresh_unauthorized(exc.detail)

    if result.get("refresh_token"):
        _set_refresh_cookie(response, result["refresh_token"])
    return RefreshResponse(access_token=result["access_token"])


@router.post("/logout")
def logout(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
):
    if refresh_token:
        auth_service.logout(db, refresh_token)
    _clear_refresh_cookie(response)
    return {"message": "Sesion cerrada correctamente"}


@router.get("/me", response_model=UserInfo)
def me(current_user: User = Depends(get_current_user)):
    return current_user
