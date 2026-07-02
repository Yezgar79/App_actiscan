from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text,
    ForeignKey, Enum as SAEnum
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
    admin = "admin"
    auditor = "auditor"
    viewer = "viewer"


class AssetStatus(str, enum.Enum):
    operativo = "operativo"
    mantenimiento = "mantenimiento"
    baja = "baja"
    no_localizado = "no_localizado"


class AuditStatus(str, enum.Enum):
    en_curso = "en_curso"
    completada = "completada"
    cancelada = "cancelada"


class AuditItemResult(str, enum.Enum):
    presente = "presente"
    faltante = "faltante"
    alerta = "alerta"


class MovementType(str, enum.Enum):
    ubicacion = "ubicacion"
    responsable = "responsable"
    estado = "estado"
    registro = "registro"
    auditoria = "auditoria"


# ─── Models ──────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(120), nullable=False)
    email = Column(String(180), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.auditor, nullable=False)
    is_active = Column(Boolean, default=True)
    assigned_location = Column(String(120), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    assets = relationship("Asset", back_populates="responsible_user", foreign_keys="Asset.responsible_id")
    audit_sessions = relationship("AuditSession", back_populates="auditor")
    movements = relationship("Movement", back_populates="performed_by_user")


class Category(Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(80), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    assets = relationship("Asset", back_populates="category")


class Location(Base):
    __tablename__ = "locations"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(120), nullable=False)
    floor = Column(String(40), nullable=True)
    building = Column(String(80), nullable=True)
    description = Column(Text, nullable=True)
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
    acquisition_date = Column(DateTime(timezone=True), nullable=True)
    warranty_until = Column(DateTime(timezone=True), nullable=True)
    acquisition_value = Column(Float, nullable=True)
    status = Column(SAEnum(AssetStatus), default=AssetStatus.operativo, nullable=False)
    qr_code_url = Column(String(255), nullable=True)
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
    title = Column(String(180), nullable=False)
    location_id = Column(String, ForeignKey("locations.id"), nullable=True)
    auditor_id = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(SAEnum(AuditStatus), default=AuditStatus.en_curso, nullable=False)
    notes = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)

    auditor = relationship("User", back_populates="audit_sessions")
    items = relationship("AuditItem", back_populates="session", cascade="all, delete-orphan")


class AuditItem(Base):
    __tablename__ = "audit_items"

    id = Column(String, primary_key=True, default=gen_uuid)
    session_id = Column(String, ForeignKey("audit_sessions.id"), nullable=False)
    asset_id = Column(String, ForeignKey("assets.id"), nullable=False)
    result = Column(SAEnum(AuditItemResult), nullable=False)
    notes = Column(Text, nullable=True)
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
