"""Shared fixtures: an app on an in-memory database, a console mailer that captures magic links,
and a fake Stripe gateway. Nothing here talks to the network."""
from __future__ import annotations

import re

import pytest
from fastapi.testclient import TestClient

from trail.core.signing import Signer
from trail.server.app import create_app
from trail.server.billing import FakeGateway
from trail.server.mail import ConsoleMailer
from trail.server.settings import Settings
from trail.server.store import Store

APP_URL = "http://testserver"


def make_settings(**over) -> Settings:
    # FREE_ACCESS=0: the suite exercises the trial and paywall; test_free_access flips it on.
    env = {"APP_URL": APP_URL, "SESSION_SECRET": "test-secret", "SIGNUP_OPEN": "1", "FREE_ACCESS": "0", "DEMO_REPO_FALLBACK": "0"}
    env.update(over)
    return Settings.from_env(env)


@pytest.fixture
def store() -> Store:
    return Store("sqlite://", secret="test-secret")


@pytest.fixture
def mailer() -> ConsoleMailer:
    return ConsoleMailer()


@pytest.fixture
def gateway() -> FakeGateway:
    return FakeGateway()


@pytest.fixture
def app(store, mailer, gateway, tmp_path):
    return create_app(store=store, signer=Signer.generate(), settings=make_settings(TRAIL_DATA_DIR=str(tmp_path / "data")),
                      mailer=mailer, gateway=gateway, static_dir=None)


@pytest.fixture
def client(app):
    with TestClient(app, base_url=APP_URL) as c:
        yield c


def magic_token(mailer: ConsoleMailer) -> str:
    """The token inside the last magic-link email the console mailer captured."""
    m = re.search(r"token=([A-Za-z0-9_\-]+)", mailer.sent[-1]["text"])
    assert m, mailer.sent[-1]
    return m.group(1)


def sign_in(client: TestClient, mailer: ConsoleMailer, email: str, referral: str | None = None) -> dict:
    """Full magic-link round trip. Leaves the session cookie on the client; returns the JSON callback
    payload (user id + extension token)."""
    r = client.post("/v1/auth/request", json={"email": email, "referral": referral})
    assert r.status_code == 200, r.text
    r = client.get("/v1/auth/callback", params={"token": magic_token(mailer), "format": "json"})
    assert r.status_code == 200, r.text
    return r.json()
