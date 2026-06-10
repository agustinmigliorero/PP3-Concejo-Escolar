"""
Seed de datos de testing basados en las planillas SAE actuales.

Uso:
    docker compose exec backend python seed_data.py
    # o en local, desde backend/:
    python seed_data.py

Este seed no lee los Excel en runtime. Los datos fueron volcados como constantes
para que el entorno de prueba sea estable aunque cambien las planillas.
"""

from __future__ import annotations

import os
import sys
from datetime import date
from decimal import Decimal

sys.path.insert(0, os.path.dirname(__file__))

from app.config.database import Base, SessionLocal, engine
import app.models  # noqa: F401
from app.models.asignacion_proveedor_model import AsignacionProveedor
from app.models.ingrediente_model import Ingrediente
from app.models.location_model import Localidad
from app.models.proveedor_model import Proveedor
from app.models.receta_model import Receta, RecetaIngrediente, TipoComida
from app.models.school_model import School
from app.models.temporada_model import DiaMenu, NombreTemporada, OpcionMenu, Temporada


SEED_DATE = date(2026, 6, 8)
SEASON_YEAR = 2026

LOCALITIES = ["Azul", "Cachari", "Chillar"]

SCHOOLS = [
    ("Azul", "EP 1", 94, 47),
    ("Azul", "EP 7", 101, 0),
    ("Azul", "EP 13", 164, 82),
    ("Azul", "EP 19", 148, 87),
    ("Azul", "EP 27", 230, 115),
    ("Azul", "EP 64", 148, 100),
    ("Azul", "EES 8", 149, 149),
    ("Azul", "EEST 1", 566, 160),
    ("Azul", "CFI 1", 108, 54),
    ("Azul", "CEC 802", 103, 103),
    ("Cachari", "J904", 111, 0),
    ("Cachari", "EP4", 6, 0),
    ("Cachari", "EP6", 35, 0),
    ("Cachari", "EP23", 123, 0),
    ("Cachari", "EP32", 5, 2),
    ("Cachari", "EP59", 12, 6),
    ("Cachari", "CEC801", 130, 130),
    ("Cachari", "EEE506", 24, 12),
    ("Cachari", "EES2", 171, 0),
    ("Chillar", "JI903", 138, 0),
    ("Chillar", "PP8", 147, 55),
    ("Chillar", "PP20", 8, 0),
    ("Chillar", "PP56", 134, 134),
    ("Chillar", "EE507", 60, 21),
    ("Chillar", "MS3", 250, 0),
    ("Chillar", "CANDILEJAS", 3, 0),
]

INGREDIENTS = [
    ("MANZANA", "kg", None, None, "1.0"),
    ("BANANA", "kg", None, None, "1.0"),
    ("NARANJA O MANDARINA", "kg", None, None, "1.0"),
    ("PERA", "kg", None, None, "1.0"),
    ("Zapallo ANCO", "kg", None, None, "1.0"),
    ("Zapallo verde", "kg", None, None, "1.0"),
    ("Papa", "kg", None, None, "1.0"),
    ("Cebolla", "kg", None, None, "1.0"),
    ("Zanahoria", "kg", None, None, "1.0"),
    ("Tomate", "kg", None, None, "1.0"),
    ("Ajo", "kg", None, None, "1.0"),
    ("Perejil", "kg", None, None, "1.0"),
    ("Huevo de gallina x doc", "docenas", None, None, "1.0"),
    ("Leche fluida x litro", "litros", None, None, "1.0"),
    ("Azucar kg", "kg", None, None, "1.0"),
    ("Te en saquito x 25 u", "unidades", "25", "u", "1.0"),
    ("Cacao en polvo x 360 g", "unidades", "360", "g", "1.0"),
    ("Dulce de leche por 400 gr", "unidades", "400", "g", "1.0"),
    ("Dulce de batata x kg", "kg", None, None, "1.0"),
    ("Queso cremoso x kg", "kg", None, None, "1.0"),
    ("Aceite girasol por 900 cc", "unidades", "900", "cc", "1.0"),
    ("Arroz 00000 por kg", "kg", None, None, "1.0"),
    ("Arvejas x 340 gr Tetra Brik", "unidades", "340", "g", "1.0"),
    ("Lentejas remojadas x 350 gr", "unidades", "350", "g", "1.0"),
    ("Pimenton x 25 gr", "unidades", "25", "g", "1.0"),
    ("Oregano x 25 gr", "unidades", "25", "g", "1.0"),
    ("Condimento para pizza x 25 gr", "unidades", "25", "g", "1.0"),
    ("Sal fina x 500 gr", "unidades", "500", "g", "1.0"),
    ("Fideo tirabuzon x 500 g", "unidades", "500", "g", "1.0"),
    ("Tomate triturado en tetrabrik x 500 gr", "unidades", "500", "g", "1.0"),
    ("Pan rallado x kg", "kg", None, None, "1.0"),
    ("Almidon de maiz x 500 g", "unidades", "500", "g", "1.0"),
    ("Esencia de vainilla x 100 cc", "unidades", "100", "cc", "1.0"),
    ("Harina Leudante x kg", "kg", None, None, "1.0"),
    ("Harina 000 x kg", "kg", None, None, "1.0"),
    ("Levadura seca x 20 gr", "unidades", "20", "g", "1.0"),
    ("PULPA DE CERDO fileteada por Kg.", "kg", None, None, "1.0"),
    ("POLLO por Kg.", "kg", None, None, "1.68"),
    ("NALGA CERDO fileteada para milanesa por Kg.", "kg", None, None, "1.0"),
    ("Pan", "kg", None, None, "1.0"),
]

FRUIT_PRICES = {
    "Azul": ("FERNANDEZ (LA PUNTUAL)", [2390, 2550, 1710, 2200, 1350, 1950, 1090, 1090, 1590, 1890, 700, 1990, 2100]),
    "Cachari": ("CAPPUCCIO LUIS", [2950, 3490, 1990, 2500, 1500, 2590, 1250, 1250, 1790, 1890, 990, 2000, 2900]),
    "Chillar": ("FERNANDEZ", [2150, 2100, 1150, 1990, 990, 1890, 890, 990, 1390, 1850, 690, 1600, 1890]),
}
FRUIT_INGREDIENTS = [item[0] for item in INGREDIENTS[:13]]

DRY_PRICES = {
    "Azul": ("TUX SA", [2230, 1503, 1208, 3304, 2759, 2808, 9900, 3965, 1487, 743, 1239, 1090, 1090, 1090, 760, 1013, 1156, 4000, 3304, 1487, 1602, 991, 1322]),
    "Cachari": ("DISTRIBUIDORA PATO - GALLEGOS", [2230, 1503, 1208, 3304, 2759, 2808, 9900, 3965, 1487, 743, 1239, 1090, 1090, 1090, 760, 1013, 1156, 4000, 3304, 1487, 1602, 991, 1322]),
    "Chillar": ("GALLEGOS", [2000, 1150, 1000, 3400, 2900, 2550, 9500, 3300, 1500, 690, 900, 700, 700, 700, 700, 1000, 1100, 2800, 2500, 1700, 1600, 900, 1200]),
}
DRY_INGREDIENTS = [item[0] for item in INGREDIENTS[13:36]]

MEAT_INGREDIENTS = [item[0] for item in INGREDIENTS[36:39]]
MEAT_PRICES = {
    "Azul": ("ALVAREZ (LA SONADA)", [9500, 5500, 9500]),
    "Cachari": ("ALVAREZ (LA SONADA)", [9500, 5500, 9500]),
    "Chillar": ("ALVAREZ (LA SONADA)", [9500, 5500, 9500]),
}

PAN_PRICES = {
    "Azul": ("MASSON", 4000),
    "Cachari": ("CIVALE", 4000),
    "Chillar": ("MASSON", 4200),
}

BREAKFAST_RECIPE = [
    ("Leche fluida x litro", "0.120"),
    ("Azucar kg", "0.003"),
    ("Te en saquito x 25 u", "0.300"),
    ("Cacao en polvo x 360 g", "4.000"),
    ("Dulce de leche por 400 gr", "6.000"),
    ("Dulce de batata x kg", "0.004"),
    ("Pan", "0.050"),
]

LUNCH_RECIPE = [
    ("MANZANA", "0.024"),
    ("BANANA", "0.024"),
    ("NARANJA O MANDARINA", "0.048"),
    ("Zapallo ANCO", "0.028"),
    ("Zapallo verde", "0.010"),
    ("Papa", "0.040"),
    ("Cebolla", "0.015"),
    ("Zanahoria", "0.010"),
    ("Tomate", "0.007"),
    ("Ajo", "0.00004"),
    ("Perejil", "0.00004"),
    ("Huevo de gallina x doc", "0.300"),
    ("Leche fluida x litro", "0.025"),
    ("Azucar kg", "0.0014"),
    ("Queso cremoso x kg", "0.010"),
    ("Aceite girasol por 900 cc", "6.000"),
    ("Arroz 00000 por kg", "0.016"),
    ("Lentejas remojadas x 350 gr", "8.000"),
    ("Condimento para pizza x 25 gr", "0.300"),
    ("Sal fina x 500 gr", "0.300"),
    ("Fideo tirabuzon x 500 g", "14.000"),
    ("Tomate triturado en tetrabrik x 500 gr", "9.000"),
    ("Pan rallado x kg", "0.007"),
    ("Almidon de maiz x 500 g", "0.600"),
    ("Harina Leudante x kg", "0.010"),
    ("Harina 000 x kg", "0.015"),
    ("Levadura seca x 20 gr", "0.070"),
    ("PULPA DE CERDO fileteada por Kg.", "0.020"),
    ("POLLO por Kg.", "0.016"),
    ("NALGA CERDO fileteada para milanesa por Kg.", "0.020"),
]


def _decimal(value: str | int | float | None) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value))


def _get_or_create_locality(db, name: str) -> Localidad:
    locality = db.query(Localidad).filter(Localidad.nombre == name).first()
    if locality is None:
        locality = Localidad(nombre=name, activo=True)
        db.add(locality)
        db.flush()
    else:
        locality.activo = True
    return locality


def _get_or_create_provider(db, name: str) -> Proveedor:
    provider = db.query(Proveedor).filter(Proveedor.nombre == name).first()
    if provider is None:
        provider = Proveedor(nombre=name, contacto="Sin datos - seed de testing", activo=True)
        db.add(provider)
        db.flush()
    else:
        provider.activo = True
    return provider


def _get_or_create_ingredient(db, data: tuple) -> Ingrediente:
    name, unit, content, content_unit, correction = data
    ingredient = db.query(Ingrediente).filter(Ingrediente.nombre == name).first()
    if ingredient is None:
        ingredient = Ingrediente(
            nombre=name,
            unidad_medida=unit,
            contenido_por_unidad=_decimal(content),
            unidad_contenido=content_unit,
            indice_correccion=_decimal(correction) or Decimal("1.0"),
            activo=True,
        )
        db.add(ingredient)
        db.flush()
    else:
        ingredient.unidad_medida = unit
        ingredient.contenido_por_unidad = _decimal(content)
        ingredient.unidad_contenido = content_unit
        ingredient.indice_correccion = _decimal(correction) or Decimal("1.0")
        ingredient.activo = True
    return ingredient


def _seed_localities(db) -> dict[str, Localidad]:
    return {name: _get_or_create_locality(db, name) for name in LOCALITIES}


def _seed_ingredients(db) -> dict[str, Ingrediente]:
    return {item[0]: _get_or_create_ingredient(db, item) for item in INGREDIENTS}


def _seed_schools(db, localities: dict[str, Localidad]) -> int:
    created = 0
    for locality_name, code, dmc, comedor in SCHOOLS:
        school = db.query(School).filter(School.code == code).first()
        if school is None:
            school = School(
                code=code,
                name=code,
                address="Sin datos - seed de testing",
                phone="Sin datos",
            )
            db.add(school)
            created += 1

        school.locality_id = localities[locality_name].id
        school.matriculation = max(dmc, comedor)
        school.offers_breakfast = dmc > 0
        school.offers_lunch = comedor > 0
        school.offers_snack = False
        school.offers_dinner = False
        school.active = True
    return created


def _upsert_assignment(db, provider: Proveedor, ingredient: Ingrediente, locality: Localidad, price: Decimal) -> bool:
    current = (
        db.query(AsignacionProveedor)
        .filter(
            AsignacionProveedor.ingrediente_id == ingredient.id,
            AsignacionProveedor.localidad_id == locality.id,
            AsignacionProveedor.fecha_hasta.is_(None),
        )
        .first()
    )
    if current and current.proveedor_id == provider.id:
        current.precio_unitario = price
        return False
    if current:
        current.fecha_hasta = SEED_DATE

    db.add(
        AsignacionProveedor(
            proveedor_id=provider.id,
            ingrediente_id=ingredient.id,
            localidad_id=locality.id,
            precio_unitario=price,
            fecha_desde=SEED_DATE,
            fecha_hasta=None,
        )
    )
    return True


def _seed_assignments(db, localities: dict[str, Localidad], ingredients: dict[str, Ingrediente]) -> int:
    created = 0
    groups = [
        (FRUIT_PRICES, FRUIT_INGREDIENTS),
        (DRY_PRICES, DRY_INGREDIENTS),
        (MEAT_PRICES, MEAT_INGREDIENTS),
    ]
    for prices_by_locality, ingredient_names in groups:
        for locality_name, (provider_name, prices) in prices_by_locality.items():
            provider = _get_or_create_provider(db, provider_name)
            locality = localities[locality_name]
            for ingredient_name, price in zip(ingredient_names, prices):
                created += int(
                    _upsert_assignment(
                        db,
                        provider,
                        ingredients[ingredient_name],
                        locality,
                        Decimal(str(price)),
                    )
                )

    for locality_name, (provider_name, price) in PAN_PRICES.items():
        created += int(
            _upsert_assignment(
                db,
                _get_or_create_provider(db, provider_name),
                ingredients["Pan"],
                localities[locality_name],
                Decimal(str(price)),
            )
        )
    return created


def _get_or_create_season(db) -> Temporada:
    season = (
        db.query(Temporada)
        .filter(Temporada.nombre == NombreTemporada.INVIERNO, Temporada.anio == SEASON_YEAR)
        .first()
    )
    if season is None:
        season = Temporada(nombre=NombreTemporada.INVIERNO, anio=SEASON_YEAR, activo=True)
        db.add(season)
        db.flush()
    season.activo = True

    db.query(Temporada).filter(Temporada.id != season.id, Temporada.activo == True).update(
        {Temporada.activo: False},
        synchronize_session=False,
    )

    for number in (1, 2):
        option = (
            db.query(OpcionMenu)
            .filter(OpcionMenu.temporada_id == season.id, OpcionMenu.numero_opcion == number)
            .first()
        )
        description = f"Semana {number} - Invierno {SEASON_YEAR}"
        if option is None:
            db.add(OpcionMenu(temporada_id=season.id, numero_opcion=number, descripcion=description))
        else:
            option.descripcion = description
    db.flush()
    return season


def _upsert_recipe(db, name: str, meal_type: TipoComida, season: Temporada, items, ingredients) -> Receta:
    recipe = db.query(Receta).filter(Receta.nombre == name).first()
    if recipe is None:
        recipe = Receta(
            nombre=name,
            tipo_comida=meal_type,
            temporada_id=season.id,
            activo=True,
        )
        db.add(recipe)
        db.flush()
    else:
        recipe.ingredientes.clear()
        db.flush()
        recipe.tipo_comida = meal_type
        recipe.temporada_id = season.id
        recipe.activo = True

    for ingredient_name, amount in items:
        db.add(
            RecetaIngrediente(
                receta_id=recipe.id,
                ingrediente_id=ingredients[ingredient_name].id,
                cantidad_por_porcion=Decimal(amount),
            )
        )
    db.flush()
    return recipe


def _seed_menu(db, ingredients: dict[str, Ingrediente]) -> int:
    season = _get_or_create_season(db)
    options = {
        option.numero_opcion: option
        for option in db.query(OpcionMenu).filter(OpcionMenu.temporada_id == season.id).all()
    }
    recipes = {
        (1, TipoComida.DESAYUNO): _upsert_recipe(
            db,
            "Desayuno agregado semana 1 - Invierno 2026",
            TipoComida.DESAYUNO,
            season,
            BREAKFAST_RECIPE,
            ingredients,
        ),
        (2, TipoComida.DESAYUNO): _upsert_recipe(
            db,
            "Desayuno agregado semana 2 - Invierno 2026",
            TipoComida.DESAYUNO,
            season,
            BREAKFAST_RECIPE,
            ingredients,
        ),
        (1, TipoComida.ALMUERZO): _upsert_recipe(
            db,
            "Almuerzo agregado semana 1 - Invierno 2026",
            TipoComida.ALMUERZO,
            season,
            LUNCH_RECIPE,
            ingredients,
        ),
        (2, TipoComida.ALMUERZO): _upsert_recipe(
            db,
            "Almuerzo agregado semana 2 - Invierno 2026",
            TipoComida.ALMUERZO,
            season,
            LUNCH_RECIPE,
            ingredients,
        ),
    }

    changed = 0
    for (option_number, meal_type), recipe in recipes.items():
        option = options[option_number]
        for day in range(1, 6):
            row = (
                db.query(DiaMenu)
                .filter(
                    DiaMenu.opcion_menu_id == option.id,
                    DiaMenu.dia_semana == day,
                    DiaMenu.tipo_comida == meal_type.value,
                )
                .first()
            )
            if row is None:
                db.add(
                    DiaMenu(
                        opcion_menu_id=option.id,
                        dia_semana=day,
                        tipo_comida=meal_type.value,
                        receta_id=recipe.id,
                    )
                )
                changed += 1
            else:
                row.receta_id = recipe.id
    return changed


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        localities = _seed_localities(db)
        ingredients = _seed_ingredients(db)
        schools_created = _seed_schools(db, localities)
        assignments_created = _seed_assignments(db, localities, ingredients)
        menu_changes = _seed_menu(db, ingredients)
        db.commit()
        print("[seed:data] Seed de datos de testing finalizado correctamente.")
        print(f"[seed:data] Localidades: {len(localities)}")
        print(f"[seed:data] Ingredientes: {len(ingredients)}")
        print(f"[seed:data] Escuelas nuevas: {schools_created}")
        print(f"[seed:data] Asignaciones nuevas: {assignments_created}")
        print(f"[seed:data] Cambios de menu: {menu_changes}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
