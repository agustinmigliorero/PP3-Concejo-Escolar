"""Seed de prueba: ingredientes asociados a las escuelas (alcance por servicios).

Crea un escenario autocontenido y determinista para verificar que
GET /stock-previo/me devuelve SOLO los ingredientes que pertenencen a recetas de
los servicios (tipos de comida) que ofrece cada escuela.

Relacion probada:

    Ingrediente <- RecetaIngrediente <- Receta -> tipos_comida -> School.tipos_comida

Escenario creado:

    Escuelas y servicios:
        - EP Scope Desayuno (SCOPEA): DESAYUNO
        - EP Scope Almuerzo (SCOPEB): ALMUERZO
        - EP Scope Mixta    (SCOPEC): DESAYUNO + MERIENDA

    Ingredientes y recetas que los usan:
        - "Ing Scope Desayuno"   -> Receta Scope Desayuno   (DESAYUNO)
        - "Ing Scope Compartido" -> Receta Scope Desayuno   (DESAYUNO)
                                   + Receta Scope Almuerzo (ALMUERZO)
        - "Ing Scope Inactivo"   -> Receta Scope Desayuno, PERO activo = False
        - "Ing Scope Almuerzo"   -> Receta Scope Almuerzo   (ALMUERZO)
        - "Ing Scope Merienda"   -> Receta Scope Merienda   (MERIENDA)

    Usuarios (password: scope1234):
        - scope_a -> SCOPEA
        - scope_b -> SCOPEB
        - scope_c -> SCOPEC

Verificacion esperada de GET /stock-previo/me (comprobar por pertenencia: el
seed base puede agregar otros ingredientes porque comparte servicios):

    - scope_a (DESAYUNO):
        SI  "Ing Scope Desayuno", "Ing Scope Compartido"
        NO  "Ing Scope Almuerzo", "Ing Scope Merienda", "Ing Scope Inactivo"
    - scope_b (ALMUERZO):
        SI  "Ing Scope Almuerzo", "Ing Scope Compartido"
        NO  "Ing Scope Desayuno", "Ing Scope Merienda", "Ing Scope Inactivo"
    - scope_c (DESAYUNO + MERIENDA):
        SI  "Ing Scope Desayuno", "Ing Scope Merienda", "Ing Scope Compartido"
        NO  "Ing Scope Almuerzo", "Ing Scope Inactivo"

Ademas se puede probar la escritura: PUT /stock-previo/me con un ingrediente
fuera del alcance (por ejemplo "Ing Scope Almuerzo" desde scope_a) debe
responder 400 "fuera del alcance ...".

Temporada: si existe una temporada activa, las recetas de prueba se asocian a
ella para que la interseccion (union de servicios ∩ temporada activa) no las
descarte. Si no hay temporada activa, el listado cae a la union de servicios.

Uso:
    docker compose exec backend python seed_prueba_ingredientes_escuela.py
    # o en local, desde backend/:
    python seed_prueba_ingredientes_escuela.py

Es idempotente: se puede correr varias veces y cada corrida deja el escenario en
su estado canonico.
"""

from __future__ import annotations

import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.dirname(__file__))

from app.config.database import Base, SessionLocal, engine
from app.config.security import hash_password
import app.models  # noqa: F401
from app.models.ingrediente_model import Ingrediente
from app.models.location_model import Localidad
from app.models.receta_model import Receta, RecetaIngrediente
from app.models.school_model import School
from app.models.school_matriculation_model import SchoolTipoComidaMatricula
from app.models.temporada_model import Temporada
from app.models.tipo_comida_model import TipoComida
from app.models.user_model import User, UserRole

SERVICIOS = ("DESAYUNO", "ALMUERZO", "MERIENDA")

# (nombre, activo)
INGREDIENTES = [
    ("Ing Scope Desayuno", True),
    ("Ing Scope Compartido", True),
    ("Ing Scope Inactivo", False),
    ("Ing Scope Almuerzo", True),
    ("Ing Scope Merienda", True),
]

# (nombre receta, [(ingrediente, cantidad_por_porcion)], [servicios])
RECETAS = [
    (
        "Receta Scope Desayuno",
        [
            ("Ing Scope Desayuno", "0.100"),
            ("Ing Scope Compartido", "0.050"),
            ("Ing Scope Inactivo", "0.200"),
        ],
        ["DESAYUNO"],
    ),
    (
        "Receta Scope Almuerzo",
        [
            ("Ing Scope Almuerzo", "0.150"),
            ("Ing Scope Compartido", "0.080"),
        ],
        ["ALMUERZO"],
    ),
    (
        "Receta Scope Merienda",
        [("Ing Scope Merienda", "0.120")],
        ["MERIENDA"],
    ),
]

# (code, name, [servicios], matricula)
ESCUELAS = [
    ("SCOPEA", "EP Scope Desayuno", ["DESAYUNO"], 40),
    ("SCOPEB", "EP Scope Almuerzo", ["ALMUERZO"], 60),
    ("SCOPEC", "EP Scope Mixta", ["DESAYUNO", "MERIENDA"], 80),
]

# (username, code de escuela)
USUARIOS = [
    ("scope_a", "SCOPEA"),
    ("scope_b", "SCOPEB"),
    ("scope_c", "SCOPEC"),
]
USUARIO_PASSWORD = "scope1234"


def _get_or_create_tipo(db, nombre: str) -> TipoComida:
    tipo = db.query(TipoComida).filter(TipoComida.nombre == nombre).first()
    if tipo is None:
        tipo = TipoComida(nombre=nombre, activo=True)
        db.add(tipo)
        db.flush()
    else:
        tipo.activo = True
    return tipo


def _get_or_create_ingrediente(db, nombre: str, activo: bool) -> Ingrediente:
    ingrediente = db.query(Ingrediente).filter(Ingrediente.nombre == nombre).first()
    if ingrediente is None:
        ingrediente = Ingrediente(
            nombre=nombre,
            unidad_medida="unidades",
            indice_correccion=Decimal("1.0"),
            activo=activo,
        )
        db.add(ingrediente)
        db.flush()
    else:
        ingrediente.unidad_medida = "unidades"
        ingrediente.indice_correccion = Decimal("1.0")
        ingrediente.activo = activo
    return ingrediente


def _get_or_create_localidad(db) -> Localidad:
    localidad = db.query(Localidad).order_by(Localidad.id).first()
    if localidad is None:
        localidad = Localidad(nombre="Scope Test", activo=True)
        db.add(localidad)
        db.flush()
    return localidad


def _upsert_receta(db, nombre, items, tipos, ingredientes, temporada) -> Receta:
    receta = db.query(Receta).filter(Receta.nombre == nombre).first()
    if receta is None:
        receta = Receta(nombre=nombre, activo=True)
        db.add(receta)
        db.flush()
    receta.ingredientes.clear()
    db.flush()
    receta.tipos_comida = tipos
    # La relacion receta <-> temporada es N:N (tabla intermedia
    # receta_temporadas). El FK viejo recetas.temporada_id dejo de existir
    # en el modelo cuando se migro a N:N ("Selector de temporadas para
    # recetas"); asignarlo aqui no enlazaria nada.
    receta.temporadas = [temporada] if temporada is not None else []
    receta.activo = True
    for ingrediente_nombre, cantidad in items:
        db.add(
            RecetaIngrediente(
                receta_id=receta.id,
                ingrediente_id=ingredientes[ingrediente_nombre].id,
                cantidad_por_porcion=Decimal(cantidad),
            )
        )
    db.flush()
    return receta


def _upsert_escuela(db, code, name, tipos, matricula, localidad) -> School:
    escuela = db.query(School).filter(School.code == code).first()
    if escuela is None:
        escuela = School(
            code=code,
            name=name,
            locality_id=localidad.id,
            address="Direccion de prueba - scope",
        )
        db.add(escuela)
        db.flush()
    escuela.name = name
    escuela.locality_id = localidad.id
    escuela.matriculation = matricula
    escuela.active = True
    escuela.tipos_comida = tipos

    tipos_by_id = {tipo.id: tipo for tipo in tipos}
    existentes = {row.tipo_comida_id: row for row in escuela.matriculas_por_tipo}
    for row in list(escuela.matriculas_por_tipo):
        if row.tipo_comida_id not in tipos_by_id:
            db.delete(row)
    for tipo in tipos:
        row = existentes.get(tipo.id)
        if row is None:
            escuela.matriculas_por_tipo.append(
                SchoolTipoComidaMatricula(tipo_comida_id=tipo.id, cantidad=matricula)
            )
        else:
            row.cantidad = matricula
    return escuela


def _upsert_usuario(db, username: str, escuela: School) -> User:
    usuario = db.query(User).filter(User.username == username).first()
    if usuario is None:
        usuario = User(username=username, role=UserRole.escuela, active=True)
        db.add(usuario)
    usuario.password = hash_password(USUARIO_PASSWORD)
    usuario.role = UserRole.escuela
    usuario.school_id = escuela.id
    usuario.active = True
    return usuario


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        tipos = {nombre: _get_or_create_tipo(db, nombre) for nombre in SERVICIOS}
        ingredientes = {
            nombre: _get_or_create_ingrediente(db, nombre, activo)
            for nombre, activo in INGREDIENTES
        }
        localidad = _get_or_create_localidad(db)

        temporada_activa = db.query(Temporada).filter(Temporada.activo == True).first()

        for nombre, items, servicios in RECETAS:
            _upsert_receta(
                db,
                nombre,
                items,
                [tipos[servicio] for servicio in servicios],
                ingredientes,
                temporada_activa,
            )

        escuelas: dict[str, School] = {}
        for code, name, servicios, matricula in ESCUELAS:
            escuelas[code] = _upsert_escuela(
                db,
                code,
                name,
                [tipos[servicio] for servicio in servicios],
                matricula,
                localidad,
            )

        for username, code in USUARIOS:
            _upsert_usuario(db, username, escuelas[code])

        db.commit()

        print("[scope-ingredientes] Seed aplicado.")
        print()
        print("Escuelas / servicios:")
        for code, name, servicios, _ in ESCUELAS:
            print(f"  - {name} ({code}): {', '.join(servicios)}")
        print()
        print("Ingredientes:")
        for nombre, activo in INGREDIENTES:
            estado = "activo" if activo else "INACTIVO (no debe aparecer)"
            print(f"  - {nombre} [{estado}]")
        print()
        print(f"Usuarios (password: {USUARIO_PASSWORD}):")
        for username, code in USUARIOS:
            print(f"  - {username} -> {code}")
        if temporada_activa is not None:
            print()
            print(
                "[scope-ingredientes] Temporada activa detectada: las recetas de "
                "prueba se asociaron a ella."
            )
        else:
            print()
            print(
                "[scope-ingredientes] Sin temporada activa: el listado usa la union "
                "de servicios de cada escuela."
            )
        print()
        print("Verificacion esperada (GET /stock-previo/me, por pertenencia):")
        print("  - scope_a -> SI Desayuno, SI Compartido | NO Almuerzo, NO Merienda, NO Inactivo")
        print("  - scope_b -> SI Almuerzo, SI Compartido | NO Desayuno, NO Merienda, NO Inactivo")
        print("  - scope_c -> SI Desayuno, SI Merienda, SI Compartido | NO Almuerzo, NO Inactivo")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
