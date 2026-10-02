from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.config.database import Base


class AsignacionPrecioHistorial(Base):
    """Historial inmutable de los cambios de precio de una asignación.

    A diferencia de `AsignacionProveedor`, donde editar el precio sobrescribe
    `precio_unitario` y se pierde el valor anterior, acá cada cambio queda
    appendeado con el precio previo, el nuevo, quién lo hizo y cuándo.

    Las filas son de solo escritura: nunca se actualizan ni se borran, y son el
    respaldo de auditoría de los precios pactados con cada proveedor.
    """

    __tablename__ = "asignaciones_precio_historial"

    id = Column(Integer, primary_key=True, index=True)
    asignacion_id = Column(
        Integer, ForeignKey("asignaciones_proveedor.id"), nullable=False, index=True
    )
    precio_anterior = Column(Numeric(12, 2), nullable=False)
    precio_nuevo = Column(Numeric(12, 2), nullable=False)
    modificado_por_id = Column(
        Integer, ForeignKey("users.id"), nullable=True, index=True
    )
    # Se desnormaliza el username para no perder la trazabilidad si el usuario
    # se renombra o se da de baja.
    modificado_por_username = Column(String(100), nullable=True)
    modificado_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    asignacion = relationship("AsignacionProveedor")
    modificado_por = relationship("User")