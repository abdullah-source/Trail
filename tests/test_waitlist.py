"""Referral waitlist: join, confirmation email, queue position, referral credit, public counter,
and the waitlist -> account referral carried over at first sign-in."""
from __future__ import annotations

import re
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from trail.core.signing import Signer
from trail.server.app import create_app
from trail.server.models import WaitlistEntry
from trail.server.store import utcnow, waitlist_positions
from tests.conftest import APP_URL, make_settings, sign_in

CODE_RE = re.compile(r"^[A-HJ-NP-Z2-9]{8}$")  # base32 without I, O, 0, 1


def join(client, email, ref=None, source="home", ip=None):
    headers = {"x-forwarded-for": ip} if ip else {}
    r = client.post("/v1/waitlist", json={"email": email, "source": source, "ref": ref}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def confirm_token(mailer, to: str) -> str:
    msg = next(m for m in reversed(mailer.sent) if m["to"] == to)
    m = re.search(r"/v1/waitlist/confirm\?token=([A-Za-z0-9_\-]+)", msg["text"])
    assert m, msg
    return m.group(1)


def confirm(client, mailer, email):
    r = client.get("/v1/waitlist/confirm", params={"token": confirm_token(mailer, email)}, follow_redirects=False)
    assert r.status_code == 303 and "waitlist=confirmed" in r.headers["location"], r.headers
    return r


def test_join_returns_code_position_and_share_link_and_is_idempotent(client, mailer, store):
    a = join(client, "Ann+x@Uni.example")
    assert a["joined"] and a["new"] and CODE_RE.match(a["code"])
    assert a["position"] == 1 and a["referrals"] == 0 and a["total"] == 1 and a["confirmed"] is False
    assert a["share_url"] == f"{APP_URL}/?ref={a['code']}"
    again = join(client, "ann@uni.example")
    assert again["new"] is False and again["code"] == a["code"] and again["total"] == 1
    with store.session() as s:
        assert s.query(WaitlistEntry).count() == 1
    # the confirmation email went to the cleaned address and carries the share link
    assert mailer.sent[-1]["to"] == "ann@uni.example" and a["share_url"] in mailer.sent[-1]["text"]


def test_codes_are_unique(client):
    codes = {join(client, f"u{i}@uni.example", ip=f"10.0.0.{i}")["code"] for i in range(40)}
    assert len(codes) == 40 and all(CODE_RE.match(c) for c in codes)


def test_confirmation_flow(client, mailer, store):
    a = join(client, "conf@uni.example")
    token = confirm_token(mailer, "conf@uni.example")
    assert not store.dump_all_text().count(token)  # only the hash is stored
    r = client.get("/v1/waitlist/confirm", params={"token": token}, follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"] == f"{APP_URL}/install?waitlist=confirmed&code={a['code']}"
    st = client.get(f"/v1/waitlist/{a['code']}").json()
    assert st["confirmed"] is True
    # second click is harmless; json form too
    r = client.get("/v1/waitlist/confirm", params={"token": token, "format": "json"})
    assert r.status_code == 200 and r.json()["confirmed"] is True
    # bad token
    r = client.get("/v1/waitlist/confirm", params={"token": "wl_nope"}, follow_redirects=False)
    assert r.status_code == 303 and "waitlist=invalid" in r.headers["location"]
    assert client.get("/v1/waitlist/confirm", params={"token": "wl_nope", "format": "json"}).status_code == 404
    # a confirmed address re-joining gets no new email
    n = len(mailer.sent)
    assert join(client, "conf@uni.example")["confirmed"] is True and len(mailer.sent) == n


def test_rejoin_before_confirming_rotates_the_link(client, mailer):
    join(client, "rot@uni.example")
    old = confirm_token(mailer, "rot@uni.example")
    join(client, "rot@uni.example")
    new = confirm_token(mailer, "rot@uni.example")
    assert old != new
    assert client.get("/v1/waitlist/confirm", params={"token": old, "format": "json"}).status_code == 404
    assert client.get("/v1/waitlist/confirm", params={"token": new, "format": "json"}).status_code == 200


def test_referral_counts_only_after_confirmation_and_only_once(client, mailer):
    a = join(client, "inviter@uni.example")
    join(client, "friend@uni.example", ref=a["code"].lower())
    assert client.get(f"/v1/waitlist/{a['code']}").json()["referrals"] == 0  # not until the friend confirms
    tok = confirm_token(mailer, "friend@uni.example")
    client.get("/v1/waitlist/confirm", params={"token": tok}, follow_redirects=False)
    assert client.get(f"/v1/waitlist/{a['code']}").json()["referrals"] == 1
    client.get("/v1/waitlist/confirm", params={"token": tok}, follow_redirects=False)  # clicked twice
    assert client.get(f"/v1/waitlist/{a['code']}").json()["referrals"] == 1
    # re-joining with another code later does not change who invited an existing entry
    b = join(client, "other@uni.example")
    join(client, "friend@uni.example", ref=b["code"])
    assert client.get(f"/v1/waitlist/{b['code']}").json()["referrals"] == 0


def test_no_self_referral_and_unknown_codes_are_ignored(client, mailer, store):
    a = join(client, "self@uni.example")
    join(client, "self+again@uni.example", ref=a["code"])  # the same inbox: existing entry, no credit
    confirm(client, mailer, "self@uni.example")
    assert client.get(f"/v1/waitlist/{a['code']}").json()["referrals"] == 0
    join(client, "stranger@uni.example", ref="ZZZZZZZZ")
    with store.session() as s:
        assert s.get(WaitlistEntry, "stranger@uni.example").referred_by is None
    # even a forged row pointing at its own code is never credited
    with store.session() as s:
        e = s.get(WaitlistEntry, "stranger@uni.example")
        e.referred_by = e.code
        s.commit()
    join(client, "stranger@uni.example")  # fresh token
    confirm(client, mailer, "stranger@uni.example")
    with store.session() as s:
        assert s.get(WaitlistEntry, "stranger@uni.example").referrals == 0


def test_same_ip_burst_only_credits_the_first_few(client, mailer, store):
    a = join(client, "popular@uni.example", ip="1.1.1.1")
    for i in range(5):
        join(client, f"sock{i}@uni.example", ref=a["code"], ip="9.9.9.9")
    with store.session() as s:
        refs = [s.get(WaitlistEntry, f"sock{i}@uni.example").referred_by for i in range(5)]
    assert refs[:3] == [a["code"]] * 3 and refs[3:] == [None, None]
    join(client, "elsewhere@uni.example", ref=a["code"], ip="8.8.8.8")  # another network is fine
    with store.session() as s:
        assert s.get(WaitlistEntry, "elsewhere@uni.example").referred_by == a["code"]


def test_position_math_moves_five_places_per_confirmed_referral(client, mailer, store):
    codes = [join(client, f"q{i}@uni.example", ip=f"10.1.0.{i}")["code"] for i in range(10)]
    # q8 (#9) gets one confirmed referral: score 9 - 5 = 4, ties with q3 (#4) who joined earlier
    join(client, "f1@uni.example", ref=codes[8], ip="10.2.0.1")
    assert client.get(f"/v1/waitlist/{codes[8]}").json()["position"] == 9
    confirm(client, mailer, "f1@uni.example")
    st = client.get(f"/v1/waitlist/{codes[8]}").json()
    assert st["position"] == 5 and st["referrals"] == 1 and st["total"] == 11
    assert client.get(f"/v1/waitlist/{codes[3]}").json()["position"] == 4
    assert client.get(f"/v1/waitlist/{codes[4]}").json()["position"] == 6  # pushed down one
    # two more confirmed referrals: 9 - 15 = -6, first in line
    for n in (2, 3):
        join(client, f"f{n}@uni.example", ref=codes[8], ip=f"10.2.0.{n}")
        confirm(client, mailer, f"f{n}@uni.example")
    assert client.get(f"/v1/waitlist/{codes[8]}").json()["position"] == 1
    assert client.get(f"/v1/waitlist/{codes[0]}").json()["position"] == 2


def test_waitlist_positions_pure():
    t0 = utcnow()
    rows = [(f"C{i}", t0 + timedelta(seconds=i), 0) for i in range(1, 8)]
    assert waitlist_positions(rows) == {f"C{i}": i for i in range(1, 8)}
    rows[6] = ("C7", rows[6][1], 1)  # 7 - 5 = 2, ties with C2 who joined first
    pos = waitlist_positions(rows)
    assert pos["C1"] == 1 and pos["C2"] == 2 and pos["C7"] == 3 and pos["C3"] == 4 and pos["C6"] == 7
    assert waitlist_positions([]) == {}


def test_stats_are_public(client, mailer):
    assert client.get("/v1/waitlist/stats").json() == {"total": 0, "confirmed": 0}
    join(client, "s1@uni.example")
    join(client, "s2@uni.example")
    confirm(client, mailer, "s1@uni.example")
    assert client.get("/v1/waitlist/stats").json() == {"total": 2, "confirmed": 1}


def test_unknown_code_is_404(client):
    assert client.get("/v1/waitlist/ABCDEFGH").status_code == 404
    assert client.get("/v1/waitlist/" + "A" * 40).status_code == 404


def test_join_is_rate_limited_per_ip(client):
    n = 0
    for i in range(40):
        r = client.post("/v1/waitlist", json={"email": f"rl{i}@uni.example"})
        if r.status_code == 429:
            assert "network" in r.json()["detail"]
            break
        n += 1
    assert n == 20


def test_join_survives_a_mail_outage(store, gateway, tmp_path):
    class Broken:
        def send(self, *a, **k):
            raise RuntimeError("smtp down")

    app = create_app(store=store, signer=Signer.generate(), settings=make_settings(TRAIL_DATA_DIR=str(tmp_path / "d")),
                     mailer=Broken(), gateway=gateway, static_dir=None)
    with TestClient(app, base_url=APP_URL) as c:
        r = c.post("/v1/waitlist", json={"email": "down@uni.example"})
        assert r.status_code == 200 and r.json()["position"] == 1


# ---- waitlist referral -> account referral at first sign-in ---------------------------------------


def test_waitlist_referral_becomes_an_account_referral_at_first_sign_in(client, mailer, store):
    a = join(client, "maya@uni.example")
    join(client, "leo@uni.example", ref=a["code"])
    maya = sign_in(client, mailer, "maya@uni.example")["user"]
    client.post("/v1/auth/logout")
    leo = sign_in(client, mailer, "leo@uni.example")["user"]  # no ?ref= on the login page
    assert store.get_user(leo).referred_by == maya
    client.post("/v1/me/trial-start")  # first replay activates the referral as before
    client.post("/v1/auth/logout")
    sign_in(client, mailer, "maya@uni.example")
    assert client.get("/v1/referrals").json()["activated"] == 1


def test_no_credit_when_the_inviter_has_no_account(client, mailer, store):
    a = join(client, "noacct@uni.example")
    join(client, "kid@uni.example", ref=a["code"])
    kid = sign_in(client, mailer, "kid@uni.example")["user"]
    assert store.get_user(kid).referred_by is None


def test_a_waitlist_code_works_as_a_sign_in_referral(client, mailer, store):
    a = join(client, "ines@uni.example")
    ines = sign_in(client, mailer, "ines@uni.example")["user"]
    client.post("/v1/auth/logout")
    new = sign_in(client, mailer, "noel@uni.example", referral=a["code"])["user"]
    assert store.get_user(new).referred_by == ines
    client.post("/v1/auth/logout")
    # and never yourself
    own = sign_in(client, mailer, "ines@uni.example", referral=a["code"])["user"]
    assert own == ines and store.get_user(ines).referred_by is None


def test_clerk_sign_in_carries_the_waitlist_referral(store, mailer, gateway, tmp_path):
    from trail.server.clerk import FakeClerk

    clerk = FakeClerk(tokens={"tok_inviter_1234567890ab": "Ruth@Uni.example", "tok_invitee_1234567890ab": "sam+w@uni.example"})
    app = create_app(store=store, signer=Signer.generate(), settings=make_settings(TRAIL_DATA_DIR=str(tmp_path / "d")),
                     mailer=mailer, gateway=gateway, static_dir=None, clerk=clerk)
    with TestClient(app, base_url=APP_URL) as c:
        a = join(c, "ruth@uni.example")
        join(c, "sam@uni.example", ref=a["code"])
        ruth = c.post("/v1/auth/clerk", json={"token": "tok_inviter_1234567890ab"}).json()["user"]
        c.post("/v1/auth/logout")
        sam = c.post("/v1/auth/clerk", json={"token": "tok_invitee_1234567890ab"}).json()["user"]
        assert store.get_user(sam).referred_by == ruth


def test_deleting_an_account_removes_its_waitlist_row(client, mailer, store):
    join(client, "gone@uni.example")
    sign_in(client, mailer, "gone@uni.example")
    assert client.delete("/v1/me").status_code == 200
    with store.session() as s:
        assert s.get(WaitlistEntry, "gone@uni.example") is None


# ---- migration -------------------------------------------------------------------------------------


def test_migration_0004_backfills_codes_for_existing_rows(tmp_path):
    from pathlib import Path

    from alembic import command
    from alembic.config import Config
    from sqlalchemy import create_engine, text

    root = Path(__file__).resolve().parents[1]
    url = f"sqlite:///{tmp_path / 'm.sqlite'}"
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "trail" / "server" / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "0003")
    eng = create_engine(url)
    with eng.begin() as conn:
        for i in range(5):
            conn.execute(text("INSERT INTO waitlist (email, created_at, source) VALUES (:e, '2026-10-01 00:00:00', 'home')"), {"e": f"old{i}@uni.example"})
    command.upgrade(cfg, "head")
    with eng.begin() as conn:
        rows = conn.execute(text("SELECT code, referrals, confirmed_at FROM waitlist")).all()
    assert len(rows) == 5 and len({r[0] for r in rows}) == 5 and all(CODE_RE.match(r[0]) and r[1] == 0 and r[2] is None for r in rows)
    with pytest.raises(Exception):
        with eng.begin() as conn:
            conn.execute(text("UPDATE waitlist SET code = :c"), {"c": rows[0][0]})  # unique
    command.downgrade(cfg, "0003")


def test_waitlist_stats_cli_reads_counts(tmp_path, monkeypatch, capsys):
    from trail.cli import main
    from trail.server.store import Store
    db = tmp_path / "w.sqlite"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db}")
    st = Store(f"sqlite:///{db}", create_schema=True)
    st.join_waitlist("a@x.example", "home:tiktok")
    st.join_waitlist("b@x.example", "install")
    assert main(["waitlist-stats"]) == 0
    out = capsys.readouterr().out
    assert "total 2" in out and "confirmed 0" in out and "joined by day" in out
