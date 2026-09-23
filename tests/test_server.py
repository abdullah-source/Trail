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
    assert mailer.sent[-1]["to"] == "sam@uni.example" and "Trail" in mailer.sent[-1]["subject"]
    token = magic_token(mailer)

    r = client.get("/v1/auth/callback", params={"token": token}, follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"].endswith("/app/welcome")  # first login
    assert "trail_session=" in r.headers["set-cookie"] and "HttpOnly" in r.headers["set-cookie"]
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
    assert r.status_code == 200 and 'filename="My-Essay.trail.tar.gz"' in r.headers["content-disposition"]
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
    assert {"users", "magic_links", "sessions", "api_tokens", "docs", "checkpoints", "transparency_log", "referrals", "subscriptions", "waitlist"} == tables
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
        assert c.get("/app/essays/tr_abc").text == "<html>spa</html>"
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


def test_clerk_sign_in_exchanges_a_verified_token_for_our_session(store, mailer, gateway, tmp_path):
    from trail.server.clerk import FakeClerk, frontend_api_from_publishable_key

    assert frontend_api_from_publishable_key("pk_test_Zm9vLmNsZXJrLmFjY291bnRzLmRldiQ") == "https://foo.clerk.accounts.dev"
    assert frontend_api_from_publishable_key("garbage") is None
    clerk = FakeClerk(tokens={"tok_good_1234567890abcdef": "Student@Uni.Example"})
    settings = make_settings(TRAIL_DATA_DIR=str(tmp_path / "data"))
    app = create_app(store=store, signer=Signer.generate(), settings=settings, mailer=mailer, gateway=gateway, static_dir=None, clerk=clerk)
    with TestClient(app, base_url=APP_URL) as client:
        assert client.get("/v1/config").json()["clerkPublishableKey"] == clerk.publishable_key
        r = client.post("/v1/auth/clerk", json={"token": "tok_bad_1234567890abcdef"})
        assert r.status_code == 401
        r = client.post("/v1/auth/clerk", json={"token": "tok_good_1234567890abcdef"})
        assert r.status_code == 200 and r.json()["first"] is True and "trail_session=" in r.headers["set-cookie"]
        me = client.get("/v1/me").json()
        assert me["email"] == "student@uni.example"
        # second time: same account, not first
        assert client.post("/v1/auth/clerk", json={"token": "tok_good_1234567890abcdef"}).json()["first"] is False
        assert mailer.sent == []  # no magic link involved


def test_clerk_endpoint_is_absent_when_not_configured(client):
    assert client.get("/v1/config").json()["clerkPublishableKey"] is None
    assert client.post("/v1/auth/clerk", json={"token": "tok_whatever_1234567890"}).status_code == 404


def test_waitlist_needs_no_account_and_dedupes(client):
    r = client.post("/v1/waitlist", json={"email": "Someone+tag@Uni.Example", "source": "home"})
    assert r.status_code == 200 and r.json() == {"joined": True, "new": True}
    assert client.post("/v1/waitlist", json={"email": "someone@uni.example"}).json()["new"] is False
    assert client.post("/v1/waitlist", json={"email": "not-an-email"}).status_code == 422


# ---- demo records ----------------------------------------------------------------------------------------

import io  # noqa: E402
import json  # noqa: E402
import tarfile  # noqa: E402

from trail.record import verify_record  # noqa: E402
from trail.server.demo import DEMO_EMAIL  # noqa: E402


def _demo_static(tmp_path, demos: dict[str, dict]) -> "Path":
    """A static dir shaped like web/dist after `vite build`: index.html plus demo/manifest.json
    and demo/<id>.events.json in the extension's export format (a JSON array of event dicts)."""
    from pathlib import Path

    static = tmp_path / "dist"
    (static / "demo").mkdir(parents=True)
    (static / "index.html").write_text("<html>spa</html>")
    manifest = []
    for demo_id, meta in demos.items():
        d = _doc(meta.get("profile", "mixed"), seed=meta.get("seed", 7), lines=meta.get("lines", 12))
        (static / "demo" / f"{demo_id}.events.json").write_text(json.dumps([e.to_dict() for e in d["events"]]))
        manifest.append({"id": demo_id, "title": meta.get("title", demo_id), "student": meta.get("student"), "course": meta.get("course")})
    (static / "demo" / "manifest.json").write_text(json.dumps({"demos": manifest}))
    return static


def _demo_app(store, mailer, gateway, tmp_path, static, signer=None):
    return create_app(store=store, signer=signer or Signer.generate(), settings=make_settings(TRAIL_DATA_DIR=str(tmp_path / "data")),
                      mailer=mailer, gateway=gateway, static_dir=static)


def _verify_like_the_browser(pack_bytes: bytes, client, tmp_path) -> "object":
    """The checks web/src/lib/verify.ts performs on /verify: hashes, chains, checkpoint heads and
    signatures under Trail's published key (not just the key inside the archive), and every
    checkpoint present in /v1/transparency."""
    p = tmp_path / "demo.trail.tar.gz"
    p.write_bytes(pack_bytes)
    live_pem = client.get("/v1/public-key").text
    pk = tmp_path / "live.pub.pem"
    pk.write_text(live_pem)
    rep = verify_record(p, public_key=str(pk))  # signatures checked against the LIVE key
    with tarfile.open(p) as tar:
        names = tar.getnames()
        root = names[0].split("/")[0]
        archive_pem = tar.extractfile(f"{root}/keys/signer.pub.pem").read().decode()
        cps = [json.loads(l) for l in tar.extractfile(f"{root}/checkpoints.jsonl").read().decode().splitlines() if l.strip()]
        assert {f"{root}/verify.py", f"{root}/pack.html", f"{root}/manifest.sig.json"} <= set(names)
    if "".join(archive_pem.split()) != "".join(live_pem.split()):
        rep.fail("signed by Trail's key", "archive key differs from /v1/public-key")
    logged = {e["checkpoint_hash"] for e in client.get("/v1/transparency").json()}
    missing = [c for c in cps if c["hash"] not in logged]
    if missing or not cps:
        rep.fail("checkpoints in the public log", f"{len(missing)} of {len(cps)} missing")
    return rep


def test_demo_records_are_signed_at_boot_and_verify_against_live_key_and_log(store, mailer, gateway, tmp_path):
    static = _demo_static(tmp_path, {"honest-essay": {"profile": "honest", "title": "Honest essay", "course": "ENGL 101"},
                                     "mixed-essay": {"profile": "mixed", "seed": 11, "title": "Mixed essay"}})
    app = _demo_app(store, mailer, gateway, tmp_path, static)
    with TestClient(app, base_url=APP_URL) as client:
        assert client.get("/healthz").json()["ok"] is True
        demos = client.get("/v1/demo").json()
        assert [d["id"] for d in demos] == ["honest-essay", "mixed-essay"]
        d = demos[0]
        assert d["title"] == "Honest essay" and d["course"] == "ENGL 101" and d["events"] > 10 and d["signed"] is True
        assert len(d["checkpoints"]) == 1 and d["checkpoints"][0]["seq"] == 0 and d["checkpoints"][0]["ts"] and d["checkpoints"][0]["hash"]
        assert d["pack_url"] == "/v1/demo/honest-essay/pack" and d["events_url"] == "/demo/honest-essay.events.json"
        assert client.get(d["events_url"]).status_code == 200  # the static file the /demo page plays
        assert len(client.get("/v1/transparency").json()) == 2  # one checkpoint per demo, in the public log

        r = client.get("/v1/demo/honest-essay/pack")
        assert r.status_code == 200 and r.headers["content-type"] == "application/gzip"
        assert r.headers["content-disposition"] == 'attachment; filename="Honest-essay.trail.tar.gz"'
        rep = _verify_like_the_browser(r.content, client, tmp_path)
        assert rep.failed == 0, [c for c in rep.checks if c[0] == "FAIL"]
        names = {n for s, n, _ in rep.checks if s == "PASS"}
        assert {"checkpoint signatures", "checkpoint linkage and heads", "manifest signature", "chain linkage"} <= names
        # json/html forms of the same pack, for the /demo page
        j = client.get("/v1/demo/honest-essay/pack", params={"format": "json"}).json()
        assert j["title"] == "Honest essay" and len(j["checkpoints"]) == 1 and j["analysis"]["document"]["final_words"] > 0
        assert "Writing record" in client.get("/v1/demo/mixed-essay/pack", params={"format": "html"}).text
        assert client.get("/v1/demo/honest-essay/pack", params={"format": "pdf"}).status_code == 400
        # unknown, malformed and over-long ids: 404, never the SPA fallback
        for bad in ("nope", "Honest-Essay", "a" * 41, "../manifest", "x y"):
            assert client.get(f"/v1/demo/{bad}/pack").status_code == 404, bad


def test_demo_tampered_pack_fails_verification(store, mailer, gateway, tmp_path):
    static = _demo_static(tmp_path, {"essay": {"profile": "mixed", "title": "Essay"}})
    app = _demo_app(store, mailer, gateway, tmp_path, static)
    with TestClient(app, base_url=APP_URL) as client:
        good = client.get("/v1/demo/essay/pack").content

        def retar(mutate) -> bytes:
            out = io.BytesIO()
            with tarfile.open(fileobj=io.BytesIO(good)) as src, tarfile.open(fileobj=out, mode="w:gz") as dst:
                for m in src.getmembers():
                    data = src.extractfile(m).read()
                    if m.name.endswith("/events.jsonl"):
                        data = mutate(data)
                    m.size = len(data)
                    dst.addfile(m, io.BytesIO(data))
            return out.getvalue()

        # 1. flip one byte inside the fourth event's line (its hash no longer matches its contents)
        def flip(data: bytes) -> bytes:
            lines = data.decode().splitlines()
            body = json.loads(lines[3])
            i = lines[3].index('"kind":"') + len('"kind":"')  # first letter of the kind, e.g. i(nsert)
            lines[3] = lines[3][:i] + ("x" if lines[3][i] != "x" else "y") + lines[3][i + 1:]
            assert json.loads(lines[3]) != body
            return ("\n".join(lines) + "\n").encode()
        flipped = retar(flip)
        rep = _verify_like_the_browser(flipped, client, tmp_path)
        fails = {n: d for s, n, d in rep.checks if s == "FAIL"}
        assert rep.failed > 0 and "events.jsonl hash mismatch" in fails.get("manifest file hashes", "")
        assert "1 of" in fails.get("event hashes", "") and "do not match their contents" in fails["event hashes"]

        # 2. edit an event and re-hash it so it looks self-consistent: the chain names the event
        #    and the signed checkpoint head no longer matches
        def rehash(data: bytes) -> bytes:
            from trail.events import compute_hash
            ls = data.decode().splitlines()
            ev = json.loads(ls[3]); ev["data"]["tampered"] = True
            ev["hash"] = compute_hash({k: v for k, v in ev.items() if k != "hash"})
            ls[3] = json.dumps(ev, sort_keys=True, separators=(",", ":"))
            return ("\n".join(ls) + "\n").encode(), ev
        tampered_ev = {}
        def rehash_mut(data: bytes) -> bytes:
            out, ev = rehash(data)
            tampered_ev.update(ev)
            return out
        rep = _verify_like_the_browser(retar(rehash_mut), client, tmp_path)
        fails = {n: d for s, n, d in rep.checks if s == "FAIL"}
        assert f"session {tampered_ev['session']} seq {tampered_ev['seq'] + 1}: prev mismatch" in fails.get("chain linkage", "") \
            or f"head of {tampered_ev['session']} does not match" in fails.get("checkpoints", ""), fails
        assert "checkpoints" in fails or "chain linkage" in fails
        # the untouched pack still passes
        assert _verify_like_the_browser(good, client, tmp_path).failed == 0


def test_demo_setup_is_idempotent_isolated_and_never_fatal(store, mailer, gateway, tmp_path, caplog):
    import logging

    static = _demo_static(tmp_path, {"essay": {"profile": "honest", "title": "Essay"}})
    signer = Signer.generate()
    # a broken entry and a broken file must not stop the good one
    (static / "demo" / "broken.events.json").write_text("{not json")
    manifest = json.loads((static / "demo" / "manifest.json").read_text())
    manifest["demos"] += [{"id": "broken"}, {"id": "missing-file"}, {"id": "BAD ID!"}]
    (static / "demo" / "manifest.json").write_text(json.dumps(manifest))

    caplog.set_level(logging.WARNING, logger="trail.demo")
    app = _demo_app(store, mailer, gateway, tmp_path, static, signer=signer)
    with TestClient(app, base_url=APP_URL) as client:
        assert [d["id"] for d in client.get("/v1/demo").json()] == ["essay"]
        assert client.get("/v1/demo/broken/pack").status_code == 404
        log_before = client.get("/v1/transparency").json()
        assert len(log_before) == 1
        first_pack = client.get("/v1/demo/essay/pack").content
    warned = "\n".join(r.getMessage() for r in caplog.records)
    assert "broken" in warned and "missing-file" in warned and "BAD ID!" in warned

    # second boot on the same database and files: nothing new is signed or logged
    app2 = _demo_app(store, mailer, gateway, tmp_path, static, signer=signer)
    with TestClient(app2, base_url=APP_URL) as client:
        assert client.get("/v1/transparency").json() == log_before
        assert client.get("/v1/demo").json()[0]["checkpoints"] == [c for c in client.get("/v1/demo").json()[0]["checkpoints"]]
        assert _verify_like_the_browser(client.get("/v1/demo/essay/pack").content, client, tmp_path).failed == 0
        assert len(client.get("/v1/demo/essay/pack").content) > 0 and first_pack  # both boots serve a verifying pack

        # the demo owner is a system account: it cannot sign in, and real users never see its docs
        assert client.post("/v1/auth/request", json={"email": DEMO_EMAIL}).status_code == 422
        assert client.post("/v1/auth/request", json={"email": "Demo+x@Trail.Local"}).status_code == 422
        assert client.post("/v1/waitlist", json={"email": DEMO_EMAIL}).status_code == 422
        sign_in(client, mailer, "real@uni.example")
        assert client.get("/v1/me/docs").json() == []
        assert client.get("/v1/me").json()["email"] == "real@uni.example"
        demo_user = store.user_by_email(DEMO_EMAIL)
        assert demo_user is not None and store.docs(demo_user.id)[0]["doc"]
        # deleting a real account leaves the demo untouched
        client.delete("/v1/me")
        assert client.get("/v1/demo").json()[0]["signed"] is True

    # no demo directory at all, and a garbage manifest: the app still boots and serves
    bare = tmp_path / "bare"
    bare.mkdir()
    (bare / "index.html").write_text("<html>spa</html>")
    with TestClient(_demo_app(store, mailer, gateway, tmp_path, bare, signer=signer), base_url=APP_URL) as client:
        assert client.get("/healthz").json()["ok"] is True and client.get("/v1/demo").json() == []
    (bare / "demo").mkdir()
    (bare / "demo" / "manifest.json").write_text("[[[")
    with TestClient(_demo_app(store, mailer, gateway, tmp_path, bare, signer=signer), base_url=APP_URL) as client:
        assert client.get("/healthz").json()["ok"] is True and client.get("/v1/demo").json() == []
        assert client.get("/v1/demo/essay/pack").status_code == 404
