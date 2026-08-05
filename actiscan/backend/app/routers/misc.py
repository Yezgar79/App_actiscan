from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, require_admin, hash_password
import secrets
import string

users_router = APIRouter(prefix="/api/users", tags=["users"])
categories_router = APIRouter(prefix="/api/categories", tags=["categories"])
locations_router = APIRouter(prefix="/api/locations", tags=["locations"])


def _gen_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        if (any(c.isupper() for c in pwd) and any(c.islower() for c in pwd)
                and any(c.isdigit() for c in pwd) and any(c in "!@#$%" for c in pwd)):
            return pwd


# ─── Users ────────────────────────────────────────────────────────────────────

@users_router.get("", response_model=list[schemas.UserOut])
def list_users(
    search: str = Query(None),
    role: str = Query(None),
    is_active: bool = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    q = db.query(models.User)
    if search:
        q = q.filter(
            or_(
                models.User.name.ilike(f"%{search}%"),
                models.User.email.ilike(f"%{search}%"),
                models.User.username.ilike(f"%{search}%"),
                models.User.employee_number.ilike(f"%{search}%"),
            )
        )
    if role:
        try:
            q = q.filter(models.User.role == models.UserRole(role))
        except ValueError:
            pass
    if is_active is not None:
        q = q.filter(models.User.is_active == is_active)
    return q.order_by(models.User.name).offset(skip).limit(limit).all()


@users_router.get("/{user_id}", response_model=schemas.UserOut)
def get_user(user_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


@users_router.post("", response_model=schemas.UserOut, status_code=201)
def create_user(
    payload: schemas.UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    # Regular admins cannot create admin/super_admin users
    if current_user.role == models.UserRole.admin and payload.role in (
        models.UserRole.admin, models.UserRole.super_admin
    ):
        raise HTTPException(
            status_code=403,
            detail="Solo el super admin puede asignar roles elevados (admin/super_admin)"
        )
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="El email ya está en uso")
    if payload.username:
        if db.query(models.User).filter(models.User.username == payload.username).first():
            raise HTTPException(status_code=400, detail="El nombre de usuario ya está en uso")

    user = models.User(
        name=payload.name,
        username=payload.username,
        email=payload.email,
        employee_number=payload.employee_number,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        assigned_location=payload.assigned_location,
        must_change_password=payload.must_change_password,
    )
    db.add(user)
    db.flush()

    ip = request.client.host if request.client else None
    log = models.AuditLog(
        user_id=current_user.id,
        action=models.AuditLogAction.crear,
        module="usuarios",
        entity_type="user",
        entity_id=user.id,
        description=f"Usuario creado: {payload.email} (rol: {payload.role})",
        ip_address=ip,
        new_data={"email": payload.email, "role": payload.role, "name": payload.name},
    )
    db.add(log)
    db.commit()
    db.refresh(user)
    return user


@users_router.put("/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: str,
    payload: schemas.UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Prevent admin from elevating role beyond own level
    if payload.role and current_user.role == models.UserRole.admin and payload.role in (
        models.UserRole.admin, models.UserRole.super_admin
    ):
        raise HTTPException(status_code=403, detail="No puedes asignar roles iguales o superiores al tuyo")

    if payload.username and payload.username != user.username:
        if db.query(models.User).filter(
            models.User.username == payload.username, models.User.id != user_id
        ).first():
            raise HTTPException(status_code=400, detail="El nombre de usuario ya está en uso")

    changes = payload.model_dump(exclude_unset=True)
    prev = {k: getattr(user, k) for k in changes}
    for field, value in changes.items():
        setattr(user, field, value)

    ip = request.client.host if request.client else None
    log = models.AuditLog(
        user_id=current_user.id,
        action=models.AuditLogAction.editar,
        module="usuarios",
        entity_type="user",
        entity_id=user_id,
        description=f"Usuario actualizado: {user.email}",
        ip_address=ip,
        previous_data={k: str(v) for k, v in prev.items()},
        new_data={k: str(v) for k, v in changes.items()},
    )
    db.add(log)
    db.commit()
    db.refresh(user)
    return user


@users_router.post("/{user_id}/reset-password", response_model=dict)
def reset_user_password(
    user_id: str,
    payload: schemas.ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.hashed_password = hash_password(payload.new_password)
    user.must_change_password = payload.must_change_password
    user.failed_login_attempts = 0
    user.locked_until = None

    ip = request.client.host if request.client else None
    log = models.AuditLog(
        user_id=current_user.id,
        action=models.AuditLogAction.restablecer,
        module="usuarios",
        entity_type="user",
        entity_id=user_id,
        description=f"Contraseña restablecida para: {user.email}",
        ip_address=ip,
    )
    db.add(log)
    db.commit()
    return {"detail": "Contraseña restablecida correctamente"}


@users_router.post("/{user_id}/generate-password", response_model=dict)
def generate_temp_password(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    """Generate and set a random temporary password. Returns the plain password once."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    temp = _gen_temp_password()
    user.hashed_password = hash_password(temp)
    user.must_change_password = True
    user.failed_login_attempts = 0
    user.locked_until = None

    ip = request.client.host if request.client else None
    log = models.AuditLog(
        user_id=current_user.id,
        action=models.AuditLogAction.restablecer,
        module="usuarios",
        entity_type="user",
        entity_id=user_id,
        description=f"Contraseña temporal generada para: {user.email}",
        ip_address=ip,
    )
    db.add(log)
    db.commit()
    return {"temp_password": temp, "must_change_password": True}


@users_router.post("/{user_id}/toggle-active", response_model=schemas.UserOut)
def toggle_user_active(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="No puedes desactivar tu propia cuenta")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.is_active = not user.is_active
    action = models.AuditLogAction.activar if user.is_active else models.AuditLogAction.desactivar

    ip = request.client.host if request.client else None
    log = models.AuditLog(
        user_id=current_user.id,
        action=action,
        module="usuarios",
        entity_type="user",
        entity_id=user_id,
        description=f"Usuario {'activado' if user.is_active else 'desactivado'}: {user.email}",
        ip_address=ip,
    )
    db.add(log)
    db.commit()
    db.refresh(user)
    return user


# ─── Categories ───────────────────────────────────────────────────────────────

@categories_router.get("", response_model=list[schemas.CategoryOut])
def list_categories(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(models.Category)
    if not include_inactive:
        q = q.filter(models.Category.is_active == True)
    return q.order_by(models.Category.name).all()


@categories_router.get("/{cat_id}", response_model=schemas.CategoryOut)
def get_category(cat_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    cat = db.query(models.Category).filter(models.Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return cat


@categories_router.post("", response_model=schemas.CategoryOut, status_code=201)
def create_category(
    payload: schemas.CategoryCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    if db.query(models.Category).filter(models.Category.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Ya existe una categoría con ese nombre")
    cat = models.Category(**payload.model_dump())
    db.add(cat)
    db.flush()

    ip = request.client.host if request.client else None
    db.add(models.AuditLog(
        user_id=current_user.id, action=models.AuditLogAction.crear,
        module="catalogos", entity_type="category", entity_id=cat.id,
        description=f"Categoría creada: {payload.name}", ip_address=ip,
    ))
    db.commit()
    db.refresh(cat)
    return cat


@categories_router.put("/{cat_id}", response_model=schemas.CategoryOut)
def update_category(
    cat_id: str,
    payload: schemas.CategoryUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    cat = db.query(models.Category).filter(models.Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    if payload.name and payload.name != cat.name:
        if db.query(models.Category).filter(models.Category.name == payload.name).first():
            raise HTTPException(status_code=400, detail="Ya existe una categoría con ese nombre")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(cat, field, value)

    ip = request.client.host if request.client else None
    db.add(models.AuditLog(
        user_id=current_user.id, action=models.AuditLogAction.editar,
        module="catalogos", entity_type="category", entity_id=cat_id,
        description=f"Categoría actualizada: {cat.name}", ip_address=ip,
    ))
    db.commit()
    db.refresh(cat)
    return cat


# ─── Locations ────────────────────────────────────────────────────────────────

@locations_router.get("", response_model=list[schemas.LocationOut])
def list_locations(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(models.Location)
    if not include_inactive:
        q = q.filter(models.Location.is_active == True)
    return q.order_by(models.Location.name).all()


@locations_router.get("/{loc_id}", response_model=schemas.LocationOut)
def get_location(loc_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    loc = db.query(models.Location).filter(models.Location.id == loc_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")
    return loc


@locations_router.post("", response_model=schemas.LocationOut, status_code=201)
def create_location(
    payload: schemas.LocationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    loc = models.Location(**payload.model_dump())
    db.add(loc)
    db.flush()

    ip = request.client.host if request.client else None
    db.add(models.AuditLog(
        user_id=current_user.id, action=models.AuditLogAction.crear,
        module="ubicaciones", entity_type="location", entity_id=loc.id,
        description=f"Ubicación creada: {payload.name}", ip_address=ip,
    ))
    db.commit()
    db.refresh(loc)
    return loc


@locations_router.put("/{loc_id}", response_model=schemas.LocationOut)
def update_location(
    loc_id: str,
    payload: schemas.LocationUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    loc = db.query(models.Location).filter(models.Location.id == loc_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")

    # Warn if location has active assets
    if payload.is_active is False:
        active_assets = db.query(models.Asset).filter(
            models.Asset.location_id == loc_id,
            models.Asset.is_active == True,
        ).count()
        if active_assets > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Esta ubicación tiene {active_assets} activo(s) asignados. Reasígnalos antes de desactivar."
            )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(loc, field, value)

    ip = request.client.host if request.client else None
    db.add(models.AuditLog(
        user_id=current_user.id, action=models.AuditLogAction.editar,
        module="ubicaciones", entity_type="location", entity_id=loc_id,
        description=f"Ubicación actualizada: {loc.name}", ip_address=ip,
    ))
    db.commit()
    db.refresh(loc)
    return loc
