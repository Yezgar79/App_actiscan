from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(prefix="/api/audits", tags=["audits"])


@router.get("", response_model=list[schemas.AuditSessionOut])
def list_audits(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = (
        db.query(models.AuditSession)
        .options(
            joinedload(models.AuditSession.auditor),
            joinedload(models.AuditSession.items).joinedload(models.AuditItem.asset),
        )
        .order_by(models.AuditSession.started_at.desc())
    )
    if current_user.role == models.UserRole.auditor:
        q = q.filter(models.AuditSession.auditor_id == current_user.id)
    return q.offset(skip).limit(limit).all()


@router.post("", response_model=schemas.AuditSessionOut, status_code=201)
def create_audit(
    payload: schemas.AuditSessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    session = models.AuditSession(
        title=payload.title,
        location_id=payload.location_id,
        auditor_id=current_user.id,
        notes=payload.notes,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/{session_id}", response_model=schemas.AuditSessionOut)
def get_audit(session_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    session = (
        db.query(models.AuditSession)
        .options(
            joinedload(models.AuditSession.auditor),
            joinedload(models.AuditSession.items).joinedload(models.AuditItem.asset),
        )
        .filter(models.AuditSession.id == session_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Auditoría no encontrada")
    return session


@router.post("/{session_id}/scan", response_model=schemas.AuditItemOut, status_code=201)
def scan_asset(
    session_id: str,
    payload: schemas.AuditItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    session = db.query(models.AuditSession).filter(
        models.AuditSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Auditoría no encontrada")
    if session.status != models.AuditStatus.en_curso:
        raise HTTPException(status_code=400, detail="La auditoría no está en curso")

    asset = db.query(models.Asset).filter(models.Asset.id == payload.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")

    # Check duplicate scan
    existing = db.query(models.AuditItem).filter(
        models.AuditItem.session_id == session_id,
        models.AuditItem.asset_id == payload.asset_id,
    ).first()
    if existing:
        existing.result = payload.result
        existing.notes = payload.notes
        db.commit()
        db.refresh(existing)
        return existing

    item = models.AuditItem(
        session_id=session_id,
        asset_id=payload.asset_id,
        result=payload.result,
        notes=payload.notes,
    )
    db.add(item)

    # Update asset status if faltante
    if payload.result == models.AuditItemResult.faltante:
        asset.status = models.AssetStatus.no_localizado

    # Log movement
    movement = models.Movement(
        asset_id=asset.id,
        performed_by=current_user.id,
        movement_type=models.MovementType.auditoria,
        description=f"Escaneado en auditoría '{session.title}' — resultado: {payload.result}",
        new_value=payload.result,
    )
    db.add(movement)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{session_id}/finish", response_model=schemas.AuditSessionOut)
def finish_audit(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    session = db.query(models.AuditSession).filter(
        models.AuditSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Auditoría no encontrada")
    if session.auditor_id != current_user.id and current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Sin permiso para cerrar esta auditoría")
    session.status = models.AuditStatus.completada
    session.finished_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(session)
    return session
