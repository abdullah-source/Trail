"""Environment configuration (DECISIONS §5).

    DATABASE_URL            postgresql://...  (Railway) — falls back to a local SQLite file
    TRAIL_SIGNING_KEY    Ed25519 private key, PEM *contents*
    SESSION_SECRET          HMAC key for session / token hashes
    APP_URL                 public origin, e.g. https://trail.app
    RESEND_API_KEY, RESEND_FROM
    STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_SEMESTER, STRIPE_PRICE_MONTHLY
    SENTRY_DSN              optional
    SIGNUP_OPEN             "1" (default) or "0": whether new emails may create accounts
    MAIL_TO_LOG             "1": run in production without an email provider; sign-in links are
                            written to the server log (early access only, read them with railway logs)
    CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY   optional hosted sign-in (Google, email codes); with both
                            set the web app shows Clerk's sign-in box and magic links become the fallback
    FREE_ACCESS             "1": every account has every feature, no trial clock, no paywall.
                            Defaults to "1" while STRIPE_SECRET_KEY is unset, "0" once it is set.
    TRAIL_ENV            "production" forces the production checks even on an http APP_URL

Production (APP_URL is https, or TRAIL_ENV=production) refuses to boot without a real
SESSION_SECRET, TRAIL_SIGNING_KEY and RESEND_API_KEY: see require_production_config().
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


DEV_SESSION_SECRET = "dev-secret-change-me"


def _normalise_db_url(url: str) -> str:
    # Railway hands out postgresql://; SQLAlchemy 2 + psycopg 3 wants postgresql+psycopg://
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


@dataclass
class Settings:
    database_url: str
    data_dir: Path
    signing_key_pem: str | None
    signing_key_path: Path | None
    session_secret: str
    app_url: str
    resend_api_key: str | None
    resend_from: str
    clerk_publishable_key: str | None
    clerk_secret_key: str | None
    stripe_secret_key: str | None
    stripe_webhook_secret: str | None
    stripe_price_semester: str | None
    stripe_price_monthly: str | None
    sentry_dsn: str | None
    signup_open: bool
    free_access: bool = True
    mail_to_log: bool = False  # MAIL_TO_LOG=1: acknowledged no-email deploy; links go to the log
    production: bool = False
    trial_days: int = 14
    semester_months: int = 4
    refund_days: int = 14
    referrals_per_semester: int = 3
    max_referral_semesters: int = 3

    @property
    def secure_cookies(self) -> bool:
        return self.app_url.startswith("https://")

    def missing_for_production(self) -> list[str]:
        """Names of variables that must be set before a production boot, with the reason."""
        missing = []
        if not self.session_secret or self.session_secret == DEV_SESSION_SECRET or len(self.session_secret) < 32:
            missing.append("SESSION_SECRET (at least 32 random characters; the dev default hashes every session and token)")
        if not self.signing_key_pem:
            missing.append("TRAIL_SIGNING_KEY (PEM contents; without it a new key would be generated on every deploy)")
        if not self.resend_api_key and not self.mail_to_log and not (self.clerk_publishable_key and self.clerk_secret_key):
            missing.append("RESEND_API_KEY (without it magic links are printed to the log instead of emailed; set MAIL_TO_LOG=1 to accept that on purpose, or configure Clerk)")
        return missing

    def require_production_config(self) -> None:
        missing = self.missing_for_production()
        if missing:
            raise RuntimeError("refusing to start in production: " + "; ".join(missing))

    @classmethod
    def from_env(cls, env: dict[str, str] | None = None) -> "Settings":
        e = os.environ if env is None else env
        data_dir = Path(e.get("TRAIL_DATA_DIR", "trail-data"))
        db = e.get("DATABASE_URL") or f"sqlite:///{data_dir / 'trail.sqlite'}"
        key_path = e.get("TRAIL_SIGNING_KEY_PATH")
        return cls(
            database_url=_normalise_db_url(db),
            data_dir=data_dir,
            signing_key_pem=e.get("TRAIL_SIGNING_KEY") or None,
            signing_key_path=Path(key_path) if key_path else None,
            session_secret=e.get("SESSION_SECRET") or DEV_SESSION_SECRET,
            app_url=(e.get("APP_URL") or "http://localhost:8100").rstrip("/"),
            resend_api_key=e.get("RESEND_API_KEY") or None,
            resend_from=e.get("RESEND_FROM") or "Trail <hello@trail.app>",
            clerk_publishable_key=e.get("CLERK_PUBLISHABLE_KEY") or None,
            clerk_secret_key=e.get("CLERK_SECRET_KEY") or None,
            mail_to_log=(e.get("MAIL_TO_LOG") or "0") == "1",
            stripe_secret_key=e.get("STRIPE_SECRET_KEY") or None,
            stripe_webhook_secret=e.get("STRIPE_WEBHOOK_SECRET") or None,
            stripe_price_semester=e.get("STRIPE_PRICE_SEMESTER") or None,
            stripe_price_monthly=e.get("STRIPE_PRICE_MONTHLY") or None,
            sentry_dsn=e.get("SENTRY_DSN") or None,
            signup_open=(e.get("SIGNUP_OPEN") or e.get("TRAIL_SIGNUP_OPEN") or "1") == "1",
            free_access=(e.get("FREE_ACCESS") or ("0" if e.get("STRIPE_SECRET_KEY") else "1")) == "1",
            production=(e.get("TRAIL_ENV") == "production") or (e.get("APP_URL") or "").startswith("https://"),
        )
