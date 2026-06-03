import enum

from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.config.database import Base


class NombreTemporada(str, enum.Enum):
    VERANO = "VERANO"
    INVIERNO = "INVIERNO"


class Temporada(Base):
    __tablename__ = "temporadas"
    __table_args__ = (UniqueConstraint("nombre", "anio", name="uq_temporada_nombre_anio"),)

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(Enum(NombreTemporada), nullable=False)
    anio = Column(Integer, nullable=False)
    activo = Column(Boolean, default=False, nullable=False)

    opciones_menu = relationship(
        "OpcionMenu",
        back_populates="temporada",
        cascade="all, delete-orphan",
        order_by="OpcionMenu.numero_opcion",
    )


class OpcionMenu(Base):
    __tablename__ = "opciones_menu"
    __table_args__ = (
        UniqueConstraint("temporada_id", "numero_opcion", name="uq_opcion_menu_temporada_numero"),
    )

    id = Column(Integer, primary_key=True, index=True)
    temporada_id = Column(Integer, ForeignKey("temporadas.id"), nullable=False, index=True)
    numero_opcion = Column(Integer, nullable=False)
    descripcion = Column(String(255), nullable=True)

    temporada = relationship("Temporada", back_populates="opciones_menu")
