from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.config.database import Base


class PatioMenu(Base):
    """Menu reutilizable de patios escolares (comida especial del sabado).

    A diferencia del menu semanal, no depende de temporada, opcion ni dia de la
    semana: es solo una lista de recetas que se sirven en los patios. Al generar
    el pedido se elige el menu y se cargan los comensales por escuela.
    """

    __tablename__ = "patio_menus"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(120), unique=True, nullable=False, index=True)
    descripcion = Column(String(255), nullable=True)
    activo = Column(Boolean, default=True, nullable=False)

    recetas = relationship(
        "PatioMenuReceta",
        back_populates="patio_menu",
        cascade="all, delete-orphan",
        order_by="PatioMenuReceta.id",
    )


class PatioMenuReceta(Base):
    __tablename__ = "patio_menu_recetas"
    __table_args__ = (
        UniqueConstraint("patio_menu_id", "receta_id", name="uq_patio_menu_receta"),
    )

    id = Column(Integer, primary_key=True, index=True)
    patio_menu_id = Column(Integer, ForeignKey("patio_menus.id"), nullable=False, index=True)
    receta_id = Column(Integer, ForeignKey("recetas.id"), nullable=False, index=True)

    patio_menu = relationship("PatioMenu", back_populates="recetas")
    receta = relationship("Receta")
