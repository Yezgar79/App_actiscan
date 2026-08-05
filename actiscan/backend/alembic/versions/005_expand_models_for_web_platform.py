"""Expand models for Flask web platform: user fields, audit fields, audit_logs table

Revision ID: 005
Revises: 004
Create Date: 2026-08-04
"""
from alembic import op
import sqlalchemy as sa

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Users: new fields ────────────────────────────────────────────────────
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('username', sa.String(60), nullable=True))
        batch_op.add_column(sa.Column('employee_number', sa.String(40), nullable=True))
        batch_op.add_column(sa.Column('must_change_password', sa.Boolean(),
                                      nullable=False, server_default='false'))
        try:
            batch_op.create_unique_constraint('uq_users_username', ['username'])
        except Exception:
            pass

    # ── Categories: soft-delete flag ─────────────────────────────────────────
    with op.batch_alter_table('categories') as batch_op:
        batch_op.add_column(sa.Column('is_active', sa.Boolean(),
                                      nullable=False, server_default='true'))

    # ── Locations: soft-delete flag ──────────────────────────────────────────
    with op.batch_alter_table('locations') as batch_op:
        batch_op.add_column(sa.Column('is_active', sa.Boolean(),
                                      nullable=False, server_default='true'))

    # ── Assets: new fields + soft-delete ─────────────────────────────────────
    with op.batch_alter_table('assets') as batch_op:
        batch_op.add_column(sa.Column('inventory_number', sa.String(80), nullable=True))
        batch_op.add_column(sa.Column('supplier', sa.String(120), nullable=True))
        batch_op.add_column(sa.Column('invoice_number', sa.String(80), nullable=True))
        batch_op.add_column(sa.Column('notes', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('is_active', sa.Boolean(),
                                      nullable=False, server_default='true'))

    # ── AuditSession: new fields ──────────────────────────────────────────────
    with op.batch_alter_table('audit_sessions') as batch_op:
        batch_op.add_column(sa.Column('audit_code', sa.String(30), nullable=True))
        batch_op.add_column(sa.Column('description', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('cancel_reason', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('planned_start', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('planned_end', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('created_by_id', sa.String(),
                                      sa.ForeignKey('users.id'), nullable=True))
        try:
            batch_op.create_unique_constraint('uq_audit_code', ['audit_code'])
        except Exception:
            pass

    # ── AuditItem: approved_by_id ─────────────────────────────────────────────
    with op.batch_alter_table('audit_items') as batch_op:
        batch_op.add_column(sa.Column('approved_by_id', sa.String(),
                                      sa.ForeignKey('users.id'), nullable=True))

    # ── AuditStatus enum: add draft + assigned values (PostgreSQL) ───────────
    try:
        op.execute("ALTER TYPE auditstatus ADD VALUE IF NOT EXISTS 'draft'")
        op.execute("ALTER TYPE auditstatus ADD VALUE IF NOT EXISTS 'assigned'")
    except Exception:
        pass

    # ── New table: audit_logs (bitácora) ─────────────────────────────────────
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('action', sa.String(30), nullable=False),
        sa.Column('module', sa.String(60), nullable=False),
        sa.Column('entity_type', sa.String(60), nullable=True),
        sa.Column('entity_id', sa.String(), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('previous_data', sa.JSON(), nullable=True),
        sa.Column('new_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'])
    op.create_index('ix_audit_logs_module', 'audit_logs', ['module'])


def downgrade() -> None:
    op.drop_index('ix_audit_logs_module', 'audit_logs')
    op.drop_index('ix_audit_logs_created_at', 'audit_logs')
    op.drop_index('ix_audit_logs_user_id', 'audit_logs')
    op.drop_table('audit_logs')

    with op.batch_alter_table('audit_items') as batch_op:
        batch_op.drop_column('approved_by_id')

    with op.batch_alter_table('audit_sessions') as batch_op:
        batch_op.drop_column('created_by_id')
        batch_op.drop_column('planned_end')
        batch_op.drop_column('planned_start')
        batch_op.drop_column('cancel_reason')
        batch_op.drop_column('description')
        batch_op.drop_column('audit_code')

    with op.batch_alter_table('assets') as batch_op:
        batch_op.drop_column('is_active')
        batch_op.drop_column('notes')
        batch_op.drop_column('invoice_number')
        batch_op.drop_column('supplier')
        batch_op.drop_column('inventory_number')

    with op.batch_alter_table('locations') as batch_op:
        batch_op.drop_column('is_active')

    with op.batch_alter_table('categories') as batch_op:
        batch_op.drop_column('is_active')

    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('must_change_password')
        batch_op.drop_column('employee_number')
        batch_op.drop_column('username')
