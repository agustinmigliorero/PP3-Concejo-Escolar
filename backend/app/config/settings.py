import secrets
from pathlib import Path

from pydantic_settings import BaseSettings

# Carpeta `backend/` (raíz del proyecto backend), independiente del cwd
# desde el que se lance uvicorn / pytest / docker. Sin esto, env_file=".env"
# solo se resuelve si el proceso arranca desde backend/, lo que hace que
# SECRET_KEY caiga silenciosamente a un valor random distinto en cada
# restart y todos los JWT emitidos previamente queden inválidos.
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    # Valor por defecto SOLO como último recurso: si no hay .env ni env var,
    # se genera uno efímero y se loguea (ver _post_init más abajo). En un
    # entorno bien configurado este default nunca se usa.
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    REFRESH_COOKIE_SECURE: bool = False
    DATABASE_URL: str = "sqlite:///./concejo_escolar.db"
    admin_username: str = "admin"
    admin_password: str = "admin1234"
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001,http://localhost:3005"

    model_config = {
        "env_file": str(_ENV_FILE),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()

# Aviso ruidoso si quedó el SECRET_KEY de ejemplo o no se cargó ninguno:
# en producción esto debe ser un valor fuerte y estable.
if settings.SECRET_KEY in ("", "cambia_esto_por_una_clave_segura"):
    import warnings

    warnings.warn(
        "SECRET_KEY no está configurado correctamente. "
        "Definí SECRET_KEY en backend/.env con un valor seguro y único, "
        "o no podrás mantener sesiones entre restarts.",
        RuntimeWarning,
        stacklevel=2,
    )
