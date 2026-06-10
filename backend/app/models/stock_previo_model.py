from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.config.database import Base


class StockPrevio(Base):
    __tablename__ = "stock_previo"
    __table_args__ = (
        UniqueConstraint("escuela_id", "ingrediente_id", name="uq_stock_previo_escuela_ingrediente"),
    )

    id = Column(Integer, primary_key=True, index=True)
    escuela_id = Column(Integer, ForeignKey("schools.id"), nullable=False, index=True)
    ingrediente_id = Column(Integer, ForeignKey("ingredientes.id"), nullable=False, index=True)
    cantidad = Column(Numeric(12, 2), nullable=False, default=0)
    cargado_por_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    cargado_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    escuela = relationship("School")
    ingrediente = relationship("Ingrediente")
    cargado_por = relationship("User")
