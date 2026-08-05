"""Expand audit items with severity/evidence/corrections and user security fields

Revision ID: 003
Revises: 002
Create Date: 2026-08-03
"""
from alembic import op
import sqlalchemy as sa

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Users: login security fields ──────────────────────────────────────────
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('last_login', sa.DateTime(timezone=True), nullable=True))

    # ── AuditItem: severity, detected fields, evidence, corrections ───────────
    with op.batch_alter_table('audit_items') as batch_op:
        batch_op.add_column(sa.Column('severity', sa.String(20), nullable=True))
        batch_op.add_column(sa.Column('detected_location', sa.String(255), nullable=True))
        batch_op.add_column(sa.Column('detected_responsible', sa.String(255), nullable=True))
        batch_op.add_column(sa.Column('evidence_urls', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('returned_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('returned_comment', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True))

    # ── AuditItem: expand result enum to support new values ───────────────────
    # SQLite does not enforce enum constraints so we just need to ensure
    # the new values are accepted at the application level.
    # For PostgreSQL, update the enum type:
    try:
        op.execute("ALTER TYPE audititemresult ADD VALUE IF NOT EXISTS 'danado'")
        op.execute("ALTER TYPE audititemresult ADD VALUE IF NOT EXISTS 'reubicado'")
        op.execute("ALTER TYPE audititemresult ADD VALUE IF NOT EXISTS 'no_accesible'")
        op.execute("ALTER TYPE audititemresult ADD VALUE IF NOT EXISTS 'no_aplica'")
    except Exception:
        # SQLite: no action needed
        pass


def downgrade() -> None:
    with op.batch_alter_table('audit_items') as batch_op:
        batch_op.drop_column('approved_at')
        batch_op.drop_column('returned_comment')
        batch_op.drop_column('returned_at')
        batch_op.drop_column('evidence_urls')
        batch_op.drop_column('detected_responsible')
        batch_op.drop_column('detected_location')
        batch_op.drop_column('severity')

    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('last_login')
        batch_op.drop_column('locked_until')
        batch_op.drop_column('failed_login_attempts')
