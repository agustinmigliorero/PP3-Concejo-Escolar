from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from app.config.database import Base, engine
from app.config.settings import settings
from app.routes import auth_routes, ingrediente_routes, localidad_routes, user_routes,school_routes

# Register models so SQLAlchemy creates their tables
import app.models.ingrediente_model  # noqa: F401
import app.models.location_model  # noqa: F401
import app.models.refresh_token_model  # noqa: F401
import app.models.school_model  # noqa: F401
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


@app.on_event("startup")
def create_tables() -> None:
    try:
        Base.metadata.create_all(bind=engine)
    except OperationalError:
        pass


app.include_router(auth_routes.router)
app.include_router(user_routes.router)
app.include_router(localidad_routes.router)
app.include_router(ingrediente_routes.router)
app.include_router(school_routes.router)


@app.get("/")
def read_root():
    return {"nombre": "Juan"}
