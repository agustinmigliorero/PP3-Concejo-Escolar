from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Table

from app.config.database import Base


class TipoComida(Base):
    __tablename__ = "tipos_comida"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), unique=True, nullable=False, index=True)
    activo = Column(Boolean, default=True, nullable=False)


# Relacion N:N receta <-> tipo de comida. Una receta puede servirse en varios
# tipos (ej. "Pollo a la plancha" para almuerzo y cena).
receta_tipos_comida = Table(
    "receta_tipos_comida",
    Base.metadata,
    Column("receta_id", Integer, ForeignKey("recetas.id"), primary_key=True),
    Column("tipo_comida_id", Integer, ForeignKey("tipos_comida.id"), primary_key=True),
)


# Relacion N:N escuela <-> tipo de comida. Cada escuela ofrece los tipos de
# comida que tenga asignados (reemplaza los antiguos flags offers_*).
school_tipos_comida = Table(
    "school_tipos_comida",
    Base.metadata,
    Column("school_id", Integer, ForeignKey("schools.id"), primary_key=True),
    Column("tipo_comida_id", Integer, ForeignKey("tipos_comida.id"), primary_key=True),
)
