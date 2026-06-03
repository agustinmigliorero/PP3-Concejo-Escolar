from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.location_model import Localidad
from app.models.school_model import School


def _school_to_response(school: School) -> dict:
    return {
        "id": school.id,
        "name": school.name,
        "code": school.code,
        "locality_id": school.locality_id,
        "locality_name": school.locality.nombre if school.locality else "",
        "address": school.address,
        "phone": school.phone,
        "matriculation": school.matriculation,
        "offers_breakfast": school.offers_breakfast,
        "offers_lunch": school.offers_lunch,
        "offers_snack": school.offers_snack,
        "offers_dinner": school.offers_dinner,
        "active": school.active,
    }


def get_all_schools(
    db: Session, locality_id: Optional[int] = None
) -> list[dict]:
    query = db.query(School).join(Localidad)
    if locality_id is not None:
        query = query.filter(School.locality_id == locality_id)
    schools = query.order_by(Localidad.nombre, School.name).all()
    return [_school_to_response(s) for s in schools]


def get_school_by_id(db: Session, school_id: int) -> dict:
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Escuela no encontrada"
        )
    return _school_to_response(school)


def _validate_locality(db: Session, locality_id: int) -> None:
    locality = db.query(Localidad).filter(Localidad.id == locality_id).first()
    if not locality:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La localidad especificada no existe",
        )


def create_school(
    db: Session,
    name: str,
    code: str,
    locality_id: int,
    address: str,
    phone: str,
    matriculation: int = 0,
    offers_breakfast: bool = False,
    offers_lunch: bool = False,
    offers_snack: bool = False,
    offers_dinner: bool = False,
) -> dict:
    _validate_locality(db, locality_id)

    if db.query(School).filter(School.code == code).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una escuela con ese código",
        )

    school = School(
        name=name,
        code=code,
        locality_id=locality_id,
        address=address,
        phone=phone,
        matriculation=matriculation,
        offers_breakfast=offers_breakfast,
        offers_lunch=offers_lunch,
        offers_snack=offers_snack,
        offers_dinner=offers_dinner,
    )
    db.add(school)
    db.commit()
    db.refresh(school)
    return _school_to_response(school)


def update_school(
    db: Session,
    school_id: int,
    name: Optional[str] = None,
    code: Optional[str] = None,
    locality_id: Optional[int] = None,
    address: Optional[str] = None,
    phone: Optional[str] = None,
    matriculation: Optional[int] = None,
    offers_breakfast: Optional[bool] = None,
    offers_lunch: Optional[bool] = None,
    offers_snack: Optional[bool] = None,
    offers_dinner: Optional[bool] = None,
    active: Optional[bool] = None,
) -> dict:
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Escuela no encontrada"
        )

    if locality_id is not None:
        _validate_locality(db, locality_id)

    if code is not None and code != school.code:
        if db.query(School).filter(
            School.code == code, School.id != school_id
        ).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe otra escuela con ese código",
            )

    if name is not None:
        school.name = name
    if code is not None:
        school.code = code
    if locality_id is not None:
        school.locality_id = locality_id
    if address is not None:
        school.address = address
    if phone is not None:
        school.phone = phone
    if matriculation is not None:
        school.matriculation = matriculation
    if offers_breakfast is not None:
        school.offers_breakfast = offers_breakfast
    if offers_lunch is not None:
        school.offers_lunch = offers_lunch
    if offers_snack is not None:
        school.offers_snack = offers_snack
    if offers_dinner is not None:
        school.offers_dinner = offers_dinner
    if active is not None:
        school.active = active

    db.commit()
    db.refresh(school)
    return _school_to_response(school)


def toggle_active(db: Session, school_id: int) -> dict:
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Escuela no encontrada"
        )
    school.active = not school.active
    db.commit()
    db.refresh(school)
    return _school_to_response(school)
