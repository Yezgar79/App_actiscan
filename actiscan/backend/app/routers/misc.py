from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, require_admin, hash_password

users_router = APIRouter(prefix="/api/users", tags=["users"])
categories_router = APIRouter(prefix="/api/categories", tags=["categories"])
locations_router = APIRouter(prefix="/api/locations", tags=["locations"])


# ─── Users ────────────────────────────────────────────────────────────────────

@users_router.get("", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(get_db), _=Depends(require_admin)):
    return db.query(models.User).all()


@users_router.put("/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: str,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


# ─── Categories ───────────────────────────────────────────────────────────────

@categories_router.get("", response_model=list[schemas.CategoryOut])
def list_categories(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(models.Category).all()


@categories_router.post("", response_model=schemas.CategoryOut, status_code=201)
def create_category(
    payload: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    cat = models.Category(**payload.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


# ─── Locations ────────────────────────────────────────────────────────────────

@locations_router.get("", response_model=list[schemas.LocationOut])
def list_locations(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(models.Location).all()


@locations_router.post("", response_model=schemas.LocationOut, status_code=201)
def create_location(
    payload: schemas.LocationCreate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    loc = models.Location(**payload.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc
