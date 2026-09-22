"""Production guard: an https APP_URL (or TRAIL_ENV=production) refuses to boot without real
secrets, and names the missing variable. Local http keeps the dev defaults."""
from __future__ import annotations

import logging

import pytest

from trail.core.signing import Signer
from trail.server.app import create_app
from trail.server.billing import FakeGateway
from trail.server.settings import Settings
from trail.server.store import Store

GOOD = {
    "APP_URL": "https://trail.app",
    "SESSION_SECRET": "x" * 48,
    "TRAIL_SIGNING_KEY": Signer.generate().to_pem().decode(),
    "RESEND_API_KEY": "re_test",
}


def test_https_requires_secret_key_and_mailer(caplog):
    s = Settings.from_env({"APP_URL": "https://trail.app"})
    assert s.production
    missing = s.missing_for_production()
    assert [m.split(" ")[0] for m in missing] == ["SESSION_SECRET", "TRAIL_SIGNING_KEY", "RESEND_API_KEY"]
    caplog.set_level(logging.ERROR)
    with pytest.raises(RuntimeError) as e:
        create_app(store=Store("sqlite://"), settings=s, gateway=FakeGateway(), static_dir=None)
    assert "SESSION_SECRET" in str(e.value) and "TRAIL_SIGNING_KEY" in str(e.value) and "RESEND_API_KEY" in str(e.value)
    assert any("SESSION_SECRET" in r.getMessage() for r in caplog.records)


@pytest.mark.parametrize("drop", ["SESSION_SECRET", "TRAIL_SIGNING_KEY", "RESEND_API_KEY"])
def test_each_variable_is_named(drop):
    env = {k: v for k, v in GOOD.items() if k != drop}
    with pytest.raises(RuntimeError) as e:
        create_app(store=Store("sqlite://"), settings=Settings.from_env(env), gateway=FakeGateway(), static_dir=None)
    assert drop in str(e.value)


def test_dev_default_secret_is_refused_in_production():
    env = {**GOOD, "SESSION_SECRET": "dev-secret-change-me"}
    with pytest.raises(RuntimeError, match="SESSION_SECRET"):
        create_app(store=Store("sqlite://"), settings=Settings.from_env(env), gateway=FakeGateway(), static_dir=None)


def test_production_boots_with_everything_set():
    app = create_app(store=Store("sqlite://"), settings=Settings.from_env(GOOD), gateway=FakeGateway(), static_dir=None)
    assert app.state.settings.secure_cookies and type(app.state.mailer).__name__ == "ResendMailer"
    assert app.state.signer.public_key.key_id == Signer.from_pem(GOOD["TRAIL_SIGNING_KEY"].encode()).public_key.key_id


def test_trail_env_flag_forces_the_guard():
    with pytest.raises(RuntimeError):
        create_app(store=Store("sqlite://"), settings=Settings.from_env({"APP_URL": "http://localhost:8100", "TRAIL_ENV": "production"}), gateway=FakeGateway(), static_dir=None)


def test_localhost_keeps_dev_defaults(tmp_path):
    s = Settings.from_env({"APP_URL": "http://localhost:8100", "TRAIL_DATA_DIR": str(tmp_path)})
    assert not s.production
    app = create_app(store=Store("sqlite://"), settings=s, gateway=FakeGateway(), static_dir=None)
    assert type(app.state.mailer).__name__ == "ConsoleMailer"


def test_free_access_defaults_to_on_until_stripe_is_configured():
    assert Settings.from_env({"APP_URL": "http://localhost"}).free_access is True
    assert Settings.from_env({"APP_URL": "http://localhost", "STRIPE_SECRET_KEY": "sk_test_x"}).free_access is False
    assert Settings.from_env({"APP_URL": "http://localhost", "STRIPE_SECRET_KEY": "sk_test_x", "FREE_ACCESS": "1"}).free_access is True
    assert Settings.from_env({"APP_URL": "http://localhost", "FREE_ACCESS": "0"}).free_access is False
