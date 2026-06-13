from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.config.database import Base
from app.models.tipo_comida_model import school_tipos_comida


class School(Base):
    __tablename__ = "schools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    locality_id = Column(Integer, ForeignKey("localidades.id"), nullable=False)
    address = Column(String(65), nullable=False)
    phone = Column(String(45), nullable=True)
    email = Column(String(120), nullable=True)
    matriculation = Column(Integer, nullable=False, default=0)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    locality = relationship("Localidad", back_populates="schools")
    users = relationship("User", back_populates="school")
    tipos_comida = relationship(
        "TipoComida",
        secondary=school_tipos_comida,
        order_by="TipoComida.nombre",
    )
