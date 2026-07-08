from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.config.database import Base


class GeneracionPedido(Base):
    __tablename__ = "generaciones_pedido"

    id = Column(Integer, primary_key=True, index=True)
    # Origen de la demanda: REGULAR (menu semanal), PATIO (patios escolares del
    # sabado) o EVENTO (feria, aniversario, etc.). Todos comparten el mismo motor
    # de calculo; solo cambia como se arma la demanda por escuela.
    tipo = Column(String(20), nullable=False, default="REGULAR", index=True)
    semana_inicio = Column(Date, nullable=False, index=True)
    # Solo para REGULAR. En PATIO/EVENTO la demanda no sale de una opcion de menu.
    opcion_menu_id = Column(Integer, ForeignKey("opciones_menu.id"), nullable=True, index=True)
    # Solo para EVENTO.
    evento_id = Column(Integer, ForeignKey("eventos.id"), nullable=True, index=True)
    dias_habiles = Column(String(32), nullable=False)
    generado_por_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    generado_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    notas = Column(String(500), nullable=True)
    datos_snapshot = Column(JSON, nullable=False)

    opcion_menu = relationship("OpcionMenu")
    evento = relationship("Evento")
    generado_por = relationship("User")
