"""Server-side schema. This is the complete list of what Longhand stores about a user
(DECISIONS §6 /privacy must match it; /v1/schema exposes it and a test checks Alembic agrees).

No table holds document text, events, sources or keystrokes. Checkpoints hold hashes only.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    trial_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    free_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    referral_code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    referred_by: Mapped[str | None] = mapped_column(String(32), ForeignKey("users.id", ondelete="SET NULL"))
    referral_credits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    renewal_reminded_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MagicLink(Base):
    __tablename__ = "magic_links"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class WebSession(Base):
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ApiToken(Base):
    __tablename__ = "api_tokens"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(32), nullable=False, default="extension")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Subscription(Base):
    __tablename__ = "subscriptions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # Stripe subscription id
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan: Mapped[str] = mapped_column(String(16), nullable=False)  # semester | monthly
    status: Mapped[str] = mapped_column(String(32), nullable=False)  # Stripe status
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Referral(Base):
    __tablename__ = "referrals"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    referrer_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    referred_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    credited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class CheckpointRow(Base):
    __tablename__ = "checkpoints"
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    doc: Mapped[str] = mapped_column(String(200), primary_key=True)
    seq: Mapped[int] = mapped_column(Integer, primary_key=True)
    hash: Mapped[str] = mapped_column(String(64), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)  # canonical JSON: heads (hashes), counts, timestamps
    signature: Mapped[str] = mapped_column(String(128), nullable=False)
    key_id: Mapped[str] = mapped_column(String(16), nullable=False)


class TransparencyEntry(Base):
    __tablename__ = "transparency_log"
    seq: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    entry_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    prev: Mapped[str] = mapped_column(String(64), nullable=False)
    checkpoint_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    ts: Mapped[str] = mapped_column(String(32), nullable=False)


class Doc(Base):
    __tablename__ = "docs"
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    doc: Mapped[str] = mapped_column(String(200), primary_key=True)  # random id minted by the extension, never the editor's
    first_seen: Mapped[str] = mapped_column(String(32), nullable=False)
    last_seen: Mapped[str] = mapped_column(String(32), nullable=False)
    last_checkpoint: Mapped[str | None] = mapped_column(String(32))  # ts of the latest signed checkpoint


Index("ix_magic_links_user", MagicLink.user_id)
Index("ix_sessions_user", WebSession.user_id)
Index("ix_api_tokens_user", ApiToken.user_id)
Index("ix_subscriptions_user", Subscription.user_id)
Index("ix_referrals_referrer", Referral.referrer_id)


# Plain-English description of every table and column, rendered on /privacy (generated into
# web/src/marketing/pages/schema.generated.ts by `python -m trail.server.gen_schema`) and served at
# /v1/schema. tests/test_privacy.py fails if any column here is missing a description.
DESCRIPTIONS: dict[str, tuple[str, dict[str, str]]] = {
    "users": ("One row per account.", {
        "id": "random id",
        "email": "where login links and renewal reminders go",
        "created_at": "when the account was made",
        "last_login_at": "when you last used a login link",
        "trial_started_at": "when your first replay played; the 14 days count from here",
        "free_until": "end of any free semester earned with invites",
        "referral_code": "the code in your invite link",
        "referred_by": "who invited you, if anyone",
        "referral_credits": "how many free semesters invites have earned you (max 3)",
        "stripe_customer_id": "so Stripe can find your subscription; we never see your card",
        "renewal_reminded_for": "which renewal we last emailed you about, so we do not email twice",
    }),
    "magic_links": ("Login links. Each works once and expires 30 minutes after it is sent.", {
        "id": "random id",
        "user_id": "who it signs in",
        "token_hash": "a hash of the link token; the token itself is only in your email",
        "created_at": "when it was sent",
        "expires_at": "when it stops working",
        "used_at": "when it was used, if it was",
    }),
    "sessions": ("Keeps you signed in to the web app.", {
        "id": "random id",
        "user_id": "whose login",
        "token_hash": "a hash of the cookie value, never the cookie itself",
        "created_at": "when you signed in",
        "expires_at": "when it stops working (90 days)",
        "last_seen_at": "last request with it",
    }),
    "api_tokens": ("Lets the extension ask us to sign checkpoints.", {
        "id": "random id",
        "user_id": "whose extension",
        "token_hash": "a hash of the token, never the token itself",
        "label": "which client holds it (always \"extension\" today)",
        "created_at": "when it was issued",
        "last_used_at": "last checkpoint request",
        "revoked_at": "when it was replaced or revoked, if it was",
    }),
    "subscriptions": ("A copy of what Stripe tells us about your plan.", {
        "id": "the Stripe subscription id",
        "user_id": "whose plan",
        "plan": "semester or monthly",
        "status": "active, past_due, canceled, and so on, as Stripe reports it",
        "current_period_end": "when it renews or ends",
        "cancel_at_period_end": "whether you asked it to stop at the end of the period",
        "created_at": "when it started",
        "updated_at": "last change from Stripe",
    }),
    "referrals": ("Counting invites toward a free semester.", {
        "id": "random id",
        "referrer_id": "who invited",
        "referred_id": "who accepted",
        "created_at": "when the friend signed up with the code",
        "activated_at": "when the friend played a first replay",
        "credited": "whether this invite has already counted toward a free semester",
    }),
    "checkpoints": ("One row per signed checkpoint: the fingerprint of your record at a moment, roughly every ten minutes of writing.", {
        "user_id": "whose record",
        "doc": "a random id the extension made up for the document; not the editor's id, not the title",
        "seq": "which checkpoint this is for that document (0, 1, 2, ...)",
        "hash": "the 64-character fingerprint of the checkpoint",
        "body": "what was signed: per-session chain-head hashes, event counts and timestamps, as JSON. No text.",
        "signature": "our signature over the body",
        "key_id": "which signing key we used",
    }),
    "transparency_log": ("Append-only public log of every checkpoint we sign, so we cannot quietly re-sign history. Never deleted, even when an account is.", {
        "seq": "position in the log",
        "entry_hash": "fingerprint of this entry, chained to the previous one",
        "prev": "the previous entry's fingerprint",
        "checkpoint_hash": "fingerprint of the checkpoint",
        "ts": "when it was signed",
    }),
    "docs": ("One row per document the extension has had signed, so the app can show when it was last signed.", {
        "user_id": "whose document",
        "doc": "the same random id as in checkpoints; not the editor's id, not the title",
        "first_seen": "first checkpoint time",
        "last_seen": "latest checkpoint time",
        "last_checkpoint": "time of the latest signature",
    }),
}


def schema_description() -> list[dict]:
    """Every table and column, with its plain-English meaning, for /v1/schema and /privacy."""
    out = []
    for t in Base.metadata.sorted_tables:
        why, cols = DESCRIPTIONS.get(t.name, ("", {}))
        out.append({"table": t.name, "why": why,
                    "columns": [{"name": c.name, "type": str(c.type), "what": cols.get(c.name, "")} for c in t.columns]})
    return out
