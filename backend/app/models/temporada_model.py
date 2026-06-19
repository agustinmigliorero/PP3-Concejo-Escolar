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
    dias_menu = relationship(
        "DiaMenu",
        back_populates="opcion_menu",
        cascade="all, delete-orphan",
        order_by="DiaMenu.dia_semana",
    )


class DiaMenu(Base):
    __tablename__ = "dias_menu"
    __table_args__ = (
        UniqueConstraint(
            "opcion_menu_id",
            "dia_semana",
            "tipo_comida_id",
            name="uq_dia_menu_opcion_dia_tipo",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    opcion_menu_id = Column(Integer, ForeignKey("opciones_menu.id"), nullable=False, index=True)
    dia_semana = Column(Integer, nullable=False)
    tipo_comida_id = Column(Integer, ForeignKey("tipos_comida.id"), nullable=False, index=True)
    receta_id = Column(Integer, ForeignKey("recetas.id"), nullable=False, index=True)

    opcion_menu = relationship("OpcionMenu", back_populates="dias_menu")
    tipo_comida = relationship("TipoComida")
    receta = relationship("Receta")
