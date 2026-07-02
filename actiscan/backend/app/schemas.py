from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime
from app.models import UserRole, AssetStatus, AuditStatus, AuditItemResult, MovementType


# ─── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ─── User ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.auditor
    assigned_location: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    assigned_location: Optional[str] = None
    is_active: Optional[bool] = None


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    is_active: bool
    assigned_location: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Category ─────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryOut(BaseModel):
    id: str
    name: str
    description: Optional[str]

    class Config:
        from_attributes = True


# ─── Location ─────────────────────────────────────────────────────────────────

class LocationCreate(BaseModel):
    name: str
    floor: Optional[str] = None
    building: Optional[str] = None
    description: Optional[str] = None


class LocationOut(BaseModel):
    id: str
    name: str
    floor: Optional[str]
    building: Optional[str]

    class Config:
        from_attributes = True


# ─── Asset ────────────────────────────────────────────────────────────────────

class AssetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    acquisition_date: Optional[datetime] = None
    warranty_until: Optional[datetime] = None
    acquisition_value: Optional[float] = None
    status: AssetStatus = AssetStatus.operativo
    category_id: Optional[str] = None
    location_id: Optional[str] = None
    responsible_id: Optional[str] = None


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    acquisition_date: Optional[datetime] = None
    warranty_until: Optional[datetime] = None
    acquisition_value: Optional[float] = None
    status: Optional[AssetStatus] = None
    category_id: Optional[str] = None
    location_id: Optional[str] = None
    responsible_id: Optional[str] = None


class AssetOut(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str]
    brand: Optional[str]
    model: Optional[str]
    serial_number: Optional[str]
    acquisition_date: Optional[datetime]
    warranty_until: Optional[datetime]
    acquisition_value: Optional[float]
    status: AssetStatus
    qr_code_url: Optional[str]
    category: Optional[CategoryOut]
    location: Optional[LocationOut]
    responsible_user: Optional[UserOut]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Audit ────────────────────────────────────────────────────────────────────

class AuditSessionCreate(BaseModel):
    title: str
    location_id: Optional[str] = None
    notes: Optional[str] = None


class AuditItemCreate(BaseModel):
    asset_id: str
    result: AuditItemResult
    notes: Optional[str] = None


class AuditItemOut(BaseModel):
    id: str
    asset_id: str
    result: AuditItemResult
    notes: Optional[str]
    scanned_at: datetime
    asset: Optional[AssetOut] = None

    class Config:
        from_attributes = True


class AuditSessionOut(BaseModel):
    id: str
    title: str
    status: AuditStatus
    notes: Optional[str]
    started_at: datetime
    finished_at: Optional[datetime]
    auditor: UserOut
    items: list[AuditItemOut] = []

    class Config:
        from_attributes = True


# ─── Movement ─────────────────────────────────────────────────────────────────

class MovementOut(BaseModel):
    id: str
    movement_type: MovementType
    description: str
    previous_value: Optional[str]
    new_value: Optional[str]
    created_at: datetime
    performed_by_user: UserOut

    class Config:
        from_attributes = True


# ─── Dashboard ────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_assets: int
    operativo: int
    mantenimiento: int
    baja: int
    no_localizado: int
    active_audits: int
    audits_today: int
    assets_audited_today: int
