from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.config.database import Base


class GeneracionPedido(Base):
    __tablename__ = "generaciones_pedido"

    id = Column(Integer, primary_key=True, index=True)
    semana_inicio = Column(Date, nullable=False, index=True)
    opcion_menu_id = Column(Integer, ForeignKey("opciones_menu.id"), nullable=False, index=True)
    dias_habiles = Column(String(32), nullable=False)
    generado_por_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    generado_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    notas = Column(String(500), nullable=True)
    datos_snapshot = Column(JSON, nullable=False)

    opcion_menu = relationship("OpcionMenu")
    generado_por = relationship("User")
