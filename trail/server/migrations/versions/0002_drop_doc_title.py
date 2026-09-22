"""Stop storing document titles: the extension keeps them locally and never sends them.

Revision ID: 0002
Revises: 0001
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('docs', schema=None) as batch_op:
        batch_op.drop_column('title')


def downgrade() -> None:
    with op.batch_alter_table('docs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('title', sa.String(length=200), nullable=True))
