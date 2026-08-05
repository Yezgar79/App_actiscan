from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import require_super_admin, hash_password

router = APIRouter(prefix="/api/super-admin", tags=["super-admin"])


@router.get("/stats", response_model=schemas.SystemStats)
def get_system_stats(db: Session = Depends(get_db), _=Depends(require_super_admin)):
    users = db.query(models.User).all()
    users_by_role: dict = {}
    for u in users:
        users_by_role[u.role.value] = users_by_role.get(u.role.value, 0) + 1

    assets = db.query(models.Asset).all()
    assets_by_status: dict = {}
    for a in assets:
        assets_by_status[a.status.value] = assets_by_status.get(a.status.value, 0) + 1

    return schemas.SystemStats(
        total_users=len(users),
        users_by_role=users_by_role,
        active_users=sum(1 for u in users if u.is_active),
        inactive_users=sum(1 for u in users if not u.is_active),
        total_assets=len(assets),
        assets_by_status=assets_by_status,
        total_audits=db.query(models.AuditSession).count(),
        active_audits=db.query(models.AuditSession).filter(
            models.AuditSession.status == models.AuditStatus.en_curso
        ).count(),
        total_categories=db.query(models.Category).count(),
        total_locations=db.query(models.Location).count(),
        total_movements=db.query(models.Movement).count(),
    )


@router.get("/users", response_model=list[schemas.UserOut])
def list_all_users(db: Session = Depends(get_db), _=Depends(require_super_admin)):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()


@router.post("/users", response_model=schemas.UserOut, status_code=201)
def create_user(
    payload: schemas.UserCreateAdmin,
    db: Session = Depends(get_db),
    _=Depends(require_super_admin),
):
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="El email ya está en uso")
    user = models.User(
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        assigned_location=payload.assigned_location,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}", response_model=schemas.UserOut)
def update_user_full(
    user_id: str,
    payload: schemas.UserFullUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_super_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    data = payload.model_dump(exclude_unset=True)
    password = data.pop("password", None)
    if password:
        user.hashed_password = hash_password(password)
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_super_admin),
):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propio usuario")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    db.delete(user)
    db.commit()


@router.get("/movements", response_model=list[schemas.MovementOut])
def get_all_movements(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _=Depends(require_super_admin),
):
    return (
        db.query(models.Movement)
        .order_by(models.Movement.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
