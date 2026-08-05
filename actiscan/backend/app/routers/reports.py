import csv
import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app import models, schemas
from app.auth import require_admin

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/assets", response_model=list[schemas.AssetReportRow])
def assets_report(
    status: models.AssetStatus = Query(None),
    category_id: str = Query(None),
    location_id: str = Query(None),
    responsible_id: str = Query(None),
    skip: int = 0,
    limit: int = 500,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    q = db.query(models.Asset).options(
        joinedload(models.Asset.category),
        joinedload(models.Asset.location),
        joinedload(models.Asset.responsible_user),
    ).filter(models.Asset.is_active == True)
    if status:
        q = q.filter(models.Asset.status == status)
    if category_id:
        q = q.filter(models.Asset.category_id == category_id)
    if location_id:
        q = q.filter(models.Asset.location_id == location_id)
    if responsible_id:
        q = q.filter(models.Asset.responsible_id == responsible_id)

    assets = q.offset(skip).limit(limit).all()
    return [
        schemas.AssetReportRow(
            code=a.code,
            name=a.name,
            status=a.status,
            category=a.category.name if a.category else None,
            location=a.location.name if a.location else None,
            responsible=a.responsible_user.name if a.responsible_user else None,
            brand=a.brand,
            model=a.model,
            serial_number=a.serial_number,
            inventory_number=a.inventory_number,
            acquisition_value=a.acquisition_value,
            acquisition_date=a.acquisition_date,
        )
        for a in assets
    ]


@router.get("/assets/export")
def export_assets_csv(
    status: models.AssetStatus = Query(None),
    category_id: str = Query(None),
    location_id: str = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    q = db.query(models.Asset).options(
        joinedload(models.Asset.category),
        joinedload(models.Asset.location),
        joinedload(models.Asset.responsible_user),
    ).filter(models.Asset.is_active == True)
    if status:
        q = q.filter(models.Asset.status == status)
    if category_id:
        q = q.filter(models.Asset.category_id == category_id)
    if location_id:
        q = q.filter(models.Asset.location_id == location_id)

    assets = q.all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Código", "Nombre", "Estado", "Categoría", "Ubicación", "Responsable",
        "Marca", "Modelo", "No. Serie", "No. Inventario", "Valor Adquisición", "Fecha Adquisición",
        "Proveedor", "No. Factura"
    ])
    for a in assets:
        writer.writerow([
            a.code, a.name, a.status.value,
            a.category.name if a.category else "",
            a.location.name if a.location else "",
            a.responsible_user.name if a.responsible_user else "",
            a.brand or "", a.model or "", a.serial_number or "",
            a.inventory_number or "",
            a.acquisition_value or "",
            a.acquisition_date.strftime("%Y-%m-%d") if a.acquisition_date else "",
            a.supplier or "", a.invoice_number or "",
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=activos.csv"},
    )


@router.get("/audits", response_model=list[schemas.AuditReportRow])
def audits_report(
    status: models.AuditStatus = Query(None),
    auditor_id: str = Query(None),
    location_id: str = Query(None),
    date_from: str = Query(None),
    date_to: str = Query(None),
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    q = db.query(models.AuditSession).options(
        joinedload(models.AuditSession.auditor),
        joinedload(models.AuditSession.items),
    )
    if status:
        q = q.filter(models.AuditSession.status == status)
    if auditor_id:
        q = q.filter(models.AuditSession.auditor_id == auditor_id)
    if location_id:
        q = q.filter(models.AuditSession.location_id == location_id)

    sessions = q.order_by(models.AuditSession.started_at.desc()).offset(skip).limit(limit).all()
    return [
        schemas.AuditReportRow(
            audit_code=s.audit_code,
            title=s.title,
            status=s.status,
            auditor=s.auditor.name,
            location=None,
            started_at=s.started_at,
            finished_at=s.finished_at,
            total_items=len(s.items),
            approved_items=sum(1 for i in s.items if i.approved_at is not None),
            returned_items=sum(1 for i in s.items if i.returned_at is not None and i.approved_at is None),
        )
        for s in sessions
    ]


@router.get("/audits/export")
def export_audits_csv(
    status: models.AuditStatus = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    q = db.query(models.AuditSession).options(
        joinedload(models.AuditSession.auditor),
        joinedload(models.AuditSession.items),
    )
    if status:
        q = q.filter(models.AuditSession.status == status)
    sessions = q.order_by(models.AuditSession.started_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Código", "Título", "Estado", "Capturista", "Inicio", "Fin",
        "Total Activos", "Aprobados", "Devueltos"
    ])
    for s in sessions:
        total = len(s.items)
        approved = sum(1 for i in s.items if i.approved_at is not None)
        returned = sum(1 for i in s.items if i.returned_at is not None and i.approved_at is None)
        writer.writerow([
            s.audit_code or s.id[:8], s.title, s.status.value, s.auditor.name,
            s.started_at.strftime("%Y-%m-%d %H:%M"),
            s.finished_at.strftime("%Y-%m-%d %H:%M") if s.finished_at else "",
            total, approved, returned,
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=auditorias.csv"},
    )
