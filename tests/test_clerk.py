"""ClerkClient verifies a real RS256 token against a JWKS (served here from a key we generate),
rejects tampering and expiry, and maps the subject to an email through the users API."""
from __future__ import annotations

import time

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

from trail.server.clerk import ClerkClient


def _client(monkeypatch):
    priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = jwt.algorithms.RSAAlgorithm.to_jwk(priv.public_key(), as_dict=True) | {"kid": "k1", "alg": "RS256", "use": "sig"}
    c = ClerkClient("pk_test_Zm9vLmNsZXJrLmFjY291bnRzLmRldiQ", "sk_test_x")
    monkeypatch.setattr(c, "_jwks_get", lambda: {"keys": [jwk]})
    monkeypatch.setattr(c, "_email_for_user", lambda uid: {"user_1": "a@b.example"}.get(uid))
    return c, priv


def test_valid_token_maps_to_email(monkeypatch):
    c, priv = _client(monkeypatch)
    assert c.configured and c.frontend_api == "https://foo.clerk.accounts.dev"
    now = int(time.time())
    tok = jwt.encode({"sub": "user_1", "iat": now, "exp": now + 60}, priv, algorithm="RS256", headers={"kid": "k1"})
    assert c.email_for_token(tok) == "a@b.example"


def test_bad_signature_expiry_and_unknown_user_are_rejected(monkeypatch):
    c, priv = _client(monkeypatch)
    now = int(time.time())
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    forged = jwt.encode({"sub": "user_1", "iat": now, "exp": now + 60}, other, algorithm="RS256", headers={"kid": "k1"})
    assert c.email_for_token(forged) is None
    expired = jwt.encode({"sub": "user_1", "iat": now - 120, "exp": now - 60}, priv, algorithm="RS256", headers={"kid": "k1"})
    assert c.email_for_token(expired) is None
    unknown = jwt.encode({"sub": "user_9", "iat": now, "exp": now + 60}, priv, algorithm="RS256", headers={"kid": "k1"})
    assert c.email_for_token(unknown) is None
    assert c.email_for_token("not.a.jwt") is None


def test_unconfigured_client_never_accepts():
    assert ClerkClient(None, None).configured is False
    assert ClerkClient(None, None).email_for_token("x.y.z") is None
