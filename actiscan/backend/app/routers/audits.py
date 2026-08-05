from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import datetime, timezone, date
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, require_admin

router = APIRouter(prefix="/api/audits", tags=["audits"])


def _generate_audit_code(db: Session) -> str:
    today = date.today().strftime("%Y%m%d")
    count = db.query(models.AuditSession).filter(
        func.date(models.AuditSession.started_at) == date.today()
    ).count()
    return f"AUD-{today}-{count + 1:04d}"


@router.get("/capturista-stats", response_model=schemas.CapturistaStats)
def capturista_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    sessions = (
        db.query(models.AuditSession)
        .options(joinedload(models.AuditSession.items))
        .filter(models.AuditSession.auditor_id == current_user.id)
        .all()
    )

    assigned = len(sessions)
    in_progress = sum(1 for s in sessions if s.status == models.AuditStatus.en_curso)
    completed = sum(1 for s in sessions if s.status == models.AuditStatus.completada)

    all_items = [item for s in sessions for item in s.items]
    items_found = sum(1 for i in all_items if i.result == models.AuditItemResult.presente)
    items_damaged = sum(1 for i in all_items if i.result in (
        models.AuditItemResult.danado, models.AuditItemResult.alerta
    ))
    items_missing = sum(1 for i in all_items if i.result == models.AuditItemResult.faltante)
    items_returned = sum(1 for i in all_items if i.returned_at is not None and i.approved_at is None)
    total_scanned = len(all_items)

    active_sessions = [s for s in sessions if s.status == models.AuditStatus.en_curso]
    last_audit_id = None
    last_audit_title = None
    last_audit_progress_pct = None
    if active_sessions:
        last = sorted(active_sessions, key=lambda s: s.started_at, reverse=True)[0]
        last_audit_id = last.id
        last_audit_title = last.title
        total_items = len(last.items)
        found_items = sum(1 for i in last.items if i.result == models.AuditItemResult.presente)
        last_audit_progress_pct = round((found_items / total_items) * 100, 1) if total_items > 0 else 0.0

    return schemas.CapturistaStats(
        assigned_audits=assigned,
        in_progress_audits=in_progress,
        completed_audits=completed,
        total_items_scanned=total_scanned,
        items_pending=in_progress,
        items_found=items_found,
        items_damaged=items_damaged,
        items_missing=items_missing,
        items_returned=items_returned,
        last_audit_id=last_audit_id,
        last_audit_title=last_audit_title,
        last_audit_progress_pct=last_audit_progress_pct,
    )


@router.get("", response_model=list[schemas.AuditSessionOut])
def list_audits(
    skip: int = 0,
    limit: int = 20,
    status: str = Query(None),
    auditor_id: str = Query(None),
    location_id: str = Query(None),
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
    # Auditors/viewers only see their own audits
    if current_user.role in (models.UserRole.auditor, models.UserRole.viewer):
        q = q.filter(models.AuditSession.auditor_id == current_user.id)
    elif auditor_id:
        q = q.filter(models.AuditSession.auditor_id == auditor_id)

    if status:
        try:
            q = q.filter(models.AuditSession.status == models.AuditStatus(status))
        except ValueError:
            pass
    if location_id:
        q = q.filter(models.AuditSession.location_id == location_id)
    return q.offset(skip).limit(limit).all()


@router.post("", response_model=schemas.AuditSessionOut, status_code=201)
def create_audit(
    payload: schemas.AuditSessionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Admin creates and assigns; auditors can create their own
    auditor_id = payload.auditor_id or current_user.id
    if auditor_id != current_user.id and current_user.role not in (
        models.UserRole.admin, models.UserRole.super_admin
    ):
        raise HTTPException(status_code=403, detail="Solo administradores pueden asignar auditorías a otros usuarios")

    # Validate auditor exists and has auditor role
    if auditor_id != current_user.id:
        auditor = db.query(models.User).filter(models.User.id == auditor_id).first()
        if not auditor or not auditor.is_active:
            raise HTTPException(status_code=404, detail="Capturista no encontrado o inactivo")
        if auditor.role not in (models.UserRole.auditor, models.UserRole.admin, models.UserRole.super_admin):
            raise HTTPException(status_code=400, detail="El usuario asignado no tiene rol de capturista")

    audit_code = _generate_audit_code(db)
    session = models.AuditSession(
        audit_code=audit_code,
        title=payload.title,
        description=payload.description,
        location_id=payload.location_id,
        auditor_id=auditor_id,
        created_by_id=current_user.id,
        notes=payload.notes,
        planned_start=payload.planned_start,
        planned_end=payload.planned_end,
        status=models.AuditStatus.en_curso,
    )
    db.add(session)
    db.flush()

    ip = request.client.host if request.client else None
    db.add(models.AuditLog(
        user_id=current_user.id, action=models.AuditLogAction.crear,
        module="auditorias", entity_type="audit_session", entity_id=session.id,
        description=f"Auditoría creada: {audit_code} — {payload.title}",
        ip_address=ip,
        new_data={"title": payload.title, "auditor_id": auditor_id, "audit_code": audit_code},
    ))
    db.commit()
    db.refresh(session)
    return session


@router.get("/{session_id}", response_model=schemas.AuditSessionOut)
def get_audit(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
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

    # Auditors only see their own
    if current_user.role == models.UserRole.auditor and session.auditor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a esta auditoría")
    return session


@router.put("/{session_id}", response_model=schemas.AuditSessionOut)
def update_audit(
    session_id: str,
    payload: schemas.AuditSessionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    session = db.query(models.AuditSession).filter(models.AuditSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Auditoría no encontrada")
    if session.status in (models.AuditStatus.completada, models.AuditStatus.cancelada):
        raise HTTPException(status_code=400, detail="No se puede modificar una auditoría completada o cancelada")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(session, field, value)
    db.commit()
    db.refresh(session)
    return session


@router.patch("/{session_id}/cancel", response_model=schemas.AuditSessionOut)
def cancel_audit(
    session_id: str,
    payload: schemas.CancelAuditRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    session = db.query(models.AuditSession).filter(models.AuditSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Auditoría no encontrada")
    if session.status == models.AuditStatus.completada:
        raise HTTPException(status_code=400, detail="No se puede cancelar una auditoría completada")
    if session.status == models.AuditStatus.cancelada:
        raise HTTPException(status_code=400, detail="La auditoría ya está cancelada")

    session.status = models.AuditStatus.cancelada
    session.cancel_reason = payload.reason
    session.finished_at = datetime.now(timezone.utc)

    ip = request.client.host if request.client else None
    db.add(models.AuditLog(
        user_id=current_user.id, action=models.AuditLogAction.cancelar,
        module="auditorias", entity_type="audit_session", entity_id=session_id,
        description=f"Auditoría cancelada: {session.audit_code or session_id[:8]}. Motivo: {payload.reason}",
        ip_address=ip,
    ))
    db.commit()
    db.refresh(session)
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
    if current_user.role == models.UserRole.auditor and session.auditor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a esta auditoría")

    asset = db.query(models.Asset).filter(models.Asset.id == payload.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")

    results_requiring_notes = {
        models.AuditItemResult.danado,
        models.AuditItemResult.reubicado,
        models.AuditItemResult.no_accesible,
        models.AuditItemResult.no_aplica,
        models.AuditItemResult.faltante,
    }
    if payload.result in results_requiring_notes and not payload.notes:
        raise HTTPException(
            status_code=422,
            detail=f"Se requieren observaciones para el resultado '{payload.result}'",
        )

    existing = db.query(models.AuditItem).filter(
        models.AuditItem.session_id == session_id,
        models.AuditItem.asset_id == payload.asset_id,
    ).first()

    if existing:
        if existing.approved_at is not None:
            raise HTTPException(status_code=400, detail="Este activo ya fue aprobado y no puede modificarse")
        existing.result = payload.result
        existing.notes = payload.notes
        existing.severity = payload.severity
        existing.detected_location = payload.detected_location
        existing.detected_responsible = payload.detected_responsible
        if payload.evidence_urls is not None:
            existing.evidence_urls = payload.evidence_urls
        existing.returned_at = None
        existing.returned_comment = None
        db.commit()
        db.refresh(existing)
        return existing

    item = models.AuditItem(
        session_id=session_id,
        asset_id=payload.asset_id,
        result=payload.result,
        notes=payload.notes,
        severity=payload.severity,
        detected_location=payload.detected_location,
        detected_responsible=payload.detected_responsible,
        evidence_urls=payload.evidence_urls or [],
    )
    db.add(item)

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


@router.put("/{session_id}/items/{item_id}", response_model=schemas.AuditItemOut)
def update_audit_item(
    session_id: str,
    item_id: str,
    payload: schemas.AuditItemUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    item = db.query(models.AuditItem).filter(
        models.AuditItem.id == item_id,
        models.AuditItem.session_id == session_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    if item.approved_at is not None:
        raise HTTPException(status_code=400, detail="Este activo ya fue aprobado")
    if item.returned_at is None:
        raise HTTPException(status_code=400, detail="El ítem no está en estado devuelto")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    item.returned_at = None
    item.returned_comment = None

    db.commit()
    db.refresh(item)
    return item


@router.post("/{session_id}/items/{item_id}/return", response_model=schemas.AuditItemOut)
def return_audit_item(
    session_id: str,
    item_id: str,
    payload: schemas.ReturnAuditItemRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    item = db.query(models.AuditItem).filter(
        models.AuditItem.id == item_id,
        models.AuditItem.session_id == session_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    if item.approved_at is not None:
        raise HTTPException(status_code=400, detail="Este activo ya fue aprobado y no puede devolverse")
    item.returned_at = datetime.now(timezone.utc)
    item.returned_comment = payload.comment

    ip = request.client.host if request.client else None
    db.add(models.AuditLog(
        user_id=current_user.id, action=models.AuditLogAction.devolver,
        module="auditorias", entity_type="audit_item", entity_id=item_id,
        description=f"Ítem devuelto para corrección. Comentario: {payload.comment}",
        ip_address=ip,
    ))
    db.commit()
    db.refresh(item)
    return item


@router.post("/{session_id}/items/{item_id}/approve", response_model=schemas.AuditItemOut)
def approve_audit_item(
    session_id: str,
    item_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    item = db.query(models.AuditItem).filter(
        models.AuditItem.id == item_id,
        models.AuditItem.session_id == session_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    if item.approved_at is not None:
        raise HTTPException(status_code=400, detail="Ya está aprobado")
    if item.returned_at is not None:
        raise HTTPException(status_code=400, detail="Este ítem está devuelto, espera la corrección del capturista")
    item.approved_at = datetime.now(timezone.utc)
    item.approved_by_id = current_user.id
    item.returned_at = None

    ip = request.client.host if request.client else None
    db.add(models.AuditLog(
        user_id=current_user.id, action=models.AuditLogAction.aprobar,
        module="auditorias", entity_type="audit_item", entity_id=item_id,
        description=f"Ítem de auditoría aprobado",
        ip_address=ip,
    ))
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{session_id}/finish", response_model=schemas.AuditSessionOut)
def finish_audit(
    session_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    session = (
        db.query(models.AuditSession)
        .options(joinedload(models.AuditSession.items))
        .filter(models.AuditSession.id == session_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Auditoría no encontrada")
    if session.auditor_id != current_user.id and current_user.role not in (
        models.UserRole.admin, models.UserRole.super_admin
    ):
        raise HTTPException(status_code=403, detail="Sin permiso para cerrar esta auditoría")

    returned_items = [i for i in session.items if i.returned_at is not None and i.approved_at is None]
    if returned_items:
        raise HTTPException(
            status_code=400,
            detail=f"Hay {len(returned_items)} activo(s) devueltos pendientes de corrección",
        )

    session.status = models.AuditStatus.completada
    session.finished_at = datetime.now(timezone.utc)

    ip = request.client.host if request.client else None
    db.add(models.AuditLog(
        user_id=current_user.id, action=models.AuditLogAction.editar,
        module="auditorias", entity_type="audit_session", entity_id=session_id,
        description=f"Auditoría finalizada: {session.audit_code or session_id[:8]}",
        ip_address=ip,
    ))
    db.commit()
    db.refresh(session)
    return session
