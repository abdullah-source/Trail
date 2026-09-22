"""Clerk sign-in (optional). The web app signs the student in with Clerk's hosted box, then
posts Clerk's session token to /v1/auth/clerk. We verify the token's signature against
Clerk's public keys (JWKS), look the user up with the secret key to get their email, and
from there it is our normal session cookie. Clerk never sees the writing record.

    CLERK_PUBLISHABLE_KEY   pk_test_... / pk_live_... (also served to the web app via /v1/config)
    CLERK_SECRET_KEY        sk_test_... / sk_live_...

Without both keys the magic-link flow stays the only way in."""

from __future__ import annotations

import base64
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Protocol

log = logging.getLogger("trail.clerk")


class ClerkVerifier(Protocol):
    configured: bool
    publishable_key: str | None

    def email_for_token(self, token: str) -> str | None:
        """Verified primary email for a Clerk session token, or None if the token is bad."""
        ...


def frontend_api_from_publishable_key(pk: str) -> str | None:
    """pk_test_<base64 of 'foo.clerk.accounts.dev$'> -> https://foo.clerk.accounts.dev"""
    try:
        payload = pk.split("_", 2)[2]
        payload += "=" * (-len(payload) % 4)
        host = base64.b64decode(payload).decode().rstrip("$")
        return f"https://{host}" if host and "." in host else None
    except Exception:
        return None


@dataclass
class ClerkClient:
    publishable_key: str | None
    secret_key: str | None
    _jwks: dict[str, Any] | None = field(default=None, repr=False)
    _jwks_at: float = 0.0
    _emails: dict[str, tuple[str, float]] = field(default_factory=dict, repr=False)

    @property
    def configured(self) -> bool:
        return bool(self.publishable_key and self.secret_key and self.frontend_api)

    @property
    def frontend_api(self) -> str | None:
        return frontend_api_from_publishable_key(self.publishable_key) if self.publishable_key else None

    def _jwks_get(self) -> dict[str, Any]:
        import httpx

        if self._jwks is None or time.time() - self._jwks_at > 3600:
            r = httpx.get(f"{self.frontend_api}/.well-known/jwks.json", timeout=10)
            r.raise_for_status()
            self._jwks, self._jwks_at = r.json(), time.time()
        return self._jwks

    def _verify(self, token: str) -> dict[str, Any] | None:
        import jwt

        try:
            header = jwt.get_unverified_header(token)
            keys = [k for k in self._jwks_get().get("keys", []) if k.get("kid") == header.get("kid")]
            if not keys:  # key rotation: refetch once
                self._jwks = None
                keys = [k for k in self._jwks_get().get("keys", []) if k.get("kid") == header.get("kid")]
            if not keys:
                return None
            key = jwt.PyJWK(keys[0]).key
            return jwt.decode(token, key=key, algorithms=["RS256"], options={"require": ["sub", "exp", "iat"]}, leeway=10)
        except Exception as e:  # expired, bad signature, malformed
            log.info("clerk token rejected: %s", type(e).__name__)
            return None

    def _email_for_user(self, user_id: str) -> str | None:
        import httpx

        hit = self._emails.get(user_id)
        if hit and time.time() - hit[1] < 600:
            return hit[0]
        r = httpx.get(f"https://api.clerk.com/v1/users/{user_id}", timeout=10, headers={"Authorization": f"Bearer {self.secret_key}"})
        if r.status_code != 200:
            log.warning("clerk user lookup failed status=%s", r.status_code)
            return None
        u = r.json()
        primary = u.get("primary_email_address_id")
        emails = u.get("email_addresses") or []
        chosen = next((e for e in emails if e.get("id") == primary), emails[0] if emails else None)
        if not chosen:
            return None
        if (chosen.get("verification") or {}).get("status") not in (None, "verified"):
            return None
        email = str(chosen.get("email_address", "")).strip().lower()
        if email:
            self._emails[user_id] = (email, time.time())
        return email or None

    def email_for_token(self, token: str) -> str | None:
        if not self.configured:
            return None
        claims = self._verify(token)
        if not claims:
            return None
        return self._email_for_user(str(claims["sub"]))


@dataclass
class FakeClerk:
    """Tests: maps token -> email."""
    tokens: dict[str, str] = field(default_factory=dict)
    publishable_key: str | None = "pk_test_Zm9vLmNsZXJrLmFjY291bnRzLmRldiQ"
    configured: bool = True

    def email_for_token(self, token: str) -> str | None:
        return self.tokens.get(token)
