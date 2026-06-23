from pathlib import Path

from pydantic_settings import BaseSettings

# Carpeta `backend/` (raíz del proyecto backend), independiente del cwd
# desde el que se lance uvicorn / pytest / docker. Sin esto, env_file=".env"
# solo se resuelve si el proceso arranca desde backend/.
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"

# Valores que NO son una clave válida: vacío o el placeholder del .env.example.
# Si SECRET_KEY cae en alguno de estos, el backend se niega a arrancar (ver
# abajo) en vez de inventar una clave random distinta por worker/restart, que
# es lo que invalidaba los JWT y tiraba a los usuarios al login "de la nada".
_INSECURE_SECRET_KEYS = {"", "cambia_esto_por_una_clave_segura"}


class Settings(BaseSettings):
    # Obligatorio: debe venir del .env (dev) o de las env vars del contenedor
    # (Dokploy). Default "" para poder dar un error claro abajo en vez de un
    # ValidationError críptico de pydantic.
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    REFRESH_COOKIE_SECURE: bool = False
    # Dominio de la cookie de refresh. Vacío = host-only (dev local). En
    # producción, con front y back en subdominios distintos del mismo dominio
    # (ej. sae.* y api.*), poné el dominio padre con punto inicial para que la
    # cookie se comparta entre todos: ".agustinmigliorero.com".
    REFRESH_COOKIE_DOMAIN: str = ""
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

# Falla al arranque (en TODOS los workers por igual) si no hay una SECRET_KEY
# válida y estable. Sin esto, cada worker/restart firmaría los JWT con una
# clave distinta y las sesiones se perderían al azar.
if settings.SECRET_KEY in _INSECURE_SECRET_KEYS:
    raise RuntimeError(
        "SECRET_KEY no está configurado. Definilo en backend/.env (dev) o en "
        "las variables de entorno del contenedor (Dokploy). Generá uno seguro con:\n"
        "    python -c \"import secrets; print(secrets.token_urlsafe(32))\""
    )
