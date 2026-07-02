from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, require_admin
from app.utils.qr import generate_qr_base64, generate_asset_code

router = APIRouter(prefix="/api/assets", tags=["assets"])


def _get_next_code(db: Session) -> str:
    count = db.query(models.Asset).count()
    return generate_asset_code(count + 1)


@router.get("", response_model=list[schemas.AssetOut])
def list_assets(
    search: str = Query(None),
    status: models.AssetStatus = Query(None),
    category_id: str = Query(None),
    location_id: str = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(models.Asset).options(
        joinedload(models.Asset.category),
        joinedload(models.Asset.location),
        joinedload(models.Asset.responsible_user),
    )
    if search:
        q = q.filter(
            or_(
                models.Asset.name.ilike(f"%{search}%"),
                models.Asset.code.ilike(f"%{search}%"),
                models.Asset.brand.ilike(f"%{search}%"),
                models.Asset.serial_number.ilike(f"%{search}%"),
            )
        )
    if status:
        q = q.filter(models.Asset.status == status)
    if category_id:
        q = q.filter(models.Asset.category_id == category_id)
    if location_id:
        q = q.filter(models.Asset.location_id == location_id)
    return q.offset(skip).limit(limit).all()


@router.get("/{asset_id}", response_model=schemas.AssetOut)
def get_asset(asset_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    asset = db.query(models.Asset).options(
        joinedload(models.Asset.category),
        joinedload(models.Asset.location),
        joinedload(models.Asset.responsible_user),
    ).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    return asset


@router.get("/by-code/{code}", response_model=schemas.AssetOut)
def get_by_code(code: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    asset = db.query(models.Asset).options(
        joinedload(models.Asset.category),
        joinedload(models.Asset.location),
        joinedload(models.Asset.responsible_user),
    ).filter(models.Asset.code == code).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    return asset


@router.post("", response_model=schemas.AssetOut, status_code=201)
def create_asset(
    payload: schemas.AssetCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    code = _get_next_code(db)
    asset = models.Asset(**payload.model_dump(), code=code)
    db.add(asset)
    db.flush()

    # Generate QR
    asset.qr_code_url = generate_qr_base64(code, asset.id)

    # Log movement
    movement = models.Movement(
        asset_id=asset.id,
        performed_by=current_user.id,
        movement_type=models.MovementType.registro,
        description=f"Activo registrado en el sistema con código {code}",
    )
    db.add(movement)
    db.commit()
    db.refresh(asset)
    return asset


@router.put("/{asset_id}", response_model=schemas.AssetOut)
def update_asset(
    asset_id: str,
    payload: schemas.AssetUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")

    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        # Track location/responsible/status changes
        old_val = getattr(asset, field)
        if old_val != value:
            mtype = models.MovementType.estado
            if field == "location_id":
                mtype = models.MovementType.ubicacion
            elif field == "responsible_id":
                mtype = models.MovementType.responsable
            movement = models.Movement(
                asset_id=asset.id,
                performed_by=current_user.id,
                movement_type=mtype,
                description=f"Campo '{field}' actualizado",
                previous_value=str(old_val),
                new_value=str(value),
            )
            db.add(movement)
        setattr(asset, field, value)

    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/{asset_id}", status_code=204)
def delete_asset(
    asset_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    db.delete(asset)
    db.commit()


@router.get("/{asset_id}/movements", response_model=list[schemas.MovementOut])
def get_movements(
    asset_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return (
        db.query(models.Movement)
        .options(joinedload(models.Movement.performed_by_user))
        .filter(models.Movement.asset_id == asset_id)
        .order_by(models.Movement.created_at.desc())
        .all()
    )
