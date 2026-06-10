from sqlalchemy import Column, Date, ForeignKey, Integer, Numeric
from sqlalchemy.orm import relationship

from app.config.database import Base


class AsignacionProveedor(Base):
    """Asocia un ingrediente a un proveedor para una localidad específica.

    Cambia con cada nueva licitación (~cada 2 meses). Se mantiene historial:
    nunca se sobreescribe una asignación; al crear una nueva para la misma
    combinación (ingrediente, localidad) se cierra la anterior fijando su
    `fecha_hasta`.

    Convención de fechas: `fecha_hasta` es EXCLUSIVA. Una asignación está
    vigente en una fecha `d` si `fecha_desde <= d AND (fecha_hasta IS NULL OR
    d < fecha_hasta)`. Para una combinación (ingrediente, localidad) solo puede
    haber una asignación con `fecha_hasta IS NULL` (la vigente actual).
    """

    __tablename__ = "asignaciones_proveedor"

    id = Column(Integer, primary_key=True, index=True)
    proveedor_id = Column(Integer, ForeignKey("proveedores.id"), nullable=False, index=True)
    ingrediente_id = Column(Integer, ForeignKey("ingredientes.id"), nullable=False, index=True)
    localidad_id = Column(Integer, ForeignKey("localidades.id"), nullable=False, index=True)
    precio_unitario = Column(Numeric(12, 2), nullable=False)
    fecha_desde = Column(Date, nullable=False)
    fecha_hasta = Column(Date, nullable=True)

    proveedor = relationship("Proveedor")
    ingrediente = relationship("Ingrediente")
    localidad = relationship("Localidad")
