from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.reporte_controller import (
    EstadisticasResponse,
    MesDisponible,
    ReporteMensualResponse,
)
from app.middlewares.auth_middleware import require_gestor_or_admin
from app.services import reporte_service

router = APIRouter(prefix="/reportes", tags=["reportes"])


@router.get("/meses", response_model=list[MesDisponible])
def list_meses(
    tipo: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    return reporte_service.list_meses(db, tipo=tipo)


@router.get("/mensual", response_model=ReporteMensualResponse)
def reporte_mensual(
    anio: int = Query(..., ge=2000, le=2100),
    mes: int = Query(..., ge=1, le=12),
    tipo: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    return reporte_service.build_reporte_mensual(db, anio, mes, tipo=tipo)


@router.get("/estadisticas", response_model=EstadisticasResponse)
def estadisticas(
    anio: int | None = Query(default=None, ge=2000, le=2100),
    tipo: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    return reporte_service.build_estadisticas(db, anio=anio, tipo=tipo)


@router.get("/mensual/export/excel")
def export_mensual_excel(
    anio: int = Query(..., ge=2000, le=2100),
    mes: int = Query(..., ge=1, le=12),
    tipo: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    content = reporte_service.export_reporte_mensual_excel(db, anio, mes, tipo=tipo)
    filename = reporte_service._reporte_filename(anio, mes, reporte_service._validate_tipo(tipo), "xlsx")
    return StreamingResponse(
        content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/mensual/export/pdf")
def export_mensual_pdf(
    anio: int = Query(..., ge=2000, le=2100),
    mes: int = Query(..., ge=1, le=12),
    tipo: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _=Depends(require_gestor_or_admin),
):
    content = reporte_service.export_reporte_mensual_pdf(db, anio, mes, tipo=tipo)
    filename = reporte_service._reporte_filename(anio, mes, reporte_service._validate_tipo(tipo), "pdf")
    return StreamingResponse(
        content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
