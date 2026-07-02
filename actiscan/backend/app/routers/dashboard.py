from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=schemas.DashboardStats)
def get_stats(db: Session = Depends(get_db), _=Depends(get_current_user)):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    status_counts = dict(
        db.query(models.Asset.status, func.count(models.Asset.id))
        .group_by(models.Asset.status)
        .all()
    )

    active_audits = db.query(models.AuditSession).filter(
        models.AuditSession.status == models.AuditStatus.en_curso
    ).count()

    audits_today = db.query(models.AuditSession).filter(
        models.AuditSession.started_at >= today_start
    ).count()

    assets_audited_today = db.query(func.count(models.AuditItem.id)).filter(
        models.AuditItem.scanned_at >= today_start
    ).scalar() or 0

    return schemas.DashboardStats(
        total_assets=db.query(models.Asset).count(),
        operativo=status_counts.get(models.AssetStatus.operativo, 0),
        mantenimiento=status_counts.get(models.AssetStatus.mantenimiento, 0),
        baja=status_counts.get(models.AssetStatus.baja, 0),
        no_localizado=status_counts.get(models.AssetStatus.no_localizado, 0),
        active_audits=active_audits,
        audits_today=audits_today,
        assets_audited_today=assets_audited_today,
    )
