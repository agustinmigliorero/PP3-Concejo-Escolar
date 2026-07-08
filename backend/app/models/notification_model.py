from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.config.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String(50), nullable=False, default="stock_cargado")
    message = Column(String(500), nullable=False)
    escuela_id = Column(Integer, ForeignKey("schools.id"), nullable=True)
    escuela_nombre = Column(String(200), nullable=True)
    cargado_por_username = Column(String(100), nullable=True)
    read = Column(Boolean, default=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    escuela = relationship("School")
