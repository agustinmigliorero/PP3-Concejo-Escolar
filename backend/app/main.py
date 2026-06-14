from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.config.database import Base, engine
from app.config.settings import settings
from app.routes import (
    asignacion_proveedor_routes,
    auth_routes,
    ingrediente_routes,
    localidad_routes,
    menu_routes,
    pedido_routes,
    proveedor_routes,
    receta_routes,
    temporada_routes,
    tipo_comida_routes,
    stock_previo_routes,
    user_routes,
    school_routes,
)

# Register models so SQLAlchemy creates their tables
import app.models.asignacion_proveedor_model  # noqa: F401
import app.models.ingrediente_model  # noqa: F401
import app.models.location_model  # noqa: F401
import app.models.pedido_model  # noqa: F401
import app.models.proveedor_model  # noqa: F401
import app.models.receta_model  # noqa: F401
import app.models.refresh_token_model  # noqa: F401
import app.models.school_model  # noqa: F401
import app.models.stock_previo_model  # noqa: F401
import app.models.temporada_model  # noqa: F401
import app.models.tipo_comida_model  # noqa: F401
import app.models.user_model  # noqa: F401

app = FastAPI(title="Concejo Escolar API")

origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _migrate_sqlite(conn) -> None:
    """Add any columns present in the ORM models but missing from existing tables.

    Solo puede agregar columnas nuevas (idealmente nullable o con default). Un
    cambio de esquema incompatible (p. ej. una columna NOT NULL sin default, o
    una columna que se renombro) no se puede aplicar in-place en SQLite: en ese
    caso hay que resetear la base y re-seedear.
    """
    for table in Base.metadata.sorted_tables:
        rows = conn.execute(
            text(f"PRAGMA table_info({table.name})")
        ).fetchall()
        if not rows:
            continue
        existing = {row[1] for row in rows}
        for col in table.columns:
            if col.name not in existing:
                col_type = col.type.compile(engine.dialect)
                nullable = "" if col.nullable else " NOT NULL"
                default = ""
                if col.default is not None and col.default.is_scalar:
                    val = col.default.arg
                    default = f" DEFAULT {int(val) if isinstance(val, bool) else repr(val)}"
                try:
                    conn.execute(
                        text(
                            f"ALTER TABLE {table.name} ADD COLUMN {col.name} {col_type}{nullable}{default}"
                        )
                    )
                except OperationalError as exc:
                    raise RuntimeError(
                        f"No se pudo agregar la columna '{col.name}' a la tabla existente "
                        f"'{table.name}' ({exc.orig}). Es un cambio de esquema incompatible "
                        "para una base ya creada (este proyecto no usa migraciones). "
                        "Reseteá la base y re-seedeá: borrá el volumen/archivo .db y volvé "
                        "a correr seed.py y seed_data.py (ver README -> 'Base de datos y "
                        "primer usuario')."
                    ) from exc


@app.on_event("startup")
def create_tables() -> None:
    with engine.connect() as conn:
        Base.metadata.create_all(bind=engine)
        _migrate_sqlite(conn)
        conn.commit()


app.include_router(auth_routes.router)
app.include_router(user_routes.router)
app.include_router(localidad_routes.router)
app.include_router(school_routes.router)
app.include_router(ingrediente_routes.router)
app.include_router(proveedor_routes.router)
app.include_router(asignacion_proveedor_routes.router)
app.include_router(receta_routes.router)
app.include_router(temporada_routes.router)
app.include_router(tipo_comida_routes.router)
app.include_router(menu_routes.router)
app.include_router(stock_previo_routes.router)
app.include_router(pedido_routes.router)


@app.get("/")
def read_root():
    return {"nombre": "Juan"}
