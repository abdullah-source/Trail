"""Real texts, simulated processes: corpus, RealWriter scenarios, real backtest, demo files."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from trail.analysis import analyse
from trail.backtest import real_verdict, run_real, to_markdown_real
from trail.chain import verify_chain
from trail.demo_data import PLAN, build, title_from
from trail.document import replay
from trail.events import Event
from trail.synthetic import SCENARIOS, RealWriter, load_lines, load_real, reword

ROOT = Path(__file__).resolve().parents[1]
START = datetime(2026, 9, 10, 9, 0, tzinfo=timezone.utc)


@pytest.fixture(scope="module")
def corpus():
    return load_real("human"), load_real("ai"), load_real("quotes")


def test_real_corpus_shape(corpus):
    human, ai, quotes = corpus
    assert len(human) >= 150 and len(ai) >= 150 and len(quotes) >= 20
    for rows in (human, ai):
        ids = [r["id"] for r in rows]
        assert len(set(ids)) == len(ids)
        for r in rows:
            assert set(r) >= {"id", "text", "words", "source", "url", "licence"}
            assert 150 <= r["words"] <= 700 and r["words"] == len(r["text"].split())
            assert r["licence"] and r["url"].startswith("https://")
    total = sum((ROOT / "corpus" / "real" / f).stat().st_size for f in ("human.jsonl", "ai.jsonl", "quotes.jsonl"))
    assert total < 3_000_000
    assert (ROOT / "corpus" / "real" / "SOURCES.md").exists()


@pytest.mark.parametrize("scenario", SCENARIOS)
def test_real_writer_replays_and_attributes(scenario, corpus):
    human, ai, quotes = corpus
    lines = load_lines("human.txt")
    items = (human if scenario in ("human_typed", "mixed_quotes") else ai)[:4]
    for i, item in enumerate(items):
        w = RealWriter(scenario=scenario, text=item["text"], seed=100 + i, start=START, quotes=quotes, human_lines=lines)
        d = w.write()
        evs = d["events"]
        assert verify_chain(evs).ok
        doc = replay(evs)
        assert doc.text == d["truth_text"]
        assert [l.label for l in doc.lines()] == [l["label"] for l in d["truth_lines"]]
        a = analyse(evs)
        assert a["document"]["typed_share"] == d["truth"]["typed_share"]
        assert a["pastes"]["pasted_chars"] == d["truth"]["pasted_chars"]
        assert len(a["sessions"]) == d["truth"]["sessions"] == len(d["sessions"])
        hosts = {s["host"] for s in d["truth"]["paste_sources"]}
        if scenario in ("human_typed", "ai_autotyped"):
            assert not hosts and a["pastes"]["count"] == 0
            # the typed text is the essay verbatim
            assert doc.text == item["text"].strip()
        if scenario.startswith("ai_pasted"):
            assert hosts == {"chatgpt.com"} and a["pastes"]["by_source_kind"].keys() == {"ai"}
        if scenario == "mixed_quotes":
            assert hosts and all(a["pastes"]["by_source_kind"].keys() == {"web"} for _ in [0])
            assert d["truth"]["sessions"] >= 2
        if scenario == "human_typed":
            assert d["truth"]["sessions"] >= 2 and d["stats"]["typos"] + d["stats"]["revisions"] > 0
        assert a["regularity"]["flagged"] == (scenario == "ai_autotyped")


def test_reword_changes_sentence():
    import random
    s = "However, the results demonstrate that individuals adapt."
    assert reword(s, random.Random(1)) != s


def test_run_real_small_passes():
    r = run_real(seed=3, limit=3)
    assert r["corpus"]["documents"] == 15
    assert real_verdict(r)
    md = to_markdown_real(r)
    assert md.startswith("# Trail backtest on real texts") and "does not detect AI" in md
    assert r["overall"]["humans_flagged"] == 0 and r["overall"]["autotyped_flagged"] == 3


def test_demo_data_matches_extension_export_shape(tmp_path):
    now = datetime(2026, 9, 22, 12, 0, tzinfo=timezone.utc)
    manifest = build(tmp_path, seed=7, now=now)
    assert [m["id"] for m in manifest] == [p[0] for p in PLAN]
    assert json.loads((tmp_path / "manifest.json").read_text()) == manifest
    fixture = json.loads((ROOT / "web" / "src" / "lib" / "fixtures" / "mock-honest.json").read_text())["events"][0]
    docs = set()
    for m in manifest:
        assert m["kind"] in ("human", "ai_pasted", "ai_chunks", "ai_autotyped", "mixed")
        assert 300 <= m["words"] <= 600 and 1 <= m["sessions"] <= 4
        assert m["title"] and m["blurb"] and m["description"] == m["blurb"]
        raw = json.loads((tmp_path / f"{m['id']}.events.json").read_text())
        assert isinstance(raw, list) and raw
        for ev in raw:
            assert list(ev.keys()) == list(fixture.keys())
            assert now - timedelta(days=14) <= datetime.fromisoformat(ev["ts"].replace("Z", "+00:00")) <= now
        evs = [Event.from_dict(e) for e in raw]
        assert verify_chain(evs).ok
        docs.add(evs[0].doc)
        a = analyse(evs)
        assert a["document"]["typed_share"] == m["truth"]["typed_share"] == m["expect"]["typed_share"]
        assert a["pastes"]["pasted_chars"] == m["truth"]["pasted_chars"] == m["expect"]["pasted_chars"]
        assert m["expect"]["regularity_flagged"] == m["truth"]["scripted"]
        assert len(a["sessions"]) == m["sessions"]
    assert len(docs) == len(manifest)  # one distinct doc id per demo


def test_title_from():
    assert title_from("Introduction:\nThe supply and demand theory is a fundamental concept in economics (Smith, 2020), and more.") == "Supply and demand theory is a fundamental concept"
