from app.routes.auth_routes import router as auth_router
from app.routes.user_routes import router as user_router

__all__ = ["auth_router", "user_router"]
