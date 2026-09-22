"""API tests: magic-link auth, session cookie + extension token, checkpoints, packs, entitlement,
referrals, account deletion. Stripe is faked (tests/test_billing.py covers the webhook)."""
from __future__ import annotations

from datetime import timedelta

from trail.chain import verify_chain
from trail.server.store import TRIAL_DAYS, utcnow
from fastapi.testclient import TestClient

from trail.core.signing import Signer
from trail.server.app import create_app
from tests.conftest import APP_URL, magic_token, make_settings, sign_in
from tests.test_pipeline import _doc


def test_magic_link_round_trip_sets_cookie_and_redirects(client, mailer, store):
    r = client.post("/v1/auth/request", json={"email": "  Sam@Uni.example "})
    assert r.status_code == 200 and r.json() == {"sent": True}
    assert mailer.sent[-1]["to"] == "sam@uni.example" and "Longhand" in mailer.sent[-1]["subject"]
    token = magic_token(mailer)

    r = client.get("/v1/auth/callback", params={"token": token}, follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"].endswith("/app/welcome")  # first login
    assert "lh_session=" in r.headers["set-cookie"] and "HttpOnly" in r.headers["set-cookie"]
    me = client.get("/v1/me").json()
    assert me["email"] == "sam@uni.example" and me["plan"] == "trial" and me["entitled"] and me["trialStartedAt"] is None

    # single use
    r = client.get("/v1/auth/callback", params={"token": token}, follow_redirects=False)
    assert r.status_code == 303 and "error=expired" in r.headers["location"]

    # second login goes to /app
    client.post("/v1/auth/request", json={"email": "sam@uni.example"})
    r = client.get("/v1/auth/callback", params={"token": magic_token(mailer)}, follow_redirects=False)
    assert r.headers["location"].endswith("/app?connect=1")

    client.post("/v1/auth/logout")
    assert client.get("/v1/me").status_code == 401


def test_bad_email_rate_limit_and_closed_signup(client, mailer, app):
    assert client.post("/v1/auth/request", json={"email": "nope"}).status_code == 422
    for _ in range(5):
        assert client.post("/v1/auth/request", json={"email": "r@uni.example"}).status_code == 200
    r = client.post("/v1/auth/request", json={"email": "r@uni.example"})
    assert r.status_code == 429 and "15 minutes" in r.json()["detail"]
    app.state.settings.signup_open = False
    r = client.post("/v1/auth/request", json={"email": "new@uni.example"})
    assert r.status_code == 403
    assert client.post("/v1/auth/request", json={"email": "r@uni.example"}).status_code in (200, 429)  # existing users still get links


def test_extension_token_checkpoint_and_pack(client, mailer, store, tmp_path):
    cb = sign_in(client, mailer, "a@uni.example")
    ext_token = cb["token"]
    assert ext_token.startswith("trail_")
    # the app can also mint one for the extension later
    r = client.post("/v1/auth/extension-token")
    assert r.status_code == 200 and r.json()["token"].startswith("trail_") and r.json()["server"] == "http://testserver"
    assert store.user_for_token(ext_token) is None  # minting a new extension token revokes the old one
    H = {"Authorization": f"Bearer {r.json()['token']}"}

    d = _doc("mixed", lines=20)
    heads = verify_chain(d["events"]).heads
    r = client.post("/v1/checkpoint", json={"doc": d["doc"], "heads": heads}, headers=H)
    assert r.status_code == 200 and r.json()["created"] and r.json()["checkpoint"]["body"]["seq"] == 0
    r = client.post("/v1/checkpoint", json={"doc": d["doc"], "heads": heads}, headers=H)
    assert r.json()["created"] is False and r.json()["latest"]["body"]["seq"] == 0
    assert len(client.get("/v1/transparency").json()) == 1
    docs = client.get("/v1/me/docs").json()  # cookie auth works for the same data
    assert docs[0]["doc"] == d["doc"] and docs[0]["last_checkpoint"] and "title" not in docs[0]
    assert client.get("/v1/docs", headers=H).json() == docs

    evs = [e.to_dict() for e in d["events"]]
    r = client.post("/v1/pack", json={"events": evs, "title": "Essay", "format": "json"})
    assert r.status_code == 200 and r.json()["analysis"]["document"]["final_words"] > 0 and len(r.json()["checkpoints"]) == 1
    r = client.post("/v1/pack", json={"events": evs, "format": "html"}, headers=H)
    assert "Writing record" in r.text
    r = client.post("/v1/pack", json={"events": evs, "title": "My Essay", "format": "record"}, headers=H)
    assert r.status_code == 200 and 'filename="My-Essay.longhand.tar.gz"' in r.headers["content-disposition"]
    p = tmp_path / "r.tar.gz"
    p.write_bytes(r.content)
    from trail.record import verify_record

    assert verify_record(p).failed == 0

    bad = dict(evs[2])
    bad["data"] = {**bad["data"], "x": 1}
    assert client.post("/v1/pack", json={"events": evs[:2] + [bad] + evs[3:]}, headers=H).status_code == 400
    assert client.get("/v1/docs").status_code == 200
    client.post("/v1/auth/logout")
    assert client.get("/v1/docs").status_code == 401
    assert client.get("/v1/docs", headers={"Authorization": "Bearer trail_nope"}).status_code == 401


def test_trial_starts_at_first_replay_and_hard_paywall_keeps_recording_open(client, mailer, store):
    cb = sign_in(client, mailer, "t@uni.example")
    uid = cb["user"]
    me = client.get("/v1/me").json()
    assert me["plan"] == "trial" and me["trialEndsAt"] is None
    r = client.post("/v1/me/trial-start")
    assert r.status_code == 200 and r.json()["trial_started"] is True and r.json()["trialEndsAt"]
    assert client.post("/v1/me/trial-start").json()["trial_started"] is False  # idempotent

    store.set_trial_started(uid, utcnow() - timedelta(days=TRIAL_DAYS + 1))
    me = client.get("/v1/me").json()
    assert me["plan"] == "expired" and me["entitled"] is False

    d = _doc("honest", lines=8)
    evs = [e.to_dict() for e in d["events"]]
    r = client.post("/v1/pack", json={"events": evs})
    assert r.status_code == 402 and "never locked" in r.json()["detail"]
    # checkpoint signing never locks
    heads = verify_chain(d["events"]).heads
    assert client.post("/v1/checkpoint", json={"doc": d["doc"], "heads": heads}).json()["created"] is True
    assert client.get("/v1/me/docs").status_code == 200


def test_referrals_three_activations_give_a_free_semester(client, mailer, store):
    sign_in(client, mailer, "ref@uni.example")
    inv = client.get("/v1/referrals").json()
    assert inv["invited"] == 0 and inv["needed"] == 3 and inv["code"] in inv["link"]
    code = inv["code"]
    client.post("/v1/auth/logout")

    for i in range(3):
        sign_in(client, mailer, f"friend{i}@uni.example", referral=code)
        me = client.get("/v1/me").json()
        assert me["plan"] == "trial"
        assert client.post("/v1/me/trial-start").json()["referrer_credited"] is (i == 2)
        client.post("/v1/auth/logout")

    sign_in(client, mailer, "ref@uni.example")
    inv = client.get("/v1/referrals").json()
    assert inv["activated"] == 3 and inv["credits"] == 1 and inv["freeUntil"]
    me = client.get("/v1/me").json()
    assert me["plan"] == "free" and me["entitled"] and me["referralCredits"] == 1
    # an unknown code is ignored, not an error
    client.post("/v1/auth/logout")
    assert client.post("/v1/auth/request", json={"email": "x@uni.example", "referral": "NOPE1234"}).status_code == 200


def test_delete_account_wipes_server_rows(client, mailer, store):
    cb = sign_in(client, mailer, "del@uni.example")
    d = _doc("honest", lines=6)
    client.post("/v1/checkpoint", json={"doc": d["doc"], "heads": verify_chain(d["events"]).heads})
    r = client.delete("/v1/me")
    assert r.status_code == 200 and r.json()["deleted"]
    assert client.get("/v1/me").status_code == 401
    assert store.get_user(cb["user"]) is None and store.docs(cb["user"]) == [] and store.checkpoints(cb["user"], d["doc"]) == []
    assert len(store.transparency_log()) == 1  # the public log keeps only hashes and stays append-only


def test_public_endpoints(client):
    assert client.get("/healthz").json()["ok"] is True
    assert client.get("/v1/public-key").text.startswith("-----BEGIN PUBLIC KEY-----")
    tables = {t["table"] for t in client.get("/v1/schema").json()["tables"]}
    assert {"users", "magic_links", "sessions", "api_tokens", "docs", "checkpoints", "transparency_log", "referrals", "subscriptions"} == tables
    plans = client.get("/v1/billing/plans").json()
    assert plans["plans"]["semester"]["price_usd"] == "12.00" and plans["plans"]["monthly"]["price_usd"] == "3.99" and plans["trialDays"] == 14


def test_plus_tags_and_per_ip_limit(client, mailer, store):
    sign_in(client, mailer, "tag@uni.example")
    client.post("/v1/auth/logout")
    assert client.post("/v1/auth/request", json={"email": "tag+essay2@uni.example"}).status_code == 200
    assert mailer.sent[-1]["to"] == "tag@uni.example"  # one inbox, one account
    assert store.user_by_email("tag+essay2@uni.example") is None
    n = 0
    for i in range(40):
        r = client.post("/v1/auth/request", json={"email": f"ip{i}@uni.example"})
        if r.status_code == 429:
            assert "network" in r.json()["detail"]
            break
        n += 1
    assert 10 <= n < 40  # per-IP ceiling reached well before 40 distinct emails


def test_signup_endpoint_is_gone(client):
    assert client.post("/v1/signup", json={"email": "x@uni.example"}).status_code in (404, 405)


def test_static_spa(tmp_path, store, mailer, gateway):
    from fastapi.testclient import TestClient
    from trail.core.signing import Signer
    from trail.server.app import create_app
    from tests.conftest import make_settings

    static = tmp_path / "dist"
    (static / "assets").mkdir(parents=True)
    (static / "index.html").write_text("<html>spa</html>")
    (static / "assets" / "a.js").write_text("js")
    app = create_app(store=store, signer=Signer.generate(), settings=make_settings(), mailer=mailer, gateway=gateway, static_dir=static)
    with TestClient(app) as c:
        assert c.get("/").text == "<html>spa</html>"
        assert c.get("/app/essays/lh_abc").text == "<html>spa</html>"
        assert c.get("/assets/a.js").text == "js" and "immutable" in c.get("/assets/a.js").headers["cache-control"]
        assert c.get("/v1/nope").status_code == 404
        assert c.get("/../../etc/passwd").status_code in (200, 404)  # never escapes the static dir


def test_free_access_mode_has_no_trial_clock_and_nothing_to_buy(store, mailer, gateway, tmp_path):
    """FREE_ACCESS=1 (the default while Stripe is unset): every account is entitled, forever."""
    settings = make_settings(TRAIL_DATA_DIR=str(tmp_path / "data"), FREE_ACCESS="1")
    app = create_app(store=store, signer=Signer.generate(), settings=settings, mailer=mailer, gateway=gateway, static_dir=None)
    with TestClient(app, base_url=APP_URL) as client:
        assert client.get("/v1/config").json()["freeAccess"] is True
        cb = sign_in(client, mailer, "free@uni.example")
        me = client.get("/v1/me").json()
        assert me["plan"] == "free" and me["entitled"] is True and me["trialEndsAt"] is None
        assert me["billing"]["freeAccess"] is True
        # a trial started long ago changes nothing
        store.set_trial_started(cb["user"], utcnow() - timedelta(days=TRIAL_DAYS + 30))
        me = client.get("/v1/me").json()
        assert me["plan"] == "free" and me["entitled"] is True
        d = _doc("honest", lines=8)
        assert client.post("/v1/pack", json={"events": [e.to_dict() for e in d["events"]]}).status_code == 200
        r = client.post("/v1/billing/checkout", json={"plan": "semester"})
        assert r.status_code == 409 and "free" in r.json()["detail"]
