"""Change qr_code_url from VARCHAR(255) to TEXT

Revision ID: 004
Revises: 003
Create Date: 2026-08-03
"""
from alembic import op
import sqlalchemy as sa

revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('assets') as batch_op:
        batch_op.alter_column(
            'qr_code_url',
            type_=sa.Text(),
            existing_type=sa.String(255),
            existing_nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table('assets') as batch_op:
        batch_op.alter_column(
            'qr_code_url',
            type_=sa.String(255),
            existing_type=sa.Text(),
            existing_nullable=True,
        )
