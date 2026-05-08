from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Raíz del paquete backend (donde vive app/)
_BACKEND_DIR = Path(__file__).resolve().parents[2]
_DEFAULT_SQLITE_PATH = _BACKEND_DIR / "concejo_escolar.db"


class Settings(BaseSettings):
    APP_NAME: str = "Concejo Escolar API"
    API_PREFIX: str = "/api"

    # SQLite: ruta al archivo .db (relativa o absoluta)
    SQLITE_DATABASE_PATH: str = str(_DEFAULT_SQLITE_PATH)

    JWT_SECRET_KEY: str = "cambiar_esto_en_produccion"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Si no hay usuarios, crea el primer admin (solo desarrollo / primer arranque).
    FIRST_SUPERUSER_USERNAME: str | None = None
    FIRST_SUPERUSER_PASSWORD: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def database_url(self) -> str:
        # Tres barras = ruta relativa/absoluta al archivo
        return f"sqlite:///{self.SQLITE_DATABASE_PATH}"


settings = Settings()
