"""Privacy guards (DECISIONS §8.7, §8.8, §8.11):

  * after /v1/pack, a sentinel sentence from the events is nowhere in the database, the data
    directory, or anything that was logged;
  * the Alembic migrations create exactly the schema the models describe;
  * the /privacy page lists every server-side table;
  * no request-body logging anywhere in the server package.
"""
from __future__ import annotations

import logging
import re
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect

from trail.chain import verify_chain
from trail.events import Event
from trail.server.models import Base
from tests.conftest import sign_in
from tests.test_pipeline import _doc

ROOT = Path(__file__).resolve().parents[1]
SENTINEL = "Zebra quartz lantern seventeen violet umbrella."


def _events_with_sentinel(profile="mixed"):
    d = _doc(profile, lines=12)
    evs = d["events"]
    # append the sentinel as a typed insert, re-chaining from the last event of that session
    last = evs[-1]
    ev = Event.create(session=last.session, doc=last.doc, seq=last.seq + 1, kind="insert",
                      data={"pos": -1, "text": " " + SENTINEL, "origin": "typed", "dts": [0, 90, 110, 95]}, prev=last.hash)
    return d["doc"], evs + [ev]


def test_pack_stores_no_text_anywhere(client, mailer, store, app, caplog, tmp_path):
    caplog.set_level(logging.DEBUG)
    sign_in(client, mailer, "priv@uni.example")
    doc, evs = _events_with_sentinel()
    heads = verify_chain(evs).heads
    assert client.post("/v1/checkpoint", json={"doc": doc, "heads": heads}).json()["created"]
    payload = [e.to_dict() for e in evs]
    for fmt in ("json", "html", "record"):
        r = client.post("/v1/pack", json={"events": payload, "title": "Sentinel essay", "student": "A. Student", "format": fmt})
        assert r.status_code == 200
        if fmt == "json":
            assert r.json()["analysis"]["document"]["final_chars"] > 0

    dump = store.dump_all_text()
    assert SENTINEL not in dump and "Sentinel essay" not in dump  # neither text nor the pack title
    for word in SENTINEL.lower().split()[:3]:
        assert word not in dump.lower()

    data_dir = Path(app.state.settings.data_dir)
    for p in list(data_dir.rglob("*")) if data_dir.exists() else []:
        if p.is_file():
            assert SENTINEL.encode() not in p.read_bytes(), p

    logged = "\n".join(r.getMessage() for r in caplog.records)
    assert SENTINEL not in logged and "A. Student" not in logged
    assert re.search(r"pack user=\w+ events=\d+ ms=\d+", logged), logged  # only ids, counts and durations


def test_alembic_migrations_match_models(tmp_path):
    from alembic import command
    from alembic.config import Config

    url = f"sqlite:///{tmp_path / 'migrated.sqlite'}"
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "trail" / "server" / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")

    insp = inspect(create_engine(url))
    migrated = {t: {c["name"] for c in insp.get_columns(t)} for t in insp.get_table_names() if t != "alembic_version"}
    modelled = {t.name: {c.name for c in t.columns} for t in Base.metadata.sorted_tables}
    assert migrated == modelled
    command.downgrade(cfg, "base")
    assert set(inspect(create_engine(url)).get_table_names()) <= {"alembic_version"}


PRIVACY_PAGE = ROOT / "web" / "src" / "marketing" / "pages" / "Privacy.tsx"
GENERATED = ROOT / "web" / "src" / "marketing" / "pages" / "schema.generated.ts"


def test_every_column_is_described():
    from trail.server.models import DESCRIPTIONS

    for t in Base.metadata.sorted_tables:
        assert t.name in DESCRIPTIONS, f"no description for table {t.name}"
        why, cols = DESCRIPTIONS[t.name]
        assert why
        for c in t.columns:
            assert cols.get(c.name), f"no description for {t.name}.{c.name}"
        assert set(cols) == {c.name for c in t.columns}, f"stale column descriptions for {t.name}"


def test_privacy_page_is_generated_from_the_schema():
    """/privacy renders STORED_TABLES from schema.generated.ts, which must be exactly what the
    generator produces from the live models: every table and every column, with its description."""
    from trail.server.gen_schema import render

    assert GENERATED.exists(), "run: python -m trail.server.gen_schema"
    generated = GENERATED.read_text()
    assert generated == render(), "schema.generated.ts is stale; run: python -m trail.server.gen_schema"
    assert "from './schema.generated'" in PRIVACY_PAGE.read_text()
    for t in Base.metadata.sorted_tables:
        assert f'"table": "{t.name}"' in generated, t.name
        for c in t.columns:
            assert f'"name": "{c.name}"' in generated, f"{t.name}.{c.name}"
    page = PRIVACY_PAGE.read_text().lower()
    for word in ("text", "events", "titles"):
        assert word in page  # it also says what is not stored


def test_no_request_body_logging():
    """No log call in the server package may pass a request, body, payload or event list to the
    logger (counts via len(...) are fine). The console mailer logs the outgoing email, which is
    the only "text" that may ever reach a log, and only in dev."""
    bad = []
    for p in (ROOT / "trail" / "server").glob("*.py"):
        for i, line in enumerate(p.read_text().splitlines(), 1):
            if not re.search(r"\blog(?:ger)?\.(?:info|debug|warning|error|exception)\(", line):
                continue
            args = re.sub(r'"[^"]*"', '""', line)  # only the arguments matter, not the format string
            args = re.sub(r"len\([^)]*\)", "", args)
            if re.search(r"\b(req|request|body|payload|events|evs)\b", args) and not re.search(r"request\.(method|url\.path)", args):
                bad.append(f"{p.name}:{i}: {line.strip()}")
    assert not bad, bad
