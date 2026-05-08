from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.database import Base, SessionLocal, engine
from app.config.settings import settings
from app.routes import auth_router, user_router
from app.services import user_service


@asynccontextmanager
async def lifespan(_app: FastAPI):
    import app.models.location_model  # noqa: F401
    import app.models.school_model  # noqa: F401
    import app.models.refresh_token_model  # noqa: F401
    import app.models.user_model  # noqa: F401

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user_service.bootstrap_first_admin(db)
    finally:
        db.close()
    yield


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001, http://localhost:3005"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(user_router, prefix=settings.API_PREFIX)


@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}
