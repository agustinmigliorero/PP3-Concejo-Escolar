from sqlalchemy import Column, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.config.database import Base


class SchoolTipoComidaMatricula(Base):
    """Cantidad de alumnos/cupos de una escuela para un servicio."""

    __tablename__ = "school_tipo_comida_matriculas"

    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), primary_key=True)
    tipo_comida_id = Column(
        Integer,
        ForeignKey("tipos_comida.id", ondelete="CASCADE"),
        primary_key=True,
    )
    cantidad = Column(Integer, nullable=False, default=0)

    school = relationship("School", back_populates="matriculas_por_tipo")
    tipo_comida = relationship("TipoComida")
