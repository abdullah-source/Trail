"""Waitlist: emails of people who want to hear when the Web Store listing is live.

Revision ID: 0003
Revises: 0002
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'waitlist',
        sa.Column('email', sa.String(length=254), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('source', sa.String(length=40), nullable=True),
        sa.PrimaryKeyConstraint('email'),
    )


def downgrade() -> None:
    op.drop_table('waitlist')
