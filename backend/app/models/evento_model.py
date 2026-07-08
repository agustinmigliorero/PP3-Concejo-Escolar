from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.config.database import Base


class Evento(Base):
    """Evento especial puntual (feria de ciencias, aniversario, etc.).

    Define una fecha, un menu ad-hoc (lista de recetas) y metadatos. Que
    escuelas participan y con cuantos comensales se decide al generar el pedido.
    """

    __tablename__ = "eventos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False, index=True)
    fecha = Column(Date, nullable=False, index=True)
    descripcion = Column(String(500), nullable=True)
    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    recetas = relationship(
        "EventoReceta",
        back_populates="evento",
        cascade="all, delete-orphan",
        order_by="EventoReceta.id",
    )


class EventoReceta(Base):
    __tablename__ = "evento_recetas"
    __table_args__ = (
        UniqueConstraint("evento_id", "receta_id", name="uq_evento_receta"),
    )

    id = Column(Integer, primary_key=True, index=True)
    evento_id = Column(Integer, ForeignKey("eventos.id"), nullable=False, index=True)
    receta_id = Column(Integer, ForeignKey("recetas.id"), nullable=False, index=True)

    evento = relationship("Evento", back_populates="recetas")
    receta = relationship("Receta")
