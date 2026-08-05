from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List, Any, Dict
from datetime import datetime
import re
from app.models import (
    UserRole, AssetStatus, AuditStatus, AuditItemResult,
    MovementType, ObservationSeverity, AuditLogAction
)


def validate_password_strength(v: str) -> str:
    if len(v) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres")
    if not re.search(r"[A-Z]", v):
        raise ValueError("La contraseña debe tener al menos una letra mayúscula")
    if not re.search(r"[a-z]", v):
        raise ValueError("La contraseña debe tener al menos una letra minúscula")
    if not re.search(r"\d", v):
        raise ValueError("La contraseña debe tener al menos un número")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-]", v):
        raise ValueError("La contraseña debe tener al menos un carácter especial (!@#$%...)")
    return v


# ─── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str      # Accept email OR username; validation in router
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    must_change_password: bool = False


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v):
        return validate_password_strength(v)


class ResetPasswordRequest(BaseModel):
    new_password: str
    must_change_password: bool = True

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v):
        return validate_password_strength(v)


# ─── User ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str
    username: Optional[str] = None
    email: EmailStr
    employee_number: Optional[str] = None
    password: str
    role: UserRole = UserRole.auditor
    assigned_location: Optional[str] = None
    must_change_password: bool = False

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        return validate_password_strength(v)


class UserUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    employee_number: Optional[str] = None
    role: Optional[UserRole] = None
    assigned_location: Optional[str] = None
    is_active: Optional[bool] = None
    must_change_password: Optional[bool] = None


class UserCreateAdmin(BaseModel):
    name: str
    username: Optional[str] = None
    email: EmailStr
    employee_number: Optional[str] = None
    password: str
    role: UserRole = UserRole.auditor
    assigned_location: Optional[str] = None
    must_change_password: bool = True

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        return validate_password_strength(v)


class UserFullUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    employee_number: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None
    assigned_location: Optional[str] = None
    is_active: Optional[bool] = None
    must_change_password: Optional[bool] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if v is not None:
            return validate_password_strength(v)
        return v


class UserOut(BaseModel):
    id: str
    name: str
    username: Optional[str] = None
    email: str
    employee_number: Optional[str] = None
    role: UserRole
    is_active: bool
    must_change_password: bool = False
    assigned_location: Optional[str]
    failed_login_attempts: int = 0
    locked_until: Optional[datetime] = None
    last_login: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Category ─────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class CategoryOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    is_active: bool = True

    class Config:
        from_attributes = True


# ─── Location ─────────────────────────────────────────────────────────────────

class LocationCreate(BaseModel):
    name: str
    floor: Optional[str] = None
    building: Optional[str] = None
    description: Optional[str] = None


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    floor: Optional[str] = None
    building: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class LocationOut(BaseModel):
    id: str
    name: str
    floor: Optional[str]
    building: Optional[str]
    description: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True


# ─── Asset ────────────────────────────────────────────────────────────────────

class AssetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    inventory_number: Optional[str] = None
    acquisition_date: Optional[datetime] = None
    warranty_until: Optional[datetime] = None
    acquisition_value: Optional[float] = None
    supplier: Optional[str] = None
    invoice_number: Optional[str] = None
    notes: Optional[str] = None
    status: AssetStatus = AssetStatus.operativo
    category_id: Optional[str] = None
    location_id: Optional[str] = None
    responsible_id: Optional[str] = None

    @field_validator("category_id", "location_id", "responsible_id", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        return None if v == "" else v


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    inventory_number: Optional[str] = None
    acquisition_date: Optional[datetime] = None
    warranty_until: Optional[datetime] = None
    acquisition_value: Optional[float] = None
    supplier: Optional[str] = None
    invoice_number: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[AssetStatus] = None
    is_active: Optional[bool] = None
    category_id: Optional[str] = None
    location_id: Optional[str] = None
    responsible_id: Optional[str] = None

    @field_validator("category_id", "location_id", "responsible_id", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        return None if v == "" else v


class AssetOut(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str]
    brand: Optional[str]
    model: Optional[str]
    serial_number: Optional[str]
    inventory_number: Optional[str] = None
    acquisition_date: Optional[datetime]
    warranty_until: Optional[datetime]
    acquisition_value: Optional[float]
    supplier: Optional[str] = None
    invoice_number: Optional[str] = None
    notes: Optional[str] = None
    status: AssetStatus
    is_active: bool = True
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
    description: Optional[str] = None
    location_id: Optional[str] = None
    auditor_id: Optional[str] = None
    planned_start: Optional[datetime] = None
    planned_end: Optional[datetime] = None
    notes: Optional[str] = None

    @field_validator("location_id", "auditor_id", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        return None if v == "" else v


class AuditSessionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    planned_start: Optional[datetime] = None
    planned_end: Optional[datetime] = None
    auditor_id: Optional[str] = None
    location_id: Optional[str] = None


class CancelAuditRequest(BaseModel):
    reason: str


class AuditItemCreate(BaseModel):
    asset_id: str
    result: AuditItemResult
    notes: Optional[str] = None
    severity: Optional[ObservationSeverity] = None
    detected_location: Optional[str] = None
    detected_responsible: Optional[str] = None
    evidence_urls: Optional[List[str]] = None


class AuditItemUpdate(BaseModel):
    result: Optional[AuditItemResult] = None
    notes: Optional[str] = None
    severity: Optional[ObservationSeverity] = None
    detected_location: Optional[str] = None
    detected_responsible: Optional[str] = None
    evidence_urls: Optional[List[str]] = None


class AuditItemOut(BaseModel):
    id: str
    asset_id: str
    result: AuditItemResult
    notes: Optional[str]
    severity: Optional[ObservationSeverity] = None
    detected_location: Optional[str] = None
    detected_responsible: Optional[str] = None
    evidence_urls: Optional[List[str]] = None
    returned_at: Optional[datetime] = None
    returned_comment: Optional[str] = None
    approved_at: Optional[datetime] = None
    scanned_at: datetime
    asset: Optional[AssetOut] = None

    class Config:
        from_attributes = True


class AuditSessionOut(BaseModel):
    id: str
    audit_code: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: AuditStatus
    notes: Optional[str]
    cancel_reason: Optional[str] = None
    planned_start: Optional[datetime] = None
    planned_end: Optional[datetime] = None
    started_at: datetime
    finished_at: Optional[datetime]
    auditor: UserOut
    items: list[AuditItemOut] = []

    class Config:
        from_attributes = True


class ReturnAuditItemRequest(BaseModel):
    comment: str


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


# ─── Audit Log (Bitácora) ─────────────────────────────────────────────────────

class AuditLogCreate(BaseModel):
    action: AuditLogAction
    module: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    description: str
    ip_address: Optional[str] = None
    previous_data: Optional[Dict[str, Any]] = None
    new_data: Optional[Dict[str, Any]] = None


class AuditLogOut(BaseModel):
    id: str
    user_id: Optional[str] = None
    action: AuditLogAction
    module: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    description: str
    ip_address: Optional[str] = None
    previous_data: Optional[Dict[str, Any]] = None
    new_data: Optional[Dict[str, Any]] = None
    created_at: datetime
    user: Optional[UserOut] = None

    class Config:
        from_attributes = True


# ─── Super Admin ──────────────────────────────────────────────────────────────

class SystemStats(BaseModel):
    total_users: int
    users_by_role: dict
    active_users: int
    inactive_users: int
    total_assets: int
    assets_by_status: dict
    total_audits: int
    active_audits: int
    total_categories: int
    total_locations: int
    total_movements: int


# ─── Dashboard ────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_assets: int
    operativo: int
    mantenimiento: int
    baja: int
    no_localizado: int
    active_audits: int
    completed_audits: int
    total_audits: int
    audits_today: int
    assets_audited_today: int
    active_users: int
    assets_with_observations: int


class CapturistaStats(BaseModel):
    """Estadísticas específicas para el capturista en campo (móvil)."""
    assigned_audits: int
    in_progress_audits: int
    completed_audits: int
    total_items_scanned: int
    items_pending: int
    items_found: int
    items_damaged: int
    items_missing: int
    items_returned: int
    last_audit_id: Optional[str] = None
    last_audit_title: Optional[str] = None
    last_audit_progress_pct: Optional[float] = None


# ─── Reports ──────────────────────────────────────────────────────────────────

class AssetReportRow(BaseModel):
    code: str
    name: str
    status: AssetStatus
    category: Optional[str]
    location: Optional[str]
    responsible: Optional[str]
    brand: Optional[str]
    model: Optional[str]
    serial_number: Optional[str]
    inventory_number: Optional[str]
    acquisition_value: Optional[float]
    acquisition_date: Optional[datetime]


class AuditReportRow(BaseModel):
    audit_code: Optional[str]
    title: str
    status: AuditStatus
    auditor: str
    location: Optional[str]
    started_at: datetime
    finished_at: Optional[datetime]
    total_items: int
    approved_items: int
    returned_items: int
