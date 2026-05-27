from sqlalchemy import Boolean, Column, Integer, String

from app.config.database import Base


class Proveedor(Base):
    __tablename__ = "proveedores"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), unique=True, nullable=False, index=True)
    contacto = Column(String(300), nullable=False)
    activo = Column(Boolean, default=True)
