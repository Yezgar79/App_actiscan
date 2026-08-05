from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from app.database import get_db
from app import models, schemas
from app.auth import require_admin, get_current_user

router = APIRouter(prefix="/api/audit-logs", tags=["audit-logs"])


@router.get("", response_model=list[schemas.AuditLogOut])
def list_audit_logs(
    user_id: str = Query(None),
    module: str = Query(None),
    action: str = Query(None),
    entity_type: str = Query(None),
    date_from: datetime = Query(None),
    date_to: datetime = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    q = db.query(models.AuditLog).options(joinedload(models.AuditLog.user))
    if user_id:
        q = q.filter(models.AuditLog.user_id == user_id)
    if module:
        q = q.filter(models.AuditLog.module == module)
    if action:
        try:
            q = q.filter(models.AuditLog.action == models.AuditLogAction(action))
        except ValueError:
            pass
    if entity_type:
        q = q.filter(models.AuditLog.entity_type == entity_type)
    if date_from:
        q = q.filter(models.AuditLog.created_at >= date_from)
    if date_to:
        q = q.filter(models.AuditLog.created_at <= date_to)
    return q.order_by(models.AuditLog.created_at.desc()).offset(skip).limit(limit).all()


@router.post("", response_model=schemas.AuditLogOut, status_code=201)
def create_audit_log(
    payload: schemas.AuditLogCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Internal endpoint for Flask web layer to register audit log entries."""
    log = models.AuditLog(
        user_id=current_user.id,
        action=payload.action,
        module=payload.module,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        description=payload.description,
        ip_address=payload.ip_address,
        previous_data=payload.previous_data,
        new_data=payload.new_data,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log
