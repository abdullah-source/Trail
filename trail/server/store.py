"""SQLAlchemy repository. Same interface as the old sqlite Store for checkpoints, docs and the
transparency log, plus users, magic links, sessions, API tokens, subscriptions and referrals.

Nothing in here ever receives document text or events."""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from typing import Any, Iterable

from sqlalchemy import create_engine, delete, func, select, update
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from trail.core.canonical import GENESIS_HASH, hash_value
from trail.core.signing import Checkpoint, Signer, changed_heads, make_checkpoint
from trail.core.timeutil import now_ts
from trail.server.models import (
    ApiToken, Base, CheckpointRow, Doc, MagicLink, Referral, Subscription, TransparencyEntry, User, WaitlistEntry, WebSession,
)

TRIAL_DAYS = 14
SEMESTER_DAYS = 4 * 30 + 2      # "4 months"
MAGIC_LINK_MINUTES = 30
SESSION_DAYS = 90
MAGIC_LINKS_PER_WINDOW = 5
MAGIC_LINK_WINDOW_MINUTES = 15


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def aware(dt: datetime | None) -> datetime | None:
    """SQLite drops tzinfo; everything we store is UTC."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def iso(dt: datetime | None) -> str | None:
    return None if dt is None else aware(dt).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _id() -> str:
    return secrets.token_hex(8)


def _referral_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))


class PlanInfo(dict):
    pass


# -- referral waitlist ------------------------------------------------------------------------------

WAITLIST_PLACES_PER_REFERRAL = 5


def waitlist_positions(rows: Iterable[tuple[str, datetime, int]]) -> dict[str, int]:
    """Queue position for every entry, 1-based. rows are (code, created_at, confirmed referrals).

    Rule: an entry's join index is its 1-based rank by created_at. Its score is
    join index - 5 x confirmed referrals; the queue is sorted by score, ties broken by created_at
    (earlier joiner first). So each friend who confirms moves you up five places. Computed in
    Python over the whole table, which is fine at waitlist scale."""
    joined = sorted(rows, key=lambda r: (aware(r[1]), r[0]))
    scored = [(i - WAITLIST_PLACES_PER_REFERRAL * (refs or 0), aware(created), i, code)
              for i, (code, created, refs) in enumerate(joined, 1)]
    scored.sort()
    return {code: pos for pos, (_, _, _, code) in enumerate(scored, 1)}


@dataclass
class WaitlistJoin:
    entry: WaitlistEntry
    new: bool
    confirm_token: str | None  # raw token to email; None when the address is already confirmed


class Store:
    def __init__(self, url: str = "sqlite://", *, secret: str = "dev-secret-change-me", create_schema: bool | None = None, echo: bool = False,
                 free_access: bool = False):
        url = str(url)
        # FREE_ACCESS: every account is entitled to everything, no trial clock, no paywall.
        self.free_access = free_access
        if "://" not in url:  # a bare path, or ":memory:" (old Store signature)
            url = "sqlite://" if url in (":memory:", "") else f"sqlite:///{url}"
        self.url = url
        self._secret = secret.encode()
        kw: dict[str, Any] = {"echo": echo, "future": True}
        if url.startswith("sqlite"):
            kw["connect_args"] = {"check_same_thread": False}
            if url in ("sqlite://", "sqlite:///:memory:"):
                kw["poolclass"] = StaticPool
        self.engine = create_engine(url, **kw)
        if url.startswith("sqlite"):
            from sqlalchemy import event

            @event.listens_for(self.engine, "connect")
            def _fk(dbapi_conn, _rec):  # pragma: no cover - trivial
                dbapi_conn.execute("PRAGMA foreign_keys=ON")
        self.Session = sessionmaker(self.engine, expire_on_commit=False)
        if create_schema if create_schema is not None else url.startswith("sqlite"):
            Base.metadata.create_all(self.engine)

    # -- hashing --------------------------------------------------------------------

    def token_hash(self, token: str) -> str:
        return hmac.new(self._secret, token.encode(), hashlib.sha256).hexdigest()

    def session(self) -> Session:
        return self.Session()

    # -- users ----------------------------------------------------------------------

    def get_user(self, uid: str) -> User | None:
        with self.session() as s:
            return s.get(User, uid)

    def user_by_email(self, email: str) -> User | None:
        with self.session() as s:
            return s.scalar(select(User).where(User.email == email.lower()))

    def user_by_referral_code(self, code: str) -> User | None:
        with self.session() as s:
            return s.scalar(select(User).where(User.referral_code == code.upper()))

    def get_or_create_user(self, email: str, *, referred_by: str | None = None, allow_create: bool = True) -> tuple[User | None, bool]:
        email = email.strip().lower()
        with self.session() as s:
            u = s.scalar(select(User).where(User.email == email))
            if u:
                return u, False
            if not allow_create:
                return None, False
            for _ in range(10):
                code = _referral_code()
                if not s.scalar(select(User).where(User.referral_code == code)):
                    break
            u = User(id=_id(), email=email, created_at=utcnow(), referral_code=code, referred_by=referred_by, referral_credits=0)
            s.add(u)
            s.flush()  # the referral row references this user; no relationship() orders the inserts
            if referred_by and referred_by != u.id:
                s.add(Referral(id=_id(), referrer_id=referred_by, referred_id=u.id, created_at=utcnow()))
            s.commit()
            return u, True

    def create_user(self, email: str) -> tuple[str, str]:
        """Compatibility helper (tests, scripts): make a user and an extension token."""
        u, _ = self.get_or_create_user(email)
        assert u is not None
        return u.id, self.create_api_token(u.id)

    def delete_user(self, uid: str) -> None:
        with self.session() as s:
            for model in (Referral,):
                s.execute(delete(model).where((model.referrer_id == uid) | (model.referred_id == uid)))
            for model in (MagicLink, WebSession, ApiToken, Subscription, CheckpointRow, Doc):
                s.execute(delete(model).where(model.user_id == uid))
            u = s.get(User, uid)
            if u:
                s.execute(delete(WaitlistEntry).where(WaitlistEntry.email == u.email))
            s.execute(delete(User).where(User.id == uid))
            s.commit()

    # -- magic links --------------------------------------------------------------------

    def create_magic_link(self, uid: str) -> str | None:
        """Returns the raw token, or None when the user is over the rate limit."""
        with self.session() as s:
            since = utcnow() - timedelta(minutes=MAGIC_LINK_WINDOW_MINUTES)
            n = s.scalar(select(func.count()).select_from(MagicLink).where(MagicLink.user_id == uid, MagicLink.created_at >= since)) or 0
            if n >= MAGIC_LINKS_PER_WINDOW:
                return None
            token = "tr_" + secrets.token_urlsafe(32)
            s.add(MagicLink(id=_id(), user_id=uid, token_hash=self.token_hash(token), created_at=utcnow(),
                            expires_at=utcnow() + timedelta(minutes=MAGIC_LINK_MINUTES)))
            s.commit()
            return token

    def consume_magic_link(self, token: str) -> tuple[User | None, bool]:
        """Returns (user, first_login). (None, False) when the token is unknown, used or expired."""
        with self.session() as s:
            ml = s.scalar(select(MagicLink).where(MagicLink.token_hash == self.token_hash(token)))
            if not ml or ml.used_at or aware(ml.expires_at) < utcnow():
                return None, False
            ml.used_at = utcnow()
            u = s.get(User, ml.user_id)
            first = False
            if u:
                first = u.last_login_at is None
                u.last_login_at = utcnow()
            s.commit()
            return u, first

    # -- web sessions -----------------------------------------------------------------------

    # -- waitlist -----------------------------------------------------------------------------------------

    def _waitlist_code(self, s: Session) -> str:
        for _ in range(20):
            code = _referral_code()
            if not s.scalar(select(WaitlistEntry).where(WaitlistEntry.code == code)):
                return code
        raise RuntimeError("could not mint a unique waitlist code")

    def join_waitlist(self, email: str, source: str | None = None, ref: str | None = None) -> WaitlistJoin:
        """Add an address, or return the existing entry (same code, no duplicate). `ref` is another
        entry's share code; unknown codes and the entry's own code are ignored. An unconfirmed
        entry gets a fresh confirmation token each time (the old link stops working)."""
        email = email.strip().lower()
        ref = (ref or "").strip().upper() or None
        with self.session() as s:
            e = s.get(WaitlistEntry, email)
            new = e is None
            if e is None:
                referrer = s.scalar(select(WaitlistEntry).where(WaitlistEntry.code == ref)) if ref else None
                e = WaitlistEntry(email=email, created_at=utcnow(), source=(source or None), code=self._waitlist_code(s),
                                  referred_by=referrer.code if referrer and referrer.email != email else None, referrals=0)
                s.add(e)
            token = None
            if e.confirmed_at is None:
                token = "wl_" + secrets.token_urlsafe(24)
                e.confirm_token_hash = self.token_hash(token)
            s.commit()
            return WaitlistJoin(entry=e, new=new, confirm_token=token)

    def waitlist_entry(self, code: str) -> WaitlistEntry | None:
        with self.session() as s:
            return s.scalar(select(WaitlistEntry).where(WaitlistEntry.code == code.strip().upper()))

    def waitlist_status(self, code: str) -> dict[str, Any] | None:
        """Position, confirmed referrals and queue size for one share code; None when unknown."""
        code = code.strip().upper()
        with self.session() as s:
            rows = s.execute(select(WaitlistEntry.code, WaitlistEntry.created_at, WaitlistEntry.referrals, WaitlistEntry.confirmed_at)).all()
        me = next((r for r in rows if r.code == code), None)
        if me is None:
            return None
        positions = waitlist_positions((r.code, r.created_at, r.referrals) for r in rows)
        return {"code": code, "position": positions[code], "referrals": me.referrals, "total": len(rows), "confirmed": me.confirmed_at is not None}

    def waitlist_stats(self) -> dict[str, int]:
        with self.session() as s:
            total = s.scalar(select(func.count()).select_from(WaitlistEntry)) or 0
            confirmed = s.scalar(select(func.count()).select_from(WaitlistEntry).where(WaitlistEntry.confirmed_at.is_not(None))) or 0
        return {"total": total, "confirmed": confirmed}

    def confirm_waitlist(self, token: str) -> tuple[WaitlistEntry | None, bool]:
        """Mark the address confirmed. Returns (entry, referrer_credited). The referrer's count goes
        up once, only here, only on the first confirmation, and never for the entry's own code.
        A second click on the same link is harmless: (entry, False)."""
        with self.session() as s:
            e = s.scalar(select(WaitlistEntry).where(WaitlistEntry.confirm_token_hash == self.token_hash(token)))
            if e is None:
                return None, False
            # conditional update so two clicks racing cannot both credit the referrer
            first = s.execute(update(WaitlistEntry).where(WaitlistEntry.email == e.email, WaitlistEntry.confirmed_at.is_(None))
                              .values(confirmed_at=utcnow())).rowcount == 1
            credited = False
            if first and e.referred_by and e.referred_by != e.code:
                credited = s.execute(update(WaitlistEntry).where(WaitlistEntry.code == e.referred_by, WaitlistEntry.email != e.email)
                                     .values(referrals=WaitlistEntry.referrals + 1)).rowcount == 1
            s.commit()
            s.refresh(e)
            return e, credited

    def resolve_referrer(self, code: str | None) -> User | None:
        """The account behind an invite code: a user's own referral code, or a waitlist share code
        whose address has since made an account."""
        if not code:
            return None
        code = code.strip().upper()
        with self.session() as s:
            u = s.scalar(select(User).where(User.referral_code == code))
            if u:
                return u
            e = s.scalar(select(WaitlistEntry).where(WaitlistEntry.code == code))
            return s.scalar(select(User).where(User.email == e.email)) if e else None

    def waitlist_referrer_user(self, email: str) -> User | None:
        """Waitlist referral -> account referral, applied at first sign-in (the only time
        get_or_create_user records a Referral row). Rule: if this address is on the waitlist and was
        invited with another entry's share code, and that entry's address now has an account, that
        account is the referrer. Signing in proves the address, so confirmation is not required
        here. If the inviter has no account yet, there is no credit (it is not back-filled later)."""
        email = email.strip().lower()
        with self.session() as s:
            e = s.get(WaitlistEntry, email)
            if not e or not e.referred_by:
                return None
            inviter = s.scalar(select(WaitlistEntry).where(WaitlistEntry.code == e.referred_by))
            if not inviter or inviter.email == email:
                return None
            return s.scalar(select(User).where(User.email == inviter.email))

    def create_session(self, uid: str) -> str:
        token = "lhs_" + secrets.token_urlsafe(32)
        with self.session() as s:
            now = utcnow()
            s.add(WebSession(id=_id(), user_id=uid, token_hash=self.token_hash(token), created_at=now,
                             expires_at=now + timedelta(days=SESSION_DAYS), last_seen_at=now))
            s.commit()
        return token

    def user_for_session(self, token: str) -> str | None:
        with self.session() as s:
            ws = s.scalar(select(WebSession).where(WebSession.token_hash == self.token_hash(token)))
            if not ws or aware(ws.expires_at) < utcnow():
                return None
            if (utcnow() - aware(ws.last_seen_at)) > timedelta(minutes=10):
                ws.last_seen_at = utcnow()
                s.commit()
            return ws.user_id

    def delete_session(self, token: str) -> None:
        with self.session() as s:
            s.execute(delete(WebSession).where(WebSession.token_hash == self.token_hash(token)))
            s.commit()

    # -- api tokens (extension) ----------------------------------------------------------------

    def create_api_token(self, uid: str, label: str = "extension") -> str:
        token = "trail_" + secrets.token_urlsafe(24)
        with self.session() as s:
            for old in s.scalars(select(ApiToken).where(ApiToken.user_id == uid, ApiToken.label == label, ApiToken.revoked_at.is_(None))):
                old.revoked_at = utcnow()
            s.add(ApiToken(id=_id(), user_id=uid, token_hash=self.token_hash(token), label=label, created_at=utcnow()))
            s.commit()
        return token

    def user_for_token(self, token: str) -> str | None:
        with self.session() as s:
            t = s.scalar(select(ApiToken).where(ApiToken.token_hash == self.token_hash(token), ApiToken.revoked_at.is_(None)))
            if not t:
                return None
            if not t.last_used_at or (utcnow() - aware(t.last_used_at)) > timedelta(minutes=10):
                t.last_used_at = utcnow()
                s.commit()
            return t.user_id

    # -- plan, trial, referrals --------------------------------------------------------------------

    def active_subscription(self, uid: str) -> Subscription | None:
        with self.session() as s:
            subs = list(s.scalars(select(Subscription).where(Subscription.user_id == uid)))
        live = [x for x in subs if x.status in ("active", "trialing", "past_due")]
        live.sort(key=lambda x: aware(x.current_period_end) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        return live[0] if live else None

    def plan_info(self, uid: str) -> dict[str, Any]:
        u = self.get_user(uid)
        if not u:
            raise KeyError(uid)
        if self.free_access:
            return {"plan": "free", "trialEndsAt": None, "currentPeriodEnd": None}
        now = utcnow()
        sub = self.active_subscription(uid)
        trial_end = aware(u.trial_started_at) + timedelta(days=TRIAL_DAYS) if u.trial_started_at else None
        info: dict[str, Any] = {"plan": "trial", "trialEndsAt": iso(trial_end), "currentPeriodEnd": None}
        if sub and (aware(sub.current_period_end) is None or aware(sub.current_period_end) > now - timedelta(days=3)):
            info["plan"] = sub.plan
            info["currentPeriodEnd"] = iso(sub.current_period_end)
        elif u.free_until and aware(u.free_until) > now:
            info["plan"] = "free"
            info["currentPeriodEnd"] = iso(u.free_until)
        elif trial_end is None or trial_end > now:
            info["plan"] = "trial"
        else:
            info["plan"] = "expired"
        return info

    def is_entitled(self, uid: str) -> bool:
        """Replay, patterns, declaration and packs: trial (started or not), paid, or referral-free."""
        return self.plan_info(uid)["plan"] in ("trial", "semester", "monthly", "free")

    def set_trial_started(self, uid: str, when: datetime | None) -> None:
        """Test / support helper: move the trial clock."""
        with self.session() as s:
            u = s.get(User, uid)
            if u:
                u.trial_started_at = when
                s.commit()

    def activate(self, uid: str) -> dict[str, Any]:
        """First replay: start the trial clock, mark the referral as activated, credit the referrer."""
        with self.session() as s:
            u = s.get(User, uid)
            if not u:
                raise KeyError(uid)
            started = False
            if not u.trial_started_at:
                u.trial_started_at = utcnow()
                started = True
            credited_referrer = None
            r = s.scalar(select(Referral).where(Referral.referred_id == uid))
            if r and not r.activated_at:
                r.activated_at = utcnow()
                s.flush()
                credited_referrer = self._credit_referrer(s, r.referrer_id)
            s.commit()
            return {"trial_started": started, "referrer_credited": credited_referrer}

    def _credit_referrer(self, s: Session, referrer_id: str) -> bool:
        ref = s.get(User, referrer_id)
        if not ref or ref.referral_credits >= 3:
            return False
        uncredited = list(s.scalars(select(Referral).where(Referral.referrer_id == referrer_id, Referral.activated_at.is_not(None), Referral.credited.is_(False))))
        if len(uncredited) < 3:
            return False
        for r in uncredited[:3]:
            r.credited = True
        base = max(aware(ref.free_until) or utcnow(), utcnow())
        ref.free_until = base + timedelta(days=SEMESTER_DAYS)
        ref.referral_credits += 1
        return True

    def referral_summary(self, uid: str) -> dict[str, Any]:
        with self.session() as s:
            u = s.get(User, uid)
            if not u:
                raise KeyError(uid)
            rows = list(s.scalars(select(Referral).where(Referral.referrer_id == uid)))
        activated = sum(1 for r in rows if r.activated_at)
        return {"code": u.referral_code, "invited": len(rows), "activated": activated, "credits": u.referral_credits,
                "progress": (activated - 3 * u.referral_credits) if u.referral_credits < 3 else 0,
                "freeUntil": iso(u.free_until)}

    # -- subscriptions ----------------------------------------------------------------------------------

    def set_stripe_customer(self, uid: str, customer_id: str) -> None:
        with self.session() as s:
            u = s.get(User, uid)
            if u:
                u.stripe_customer_id = customer_id
                s.commit()

    def user_by_customer(self, customer_id: str) -> User | None:
        with self.session() as s:
            return s.scalar(select(User).where(User.stripe_customer_id == customer_id))

    def upsert_subscription(self, *, sub_id: str, uid: str, plan: str, status: str, current_period_end: datetime | None, cancel_at_period_end: bool) -> None:
        with self.session() as s:
            row = s.get(Subscription, sub_id)
            now = utcnow()
            if row:
                row.plan, row.status, row.current_period_end, row.cancel_at_period_end, row.updated_at = plan, status, current_period_end, cancel_at_period_end, now
            else:
                s.add(Subscription(id=sub_id, user_id=uid, plan=plan, status=status, current_period_end=current_period_end,
                                   cancel_at_period_end=cancel_at_period_end, created_at=now, updated_at=now))
            s.commit()

    def subscriptions_renewing_between(self, start: datetime, end: datetime) -> list[tuple[User, Subscription]]:
        with self.session() as s:
            rows = s.execute(select(User, Subscription).join(Subscription, Subscription.user_id == User.id)
                             .where(Subscription.status == "active", Subscription.cancel_at_period_end.is_(False),
                                    Subscription.current_period_end >= start, Subscription.current_period_end <= end)).all()
            return [(u, sub) for u, sub in rows]

    def mark_renewal_reminded(self, uid: str, period_end: datetime) -> None:
        with self.session() as s:
            u = s.get(User, uid)
            if u:
                u.renewal_reminded_for = period_end
                s.commit()

    # -- checkpoints (unchanged interface) -----------------------------------------------------------

    def checkpoints(self, user: str, doc: str) -> list[Checkpoint]:
        with self.session() as s:
            rows = s.scalars(select(CheckpointRow).where(CheckpointRow.user_id == user, CheckpointRow.doc == doc).order_by(CheckpointRow.seq)).all()
        return [Checkpoint(body=json.loads(r.body), signature=r.signature, key_id=r.key_id) for r in rows]

    def checkpoint(self, user: str, doc: str, heads: dict[str, dict[str, Any]], signer: Signer, *, ts: str | None = None) -> Checkpoint | None:
        existing = self.checkpoints(user, doc)
        changed = changed_heads(heads, existing)
        if not changed:
            return None
        prev = existing[-1] if existing else None
        cp = make_checkpoint(signer, tenant=user, agent=doc, heads=changed, all_heads=heads,
                             events=sum(h["seq"] + 1 for h in heads.values()), seq=len(existing),
                             prev_checkpoint=prev.hash if prev else GENESIS_HASH, ts=ts)
        with self.session() as s:
            s.add(CheckpointRow(user_id=user, doc=doc, seq=cp.body["seq"], hash=cp.hash, body=json.dumps(cp.body, sort_keys=True), signature=cp.signature, key_id=cp.key_id))
            last = s.scalar(select(TransparencyEntry).order_by(TransparencyEntry.seq.desc()).limit(1))
            seq = (last.seq + 1) if last else 0
            prevh = last.entry_hash if last else GENESIS_HASH
            s.add(TransparencyEntry(seq=seq, entry_hash=hash_value({"seq": seq, "prev": prevh, "checkpoint": cp.hash}), prev=prevh, checkpoint_hash=cp.hash, ts=cp.body["ts"]))
            d = s.get(Doc, (user, doc))
            if d:
                d.last_seen = cp.body["ts"]
                d.last_checkpoint = cp.body["ts"]
            else:
                s.add(Doc(user_id=user, doc=doc, first_seen=cp.body["ts"], last_seen=cp.body["ts"], last_checkpoint=cp.body["ts"]))
            s.commit()
        return cp

    def docs(self, user: str) -> list[dict[str, Any]]:
        with self.session() as s:
            rows = s.scalars(select(Doc).where(Doc.user_id == user).order_by(Doc.last_seen.desc())).all()
        return [{"doc": d.doc, "first_seen": d.first_seen, "last_seen": d.last_seen, "last_checkpoint": d.last_checkpoint} for d in rows]

    def transparency_log(self) -> list[dict[str, Any]]:
        with self.session() as s:
            rows = s.scalars(select(TransparencyEntry).order_by(TransparencyEntry.seq)).all()
        return [{"seq": r.seq, "entry_hash": r.entry_hash, "prev": r.prev, "checkpoint_hash": r.checkpoint_hash, "ts": r.ts} for r in rows]

    # -- test / audit helper ---------------------------------------------------------------------------------

    def dump_all_text(self) -> str:
        """Every stored value as one string, so a test can assert a sentinel never reached the database."""
        out = []
        with self.session() as s:
            for t in Base.metadata.sorted_tables:
                for row in s.execute(select(t)).all():
                    out.append(repr(tuple(row)))
        return "\n".join(out)


__all__ = ["Store", "WaitlistJoin", "waitlist_positions", "WAITLIST_PLACES_PER_REFERRAL", "utcnow", "aware", "iso", "now_ts", "TRIAL_DAYS", "SEMESTER_DAYS"]
