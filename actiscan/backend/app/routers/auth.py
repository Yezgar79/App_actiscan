from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import (
    verify_password, hash_password, create_access_token,
    create_refresh_token, decode_token, get_current_user
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, request: Request, db: Session = Depends(get_db)):
    # Accept email or username
    identifier = payload.email.strip()
    user = db.query(models.User).filter(models.User.email == identifier).first()
    if not user:
        user = db.query(models.User).filter(models.User.username == identifier).first()

    invalid_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales incorrectas",
    )

    if not user:
        raise invalid_exc

    # Check account lockout
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        remaining = int((user.locked_until - datetime.now(timezone.utc)).total_seconds() // 60) + 1
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cuenta bloqueada temporalmente. Intenta en {remaining} minuto(s).",
        )

    if not verify_password(payload.password, user.hashed_password):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
            user.failed_login_attempts = 0
        db.commit()
        raise invalid_exc

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Cuenta desactivada. Contacta al administrador.")

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    # Log the login
    ip = request.client.host if request.client else None
    log = models.AuditLog(
        user_id=user.id,
        action=models.AuditLogAction.login,
        module="auth",
        description=f"Inicio de sesión exitoso: {user.email}",
        ip_address=ip,
    )
    db.add(log)
    db.commit()

    access_token = create_access_token({"sub": user.id, "role": user.role})
    refresh_token = create_refresh_token({"sub": user.id})
    return schemas.TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        must_change_password=user.must_change_password,
    )


@router.post("/refresh", response_model=schemas.TokenResponse)
def refresh(payload: schemas.RefreshRequest, db: Session = Depends(get_db)):
    data = decode_token(payload.refresh_token)
    if data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token de refresco inválido")
    user = db.query(models.User).filter(models.User.id == data["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario no encontrado o inactivo")
    access_token = create_access_token({"sub": user.id, "role": user.role})
    refresh_token = create_refresh_token({"sub": user.id})
    return schemas.TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        must_change_password=user.must_change_password,
    )


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.post("/change-password", status_code=204)
def change_password(
    payload: schemas.ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="La nueva contraseña no puede ser igual a la anterior")
    current_user.hashed_password = hash_password(payload.new_password)
    current_user.must_change_password = False
    db.commit()

    ip = request.client.host if request.client else None
    log = models.AuditLog(
        user_id=current_user.id,
        action=models.AuditLogAction.editar,
        module="auth",
        description="Contraseña cambiada por el usuario",
        ip_address=ip,
    )
    db.add(log)
    db.commit()


@router.post("/logout", status_code=204)
def logout(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ip = request.client.host if request.client else None
    log = models.AuditLog(
        user_id=current_user.id,
        action=models.AuditLogAction.logout,
        module="auth",
        description=f"Cierre de sesión: {current_user.email}",
        ip_address=ip,
    )
    db.add(log)
    db.commit()


@router.post("/register", response_model=schemas.UserOut, status_code=201)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="El correo ya está registrado")
    if payload.username:
        if db.query(models.User).filter(models.User.username == payload.username).first():
            raise HTTPException(status_code=409, detail="El nombre de usuario ya está en uso")
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
    db.commit()
    db.refresh(user)
    return user
