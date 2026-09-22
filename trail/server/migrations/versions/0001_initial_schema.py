"""Initial Trail schema: users, magic_links, sessions, api_tokens, subscriptions, referrals,
checkpoints, transparency_log, docs. No table holds document text (see trail/server/models.py).

Revision ID: 0001
Revises: 
Create Date: 2026-09-21 15:50:04.843260
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('transparency_log',
    sa.Column('seq', sa.Integer(), autoincrement=False, nullable=False),
    sa.Column('entry_hash', sa.String(length=64), nullable=False),
    sa.Column('prev', sa.String(length=64), nullable=False),
    sa.Column('checkpoint_hash', sa.String(length=64), nullable=False),
    sa.Column('ts', sa.String(length=32), nullable=False),
    sa.PrimaryKeyConstraint('seq')
    )
    op.create_table('users',
    sa.Column('id', sa.String(length=32), nullable=False),
    sa.Column('email', sa.String(length=254), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('trial_started_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('free_until', sa.DateTime(timezone=True), nullable=True),
    sa.Column('referral_code', sa.String(length=16), nullable=False),
    sa.Column('referred_by', sa.String(length=32), nullable=True),
    sa.Column('referral_credits', sa.Integer(), nullable=False),
    sa.Column('stripe_customer_id', sa.String(length=64), nullable=True),
    sa.Column('renewal_reminded_for', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['referred_by'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email'),
    sa.UniqueConstraint('referral_code'),
    sa.UniqueConstraint('stripe_customer_id')
    )
    op.create_table('api_tokens',
    sa.Column('id', sa.String(length=32), nullable=False),
    sa.Column('user_id', sa.String(length=32), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('label', sa.String(length=32), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    with op.batch_alter_table('api_tokens', schema=None) as batch_op:
        batch_op.create_index('ix_api_tokens_user', ['user_id'], unique=False)

    op.create_table('checkpoints',
    sa.Column('user_id', sa.String(length=32), nullable=False),
    sa.Column('doc', sa.String(length=200), nullable=False),
    sa.Column('seq', sa.Integer(), nullable=False),
    sa.Column('hash', sa.String(length=64), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('signature', sa.String(length=128), nullable=False),
    sa.Column('key_id', sa.String(length=16), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('user_id', 'doc', 'seq')
    )
    op.create_table('docs',
    sa.Column('user_id', sa.String(length=32), nullable=False),
    sa.Column('doc', sa.String(length=200), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=True),
    sa.Column('first_seen', sa.String(length=32), nullable=False),
    sa.Column('last_seen', sa.String(length=32), nullable=False),
    sa.Column('last_checkpoint', sa.String(length=32), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('user_id', 'doc')
    )
    op.create_table('magic_links',
    sa.Column('id', sa.String(length=32), nullable=False),
    sa.Column('user_id', sa.String(length=32), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    with op.batch_alter_table('magic_links', schema=None) as batch_op:
        batch_op.create_index('ix_magic_links_user', ['user_id'], unique=False)

    op.create_table('referrals',
    sa.Column('id', sa.String(length=32), nullable=False),
    sa.Column('referrer_id', sa.String(length=32), nullable=False),
    sa.Column('referred_id', sa.String(length=32), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('activated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('credited', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['referred_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['referrer_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('referred_id')
    )
    with op.batch_alter_table('referrals', schema=None) as batch_op:
        batch_op.create_index('ix_referrals_referrer', ['referrer_id'], unique=False)

    op.create_table('sessions',
    sa.Column('id', sa.String(length=32), nullable=False),
    sa.Column('user_id', sa.String(length=32), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    with op.batch_alter_table('sessions', schema=None) as batch_op:
        batch_op.create_index('ix_sessions_user', ['user_id'], unique=False)

    op.create_table('subscriptions',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('user_id', sa.String(length=32), nullable=False),
    sa.Column('plan', sa.String(length=16), nullable=False),
    sa.Column('status', sa.String(length=32), nullable=False),
    sa.Column('current_period_end', sa.DateTime(timezone=True), nullable=True),
    sa.Column('cancel_at_period_end', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('subscriptions', schema=None) as batch_op:
        batch_op.create_index('ix_subscriptions_user', ['user_id'], unique=False)



def downgrade() -> None:
    with op.batch_alter_table('subscriptions', schema=None) as batch_op:
        batch_op.drop_index('ix_subscriptions_user')

    op.drop_table('subscriptions')
    with op.batch_alter_table('sessions', schema=None) as batch_op:
        batch_op.drop_index('ix_sessions_user')

    op.drop_table('sessions')
    with op.batch_alter_table('referrals', schema=None) as batch_op:
        batch_op.drop_index('ix_referrals_referrer')

    op.drop_table('referrals')
    with op.batch_alter_table('magic_links', schema=None) as batch_op:
        batch_op.drop_index('ix_magic_links_user')

    op.drop_table('magic_links')
    op.drop_table('docs')
    op.drop_table('checkpoints')
    with op.batch_alter_table('api_tokens', schema=None) as batch_op:
        batch_op.drop_index('ix_api_tokens_user')

    op.drop_table('api_tokens')
    op.drop_table('users')
    op.drop_table('transparency_log')
