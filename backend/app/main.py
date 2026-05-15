from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.database import Base, engine
from app.routes import auth_routes, user_routes

# Register models so SQLAlchemy creates their tables
import app.models.school_model  # noqa: F401
import app.models.user_model  # noqa: F401
import app.models.refresh_token_model  # noqa: F401

app = FastAPI(title="Concejo Escolar API")

origins = [
    "http://localhost:3001",
    "http://localhost:3005",
    "http://92.113.39.212:3005",
    "http://92.113.39.212:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)


app.include_router(auth_routes.router)
app.include_router(user_routes.router)


@app.get("/")
def read_root():
    return {"nombre": "Juan"}
