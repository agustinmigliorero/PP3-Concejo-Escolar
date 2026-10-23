from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.config.database import Base, engine
from app.config.settings import settings
from app.routes import (
    asignacion_proveedor_routes,
    auth_routes,
    evento_routes,
    ingrediente_routes,
    localidad_routes,
    menu_routes,
    patio_routes,
    notification_routes,
    pedido_routes,
    proveedor_routes,
    receta_routes,
    reporte_routes,
    temporada_routes,
    tipo_comida_routes,
    stock_previo_routes,
    user_routes,
    school_routes,
)

# Register models so SQLAlchemy creates their tables
import app.models.asignacion_proveedor_model  # noqa: F401
import app.models.asignacion_precio_historial_model  # noqa: F401
import app.models.evento_model  # noqa: F401
import app.models.ingrediente_model  # noqa: F401
import app.models.patio_model  # noqa: F401
import app.models.location_model  # noqa: F401
import app.models.notification_model  # noqa: F401
import app.models.pedido_model  # noqa: F401
import app.models.proveedor_model  # noqa: F401
import app.models.receta_model  # noqa: F401
import app.models.refresh_token_model  # noqa: F401
import app.models.school_model  # noqa: F401
import app.models.school_matriculation_model  # noqa: F401
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


@app.middleware("http")
async def add_transport_security_header(request: Request, call_next):
    response = await call_next(request)
    # El proxy inverso termina TLS. Uvicorn solo debe aceptar X-Forwarded-Proto de los
    # proxies configurados en FORWARDED_ALLOW_IPS, nunca de cualquier cliente.
    if settings.ENVIRONMENT == "production" and request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
    return response


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


def _backfill_receta_temporadas(conn) -> None:
    """Migra el antiguo FK recetas.temporada_id (relacion 1:N, una receta =
    una temporada) a la nueva tabla intermedia receta_temporadas (relacion
    N:N, una receta puede valer para varias temporadas, ej. "Pizza" en
    verano e invierno), preservando las asignaciones ya cargadas.

    La columna vieja 'temporada_id' queda en la tabla 'recetas' sin uso
    (SQLite no soporta DROP COLUMN con FK facilmente y este proyecto no usa
    migraciones), pero el modelo ORM ya no la referencia.
    """
    columnas = {
        row[1] for row in conn.execute(text("PRAGMA table_info(recetas)")).fetchall()
    }
    if "temporada_id" not in columnas:
        return

    conn.execute(
        text(
            """
            INSERT OR IGNORE INTO receta_temporadas (receta_id, temporada_id)
            SELECT id, temporada_id FROM recetas WHERE temporada_id IS NOT NULL
            """
        )
    )


# Tipos de comida que el esquema viejo guardaba como texto o como flags.
_LEGACY_FLAGS_ESCUELA = {
    "offers_breakfast": "DESAYUNO",
    "offers_lunch": "ALMUERZO",
    "offers_snack": "MERIENDA",
    "offers_dinner": "CENA",
}

# Valor con el que se completa una columna nueva NOT NULL a partir de la columna
# vieja equivalente, al reconstruir la tabla ("old" es la tabla vieja).
_LEGACY_FILL = {
    ("dias_menu", "tipo_comida_id"): (
        "tipo_comida",
        "(SELECT t.id FROM tipos_comida t WHERE UPPER(t.nombre) = UPPER(old.tipo_comida))",
    ),
}


def _columnas(conn, tabla: str) -> dict:
    return {
        row[1]: row
        for row in conn.execute(text(f"PRAGMA table_info({tabla})")).fetchall()
    }


def _asegurar_tipo_comida(conn, nombre: str) -> None:
    conn.execute(
        text(
            """
            INSERT INTO tipos_comida (nombre, activo)
            SELECT :nombre, 1
            WHERE NOT EXISTS (
                SELECT 1 FROM tipos_comida WHERE UPPER(nombre) = UPPER(:nombre)
            )
            """
        ),
        {"nombre": nombre},
    )


def _backfill_tipos_comida_legacy(conn) -> None:
    """Pasa los tipos de comida del esquema viejo (texto o flags) a las tablas
    nuevas, antes de que la reconstruccion borre esas columnas. Idempotente."""
    for tabla in ("recetas", "dias_menu"):
        if "tipo_comida" in _columnas(conn, tabla):
            for (nombre,) in conn.execute(
                text(f"SELECT DISTINCT UPPER(tipo_comida) FROM {tabla} WHERE tipo_comida IS NOT NULL")
            ).fetchall():
                _asegurar_tipo_comida(conn, nombre)

    if "tipo_comida" in _columnas(conn, "recetas"):
        conn.execute(
            text(
                """
                INSERT OR IGNORE INTO receta_tipos_comida (receta_id, tipo_comida_id)
                SELECT r.id, t.id
                FROM recetas r
                JOIN tipos_comida t ON UPPER(t.nombre) = UPPER(r.tipo_comida)
                """
            )
        )

    cols_escuela = _columnas(conn, "schools")
    for flag, nombre in _LEGACY_FLAGS_ESCUELA.items():
        if flag not in cols_escuela:
            continue
        if conn.execute(text(f"SELECT 1 FROM schools WHERE {flag} = 1 LIMIT 1")).first():
            _asegurar_tipo_comida(conn, nombre)
            conn.execute(
                text(
                    f"""
                    INSERT OR IGNORE INTO school_tipos_comida (school_id, tipo_comida_id)
                    SELECT s.id, t.id
                    FROM schools s
                    JOIN tipos_comida t ON UPPER(t.nombre) = :nombre
                    WHERE s.{flag} = 1
                    """
                ),
                {"nombre": nombre},
            )


def _necesita_reconstruir(tabla, existentes: dict) -> bool:
    """True si la tabla tiene un cambio que ALTER TABLE ADD COLUMN no resuelve:
    una columna vieja NOT NULL sin default que el modelo ya no conoce (rompe
    todos los INSERT), o una columna nueva NOT NULL sin default."""
    modelo = {col.name: col for col in tabla.columns}
    for nombre, row in existentes.items():
        notnull, default, pk = row[3], row[4], row[5]
        if nombre not in modelo and notnull and default is None and not pk:
            return True
    for nombre, col in modelo.items():
        if nombre not in existentes and not col.nullable:
            if col.default is None or not col.default.is_scalar:
                return True
    return False


def _rebuild_legacy_tables(conn) -> None:
    """Reconstruye las tablas con esquema viejo incompatible.

    SQLite no permite quitar un NOT NULL ni borrar columnas facilmente, asi que
    se crea la tabla con el esquema exacto del modelo, se copian los datos
    (mismos id, para no romper FKs de otras tablas), se borra la vieja y se
    renombra la nueva. Las columnas nuevas NOT NULL se completan desde la
    columna vieja equivalente (_LEGACY_FILL) o con el default del modelo. Filas
    que igual no cumplen las restricciones se descartan y se informa cuantas.
    En una base ya actualizada no hace nada.
    """
    from sqlalchemy.schema import CreateTable

    for tabla in Base.metadata.sorted_tables:
        existentes = _columnas(conn, tabla.name)
        if not existentes or not _necesita_reconstruir(tabla, existentes):
            continue

        nueva = f"{tabla.name}__rebuild"
        destino, origen = [], []
        for col in tabla.columns:
            fill = _LEGACY_FILL.get((tabla.name, col.name))
            expr = None
            if fill and fill[0] in existentes:
                expr = fill[1]
                if col.name in existentes:
                    expr = f"COALESCE(old.{col.name}, {expr})"
            elif col.name in existentes:
                expr = f"old.{col.name}"
            if expr is None and col.default is not None and col.default.is_scalar:
                val = col.default.arg
                expr = repr(int(val) if isinstance(val, bool) else val)
            if expr is not None:
                destino.append(col.name)
                origen.append(expr)

        ddl = str(CreateTable(tabla).compile(engine)).strip()
        ddl = ddl.replace(f"CREATE TABLE {tabla.name} ", f"CREATE TABLE {nueva} ", 1)

        conn.execute(text(f"DROP TABLE IF EXISTS {nueva}"))
        conn.execute(text(ddl))
        conn.execute(
            text(
                f"INSERT OR IGNORE INTO {nueva} ({', '.join(destino)}) "
                f"SELECT {', '.join(origen)} FROM {tabla.name} AS old"
            )
        )
        total = conn.execute(text(f"SELECT COUNT(*) FROM {tabla.name}")).scalar()
        copiadas = conn.execute(text(f"SELECT COUNT(*) FROM {nueva}")).scalar()
        conn.execute(text(f"DROP TABLE {tabla.name}"))
        conn.execute(text(f"ALTER TABLE {nueva} RENAME TO {tabla.name}"))
        for indice in tabla.indexes:
            indice.create(conn, checkfirst=True)

        print(
            f"[migracion] Tabla '{tabla.name}' reconstruida con el esquema actual "
            f"({copiadas}/{total} filas conservadas).",
            flush=True,
        )


@app.on_event("startup")
def create_tables() -> None:
    with engine.connect() as conn:
        Base.metadata.create_all(bind=engine)
        _backfill_receta_temporadas(conn)
        _backfill_tipos_comida_legacy(conn)
        _rebuild_legacy_tables(conn)
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
app.include_router(patio_routes.router)
app.include_router(evento_routes.router)
app.include_router(reporte_routes.router)
app.include_router(notification_routes.router)


@app.get("/")
def read_root():
    return {"nombre": "Juan"}
