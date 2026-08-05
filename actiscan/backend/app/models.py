from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text,
    ForeignKey, Enum as SAEnum, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum
import uuid


def gen_uuid():
    return str(uuid.uuid4())


# ─── Enums ───────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    admin = "admin"
    auditor = "auditor"
    viewer = "viewer"


class AssetStatus(str, enum.Enum):
    operativo = "operativo"
    mantenimiento = "mantenimiento"
    baja = "baja"
    no_localizado = "no_localizado"


class AuditStatus(str, enum.Enum):
    draft = "draft"
    assigned = "assigned"
    en_curso = "en_curso"
    completada = "completada"
    cancelada = "cancelada"


class AuditItemResult(str, enum.Enum):
    presente = "presente"
    faltante = "faltante"
    danado = "danado"
    reubicado = "reubicado"
    no_accesible = "no_accesible"
    no_aplica = "no_aplica"
    alerta = "alerta"


class ObservationSeverity(str, enum.Enum):
    baja = "baja"
    media = "media"
    alta = "alta"
    critica = "critica"


class MovementType(str, enum.Enum):
    ubicacion = "ubicacion"
    responsable = "responsable"
    estado = "estado"
    registro = "registro"
    auditoria = "auditoria"


class AuditLogAction(str, enum.Enum):
    crear = "crear"
    editar = "editar"
    eliminar = "eliminar"
    activar = "activar"
    desactivar = "desactivar"
    login = "login"
    logout = "logout"
    exportar = "exportar"
    aprobar = "aprobar"
    devolver = "devolver"
    cancelar = "cancelar"
    restablecer = "restablecer"


# ─── Models ──────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(120), nullable=False)
    username = Column(String(60), unique=True, nullable=True, index=True)
    email = Column(String(180), unique=True, nullable=False, index=True)
    employee_number = Column(String(40), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.auditor, nullable=False)
    is_active = Column(Boolean, default=True)
    must_change_password = Column(Boolean, default=False, nullable=False)
    assigned_location = Column(String(120), nullable=True)
    # Security: account lockout
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    assets = relationship("Asset", back_populates="responsible_user", foreign_keys="Asset.responsible_id")
    audit_sessions = relationship("AuditSession", back_populates="auditor", foreign_keys="AuditSession.auditor_id")
    created_audits = relationship("AuditSession", back_populates="created_by", foreign_keys="AuditSession.created_by_id")
    movements = relationship("Movement", back_populates="performed_by_user")
    audit_logs = relationship("AuditLog", back_populates="user")


class Category(Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(80), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    assets = relationship("Asset", back_populates="category")


class Location(Base):
    __tablename__ = "locations"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(120), nullable=False)
    floor = Column(String(40), nullable=True)
    building = Column(String(80), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    assets = relationship("Asset", back_populates="location")


class Asset(Base):
    __tablename__ = "assets"

    id = Column(String, primary_key=True, default=gen_uuid)
    code = Column(String(40), unique=True, nullable=False, index=True)
    name = Column(String(180), nullable=False)
    description = Column(Text, nullable=True)
    brand = Column(String(80), nullable=True)
    model = Column(String(80), nullable=True)
    serial_number = Column(String(120), nullable=True)
    inventory_number = Column(String(80), nullable=True, index=True)
    acquisition_date = Column(DateTime(timezone=True), nullable=True)
    warranty_until = Column(DateTime(timezone=True), nullable=True)
    acquisition_value = Column(Float, nullable=True)
    supplier = Column(String(120), nullable=True)
    invoice_number = Column(String(80), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(SAEnum(AssetStatus), default=AssetStatus.operativo, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    qr_code_url = Column(Text, nullable=True)
    image_url = Column(String(255), nullable=True)

    category_id = Column(String, ForeignKey("categories.id"), nullable=True)
    location_id = Column(String, ForeignKey("locations.id"), nullable=True)
    responsible_id = Column(String, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    category = relationship("Category", back_populates="assets")
    location = relationship("Location", back_populates="assets")
    responsible_user = relationship("User", back_populates="assets", foreign_keys=[responsible_id])
    movements = relationship("Movement", back_populates="asset", cascade="all, delete-orphan")
    audit_items = relationship("AuditItem", back_populates="asset")


class AuditSession(Base):
    __tablename__ = "audit_sessions"

    id = Column(String, primary_key=True, default=gen_uuid)
    audit_code = Column(String(30), unique=True, nullable=True, index=True)
    title = Column(String(180), nullable=False)
    description = Column(Text, nullable=True)
    location_id = Column(String, ForeignKey("locations.id"), nullable=True)
    auditor_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_by_id = Column(String, ForeignKey("users.id"), nullable=True)
    status = Column(SAEnum(AuditStatus), default=AuditStatus.en_curso, nullable=False)
    cancel_reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    planned_start = Column(DateTime(timezone=True), nullable=True)
    planned_end = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)

    auditor = relationship("User", back_populates="audit_sessions", foreign_keys=[auditor_id])
    created_by = relationship("User", back_populates="created_audits", foreign_keys=[created_by_id])
    items = relationship("AuditItem", back_populates="session", cascade="all, delete-orphan")


class AuditItem(Base):
    __tablename__ = "audit_items"

    id = Column(String, primary_key=True, default=gen_uuid)
    session_id = Column(String, ForeignKey("audit_sessions.id"), nullable=False)
    asset_id = Column(String, ForeignKey("assets.id"), nullable=False)
    result = Column(SAEnum(AuditItemResult), nullable=False)
    notes = Column(Text, nullable=True)
    severity = Column(SAEnum(ObservationSeverity), nullable=True)
    detected_location = Column(String(255), nullable=True)
    detected_responsible = Column(String(255), nullable=True)
    evidence_urls = Column(JSON, nullable=True, default=list)
    returned_at = Column(DateTime(timezone=True), nullable=True)
    returned_comment = Column(Text, nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by_id = Column(String, ForeignKey("users.id"), nullable=True)
    scanned_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("AuditSession", back_populates="items")
    asset = relationship("Asset", back_populates="audit_items")


class Movement(Base):
    __tablename__ = "movements"

    id = Column(String, primary_key=True, default=gen_uuid)
    asset_id = Column(String, ForeignKey("assets.id"), nullable=False)
    performed_by = Column(String, ForeignKey("users.id"), nullable=False)
    movement_type = Column(SAEnum(MovementType), nullable=False)
    description = Column(Text, nullable=False)
    previous_value = Column(String(255), nullable=True)
    new_value = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    asset = relationship("Asset", back_populates="movements")
    performed_by_user = relationship("User", back_populates="movements")


class AuditLog(Base):
    """Bitácora de acciones críticas del sistema. Solo lectura desde la interfaz."""
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    action = Column(SAEnum(AuditLogAction), nullable=False)
    module = Column(String(60), nullable=False)
    entity_type = Column(String(60), nullable=True)
    entity_id = Column(String, nullable=True)
    description = Column(Text, nullable=False)
    ip_address = Column(String(45), nullable=True)
    # Safe subset of before/after data (never passwords or tokens)
    previous_data = Column(JSON, nullable=True)
    new_data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="audit_logs")
