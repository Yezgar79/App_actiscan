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
        .filter(models.Asset.is_active == True)
        .group_by(models.Asset.status)
        .all()
    )

    active_audits = db.query(models.AuditSession).filter(
        models.AuditSession.status == models.AuditStatus.en_curso
    ).count()

    completed_audits = db.query(models.AuditSession).filter(
        models.AuditSession.status == models.AuditStatus.completada
    ).count()

    total_audits = db.query(models.AuditSession).count()

    audits_today = db.query(models.AuditSession).filter(
        models.AuditSession.started_at >= today_start
    ).count()

    assets_audited_today = db.query(func.count(models.AuditItem.id)).filter(
        models.AuditItem.scanned_at >= today_start
    ).scalar() or 0

    active_users = db.query(models.User).filter(models.User.is_active == True).count()

    # Assets with observations (damaged, missing, no_localizado)
    assets_with_obs = db.query(models.Asset).filter(
        models.Asset.is_active == True,
        models.Asset.status.in_([
            models.AssetStatus.mantenimiento,
            models.AssetStatus.no_localizado,
        ])
    ).count()

    return schemas.DashboardStats(
        total_assets=db.query(models.Asset).filter(models.Asset.is_active == True).count(),
        operativo=status_counts.get(models.AssetStatus.operativo, 0),
        mantenimiento=status_counts.get(models.AssetStatus.mantenimiento, 0),
        baja=status_counts.get(models.AssetStatus.baja, 0),
        no_localizado=status_counts.get(models.AssetStatus.no_localizado, 0),
        active_audits=active_audits,
        completed_audits=completed_audits,
        total_audits=total_audits,
        audits_today=audits_today,
        assets_audited_today=assets_audited_today,
        active_users=active_users,
        assets_with_observations=assets_with_obs,
    )
