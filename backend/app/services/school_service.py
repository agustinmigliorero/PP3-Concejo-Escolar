from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.models.location_model import Localidad
from app.models.school_model import School
from app.models.user_model import User, UserRole
from app.services import tipo_comida_service


def _school_to_response(school: School) -> dict:
    return {
        "id": school.id,
        "name": school.name,
        "code": school.code,
        "locality_id": school.locality_id,
        "locality_name": school.locality.nombre if school.locality else "",
        "address": school.address,
        "phone": school.phone,
        "email": school.email,
        "matriculation": school.matriculation,
        "tipos_comida": [
            {"id": tipo.id, "nombre": tipo.nombre, "activo": tipo.activo}
            for tipo in school.tipos_comida
        ],
        "active": school.active,
    }


def get_all_schools(
    db: Session, locality_id: Optional[int] = None
) -> list[dict]:
    query = (
        db.query(School)
        .join(Localidad)
        .options(selectinload(School.tipos_comida))
    )
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


def get_school_for_user(db: Session, user: User) -> dict:
    if user.role != UserRole.escuela:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los usuarios escuela pueden acceder a esta vista",
        )
    if user.school_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El usuario no tiene una escuela asociada",
        )
    return get_school_by_id(db, user.school_id)


def _get_own_active_school(db: Session, user: User) -> School:
    if user.role != UserRole.escuela:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los usuarios escuela pueden actualizar su escuela",
        )
    if user.school_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El usuario no tiene una escuela asociada",
        )

    school = db.query(School).filter(School.id == user.school_id).first()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Escuela no encontrada",
        )
    if not school.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede actualizar una escuela inactiva",
        )
    return school


def update_school_matriculation_for_user(
    db: Session,
    user: User,
    matriculation: int,
) -> dict:
    school = _get_own_active_school(db, user)
    school.matriculation = matriculation
    db.commit()
    db.refresh(school)
    return _school_to_response(school)


def update_school_contact_for_user(
    db: Session,
    user: User,
    phone: Optional[str],
    email: Optional[str],
) -> dict:
    school = _get_own_active_school(db, user)
    school.phone = phone
    school.email = email
    db.commit()
    db.refresh(school)
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
    phone: Optional[str] = None,
    email: Optional[str] = None,
    matriculation: int = 0,
    tipos_comida_ids: Optional[list[int]] = None,
) -> dict:
    _validate_locality(db, locality_id)

    if db.query(School).filter(School.code == code).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una escuela con ese código",
        )

    tipos = tipo_comida_service.get_tipos_comida_by_ids(db, tipos_comida_ids or [])

    school = School(
        name=name,
        code=code,
        locality_id=locality_id,
        address=address,
        phone=phone,
        email=email,
        matriculation=matriculation,
        tipos_comida=tipos,
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
    email: Optional[str] = None,
    matriculation: Optional[int] = None,
    tipos_comida_ids: Optional[list[int]] = None,
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
    if email is not None:
        school.email = email
    if matriculation is not None:
        school.matriculation = matriculation
    if tipos_comida_ids is not None:
        school.tipos_comida = tipo_comida_service.get_tipos_comida_by_ids(db, tipos_comida_ids)
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
