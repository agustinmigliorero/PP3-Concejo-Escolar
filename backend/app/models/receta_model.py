from sqlalchemy import Boolean, Column, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.config.database import Base
from app.models.tipo_comida_model import receta_tipos_comida


class Receta(Base):
    __tablename__ = "recetas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(200), unique=True, nullable=False, index=True)
    temporada_id = Column(Integer, ForeignKey("temporadas.id"), nullable=True, index=True)
    activo = Column(Boolean, default=True, nullable=False)

    temporada = relationship("Temporada")
    tipos_comida = relationship(
        "TipoComida",
        secondary=receta_tipos_comida,
        order_by="TipoComida.nombre",
    )
    ingredientes = relationship(
        "RecetaIngrediente",
        back_populates="receta",
        cascade="all, delete-orphan",
        order_by="RecetaIngrediente.id",
    )


class RecetaIngrediente(Base):
    __tablename__ = "receta_ingredientes"
    __table_args__ = (
        UniqueConstraint("receta_id", "ingrediente_id", name="uq_receta_ingrediente"),
    )

    id = Column(Integer, primary_key=True, index=True)
    receta_id = Column(Integer, ForeignKey("recetas.id"), nullable=False, index=True)
    ingrediente_id = Column(Integer, ForeignKey("ingredientes.id"), nullable=False, index=True)
    cantidad_por_porcion = Column(Numeric(10, 2), nullable=False)

    receta = relationship("Receta", back_populates="ingredientes")
    ingrediente = relationship("Ingrediente")
