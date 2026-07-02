from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import (
    verify_password, hash_password, create_access_token,
    create_refresh_token, decode_token, get_current_user
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Cuenta desactivada")

    access_token = create_access_token({"sub": user.id, "role": user.role})
    refresh_token = create_refresh_token({"sub": user.id})
    return schemas.TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=schemas.TokenResponse)
def refresh(payload: schemas.RefreshRequest, db: Session = Depends(get_db)):
    data = decode_token(payload.refresh_token)
    if data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token de refresco inválido")
    user = db.query(models.User).filter(models.User.id == data["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    access_token = create_access_token({"sub": user.id, "role": user.role})
    refresh_token = create_refresh_token({"sub": user.id})
    return schemas.TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.post("/register", response_model=schemas.UserOut, status_code=201)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="El correo ya está registrado")
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
