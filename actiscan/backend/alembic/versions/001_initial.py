"""Initial schema

Revision ID: 001
Revises: 
Create Date: 2024-06-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('users',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('email', sa.String(180), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('role', sa.String(20), nullable=False, server_default='auditor'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('assigned_location', sa.String(120), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
    )

    op.create_table('categories',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(80), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )

    op.create_table('locations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('floor', sa.String(40), nullable=True),
        sa.Column('building', sa.String(80), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('assets',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('code', sa.String(40), nullable=False),
        sa.Column('name', sa.String(180), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('brand', sa.String(80), nullable=True),
        sa.Column('model', sa.String(80), nullable=True),
        sa.Column('serial_number', sa.String(120), nullable=True),
        sa.Column('acquisition_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('warranty_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('acquisition_value', sa.Float(), nullable=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='operativo'),
        sa.Column('qr_code_url', sa.String(255), nullable=True),
        sa.Column('image_url', sa.String(255), nullable=True),
        sa.Column('category_id', sa.String(), sa.ForeignKey('categories.id'), nullable=True),
        sa.Column('location_id', sa.String(), sa.ForeignKey('locations.id'), nullable=True),
        sa.Column('responsible_id', sa.String(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
    )
    op.create_index('ix_assets_code', 'assets', ['code'])

    op.create_table('audit_sessions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('title', sa.String(180), nullable=False),
        sa.Column('location_id', sa.String(), sa.ForeignKey('locations.id'), nullable=True),
        sa.Column('auditor_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='en_curso'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('audit_items',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('session_id', sa.String(), sa.ForeignKey('audit_sessions.id'), nullable=False),
        sa.Column('asset_id', sa.String(), sa.ForeignKey('assets.id'), nullable=False),
        sa.Column('result', sa.String(20), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('scanned_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('movements',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('asset_id', sa.String(), sa.ForeignKey('assets.id'), nullable=False),
        sa.Column('performed_by', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('movement_type', sa.String(30), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('previous_value', sa.String(255), nullable=True),
        sa.Column('new_value', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('movements')
    op.drop_table('audit_items')
    op.drop_table('audit_sessions')
    op.drop_index('ix_assets_code', 'assets')
    op.drop_table('assets')
    op.drop_table('locations')
    op.drop_table('categories')
    op.drop_table('users')
