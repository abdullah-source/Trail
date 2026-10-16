"""Referral waitlist: share code, who invited, confirmed referrals, email confirmation.

Existing rows get a fresh share code and count as unconfirmed.

Revision ID: 0004
Revises: 0003
"""
from __future__ import annotations

import secrets

from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # base32 without I, O, 0, 1


def upgrade() -> None:
    with op.batch_alter_table('waitlist', schema=None) as b:
        b.add_column(sa.Column('code', sa.String(length=16), nullable=True))
        b.add_column(sa.Column('referred_by', sa.String(length=16), nullable=True))
        b.add_column(sa.Column('referrals', sa.Integer(), nullable=False, server_default='0'))
        b.add_column(sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True))
        b.add_column(sa.Column('confirm_token_hash', sa.String(length=64), nullable=True))

    conn = op.get_bind()
    waitlist = sa.table('waitlist', sa.column('email', sa.String), sa.column('code', sa.String))
    used: set[str] = set()
    for (email,) in conn.execute(sa.select(waitlist.c.email)).all():
        code = "".join(secrets.choice(ALPHABET) for _ in range(8))
        while code in used:
            code = "".join(secrets.choice(ALPHABET) for _ in range(8))
        used.add(code)
        conn.execute(waitlist.update().where(waitlist.c.email == email).values(code=code))

    with op.batch_alter_table('waitlist', schema=None) as b:
        b.alter_column('code', existing_type=sa.String(length=16), nullable=False)
        b.create_unique_constraint('uq_waitlist_code', ['code'])
        b.create_unique_constraint('uq_waitlist_confirm_token_hash', ['confirm_token_hash'])


def downgrade() -> None:
    with op.batch_alter_table('waitlist', schema=None) as b:
        b.drop_constraint('uq_waitlist_confirm_token_hash', type_='unique')
        b.drop_constraint('uq_waitlist_code', type_='unique')
        b.drop_column('confirm_token_hash')
        b.drop_column('confirmed_at')
        b.drop_column('referrals')
        b.drop_column('referred_by')
        b.drop_column('code')
