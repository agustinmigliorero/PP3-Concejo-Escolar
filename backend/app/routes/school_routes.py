from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.school_controller import (
    CreateSchoolRequest,
    UpdateMySchoolContactRequest,
    UpdateMySchoolMatriculationRequest,
    UpdateSchoolRequest,
)
from app.middlewares.auth_middleware import get_current_user, require_gestor_or_admin
from app.models.user_model import User
from app.services import school_service

router = APIRouter(prefix="/schools", tags=["schools"])


@router.get("")
def list_schools(
    locality_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    return school_service.get_all_schools(db, locality_id)


@router.get("/me")
def get_my_school(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return school_service.get_school_for_user(db, current_user)


@router.patch("/me/matriculation")
def update_my_school_matriculation(
    body: UpdateMySchoolMatriculationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.matriculas_por_tipo is not None:
        return school_service.update_school_matriculas_for_user(
            db,
            current_user,
            [item.model_dump() for item in body.matriculas_por_tipo],
            body.matriculation,
        )
    return school_service.update_school_matriculation_for_user(
        db,
        current_user,
        body.matriculation,
    )


@router.patch("/me/contact")
def update_my_school_contact(
    body: UpdateMySchoolContactRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return school_service.update_school_contact_for_user(
        db,
        current_user,
        body.phone,
        body.email,
    )


@router.get("/{school_id}")
def get_school(
    school_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    return school_service.get_school_by_id(db, school_id)


@router.post("", status_code=201)
def create_school(
    body: CreateSchoolRequest,
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    return school_service.create_school(
        db,
        name=body.name,
        code=body.code,
        locality_id=body.locality_id,
        address=body.address,
        phone=body.phone,
        email=body.email,
        matriculation=body.matriculation,
        tipos_comida_ids=body.tipos_comida_ids,
        matriculas_por_tipo=[item.model_dump() for item in body.matriculas_por_tipo],
    )


@router.put("/{school_id}")
def update_school(
    school_id: int,
    body: UpdateSchoolRequest,
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    return school_service.update_school(
        db,
        school_id=school_id,
        name=body.name,
        code=body.code,
        locality_id=body.locality_id,
        address=body.address,
        phone=body.phone,
        phone_provided="phone" in body.model_fields_set,
        email=body.email,
        email_provided="email" in body.model_fields_set,
        matriculation=body.matriculation,
        tipos_comida_ids=body.tipos_comida_ids,
        matriculas_por_tipo=(
            [item.model_dump() for item in body.matriculas_por_tipo]
            if body.matriculas_por_tipo is not None
            else None
        ),
        active=body.active,
    )


@router.patch("/{school_id}/toggle-active")
def toggle_active(
    school_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    return school_service.toggle_active(db, school_id)
