from sqlalchemy import Boolean, Column, Integer, Numeric, String

from app.config.database import Base


class Ingrediente(Base):
    __tablename__ = "ingredientes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), unique=True, nullable=False, index=True)
    unidad_medida = Column(String(50), nullable=False)
    contenido_por_unidad = Column(Numeric(10, 2), nullable=True)
    unidad_contenido = Column(String(50), nullable=True)
    indice_correccion = Column(Numeric(10, 2), default=1.0, nullable=False)
    activo = Column(Boolean, default=True)
