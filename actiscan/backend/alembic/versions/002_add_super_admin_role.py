"""Add super_admin role

Revision ID: 002
Revises: 001
Create Date: 2026-07-03
"""
from alembic import op
import sqlalchemy as sa

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # The initial migration stores `role` as VARCHAR(20).
    # However, if the schema was bootstrapped via create_all() instead of
    # `alembic upgrade head`, SQLAlchemy created a native PostgreSQL enum type
    # called `userrole`.  We handle both cases here.
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_type "
            "WHERE typname = 'userrole' AND typtype = 'e'"
        )
    )
    if result.fetchone():
        # Native enum exists — add the new value (IF NOT EXISTS avoids errors
        # if this migration is accidentally run twice).
        conn.execute(
            sa.text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'super_admin' BEFORE 'admin'")
        )
    # If the column is already VARCHAR the new value works without any DDL.


def downgrade() -> None:
    # PostgreSQL does not support removing individual values from an enum type
    # without recreating it.  A full recreation would require rewriting every
    # dependent table, so downgrade is intentionally a no-op.
    # To fully roll back: drop and recreate the DB, then run `alembic upgrade head`.
    pass
