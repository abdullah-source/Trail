"""ai_presence: facts about AI sites in front while a document was open.

Hand-built records with known timing, so every number in the block is checked exactly;
the declaration sentence; older records without the `ai` flag; and the published demo
records, which must still analyse (the block is empty for the human-typed ones).
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from trail.analysis import ANALYSIS_VERSION, SWITCH_WINDOW_MS, ai_presence, analyse
from trail.chain import Chain, verify_chain
from trail.core.timeutil import format_ts
from trail.events import Event
from trail.pack import ai_sites_sentence, build_pack, declaration

ROOT = Path(__file__).resolve().parents[1]
T0 = datetime(2026, 10, 5, 10, 0, tzinfo=timezone.utc)
DOC = "6f0d1b2e-0000-4000-8000-000000000001"


def at(seconds: float) -> str:
    return format_ts(T0 + timedelta(seconds=seconds))


def session_a() -> list[Event]:
    """One sitting: type, go to chatgpt.com for a minute, come back, type and correct, later paste from it."""
    c = Chain(session="a" * 36, doc=DOC)
    c.append("session.start", {"editor": "docs", "host": "docs.google.com", "title_hash": None, "goal_words": None, "goal_minutes": None}, ts=at(0))
    c.append("insert", {"pos": 0, "text": "Hello world", "origin": "typed", "dts": [0] + [100] * 10}, ts=at(10))
    # the recorder sees the tab hidden; the background closes the editor tab's own dwell
    c.append("focus", {"state": "hidden"}, ts=at(20))
    c.append("source.visit", {"host": "docs.google.com", "dwell_ms": 20_000}, ts=at(20))
    # a minute on chatgpt.com, then back
    c.append("source.visit", {"host": "chatgpt.com", "dwell_ms": 60_000, "ai": True}, ts=at(80))
    c.append("focus", {"state": "focus", "from_host": "chatgpt.com", "from_ai": True}, ts=at(80))
    c.append("focus", {"state": "visible"}, ts=at(80))
    c.append("insert", {"pos": 11, "text": "abc", "origin": "typed", "dts": [0, 100, 100]}, ts=at(85))
    c.append("delete", {"pos": 13, "len": 1, "dts": [0]}, ts=at(90))
    c.append("insert", {"pos": 13, "text": "defgh", "origin": "typed", "dts": [0, 100, 100, 100, 100]}, ts=at(95))
    # outside the one-minute window
    c.append("insert", {"pos": 18, "text": "later", "origin": "typed", "dts": [0, 100, 100, 100, 100]}, ts=at(150))
    c.append("paste", {"paste_id": "p1", "pos": 23, "text": " AI text", "source_host": "chatgpt.com", "source_kind": "ai", "from_self": False}, ts=at(160))
    c.append("source.visit", {"host": "en.wikipedia.org", "dwell_ms": 30_000}, ts=at(170))
    # the recorder's own focus events never count as a return from an AI site
    c.append("focus", {"state": "focus"}, ts=at(175))
    c.append("session.end", {"reason": "completed"}, ts=at(180))
    return c.events


def session_b() -> list[Event]:
    """A second sitting the next day with no AI site in front."""
    c = Chain(session="b" * 36, doc=DOC)
    c.append("session.start", {"editor": "docs", "host": "docs.google.com", "title_hash": None, "goal_words": None, "goal_minutes": None}, ts=at(86_400))
    c.append("source.visit", {"host": "www.jstor.org", "dwell_ms": 90_000}, ts=at(86_460))
    c.append("insert", {"pos": 31, "text": " zz", "origin": "typed", "dts": [0, 100, 100]}, ts=at(86_470))
    c.append("session.end", {"reason": "completed"}, ts=at(86_500))
    return c.events


def test_ai_presence_counts_exactly():
    evs = session_a() + session_b()
    assert verify_chain(evs).ok
    ap = ai_presence(evs)
    assert ap["ai_minutes"] == 1.0
    assert ap["ai_hosts"] == [{"host": "chatgpt.com", "minutes": 1.0}]
    assert ap["switches"] == 1
    assert ap["typed_after_switch_chars"] == 8                 # "abc" + "defgh"; "later" is 70 s after the return
    assert ap["bursts_after_switch"] == 3                      # 85 s, 90 s and 95 s each start a run (gaps over 2 s)
    assert ap["correction_ratio_after_switch"] == 0.125        # 1 deleted / 8 typed
    assert ap["correction_ratio_overall"] == round(1 / 27, 4)  # 11 + 3 + 5 + 5 + 3 typed
    assert ap["ai_copy_paste_matches"] == 1
    assert ap["sessions_with_ai"] == 1 and ap["sessions_total"] == 2
    a, b = ap["by_session"]
    assert a["session"] == "a" * 36 and b["session"] == "b" * 36
    assert a["switches"] == 1 and a["typed_after_switch_chars"] == 8 and a["ai_copy_paste_matches"] == 1
    assert a["correction_ratio_overall"] == round(1 / 24, 4)
    assert b["ai_hosts"] == [] and b["switches"] == 0 and b["correction_ratio_after_switch"] is None
    assert b["correction_ratio_overall"] == 0.0
    # the facts are in the analysis under their own key, and the version moved
    full = analyse(evs)
    assert full["version"] == ANALYSIS_VERSION == "1.1"
    assert full["ai_presence"] == ap
    assert full["ai_presence"]["ai_copy_paste_matches"] == full["pastes"]["ai_pastes"]
    # a reader can see the window the numbers use
    assert SWITCH_WINDOW_MS == 60_000


def test_window_edges_and_overlapping_returns():
    c = Chain(session="c" * 36, doc=DOC)
    c.append("session.start", {"editor": "docs", "host": "docs.google.com", "title_hash": None, "goal_words": None, "goal_minutes": None}, ts=at(0))
    c.append("source.visit", {"host": "claude.ai", "dwell_ms": 30_000, "ai": True}, ts=at(30))
    c.append("focus", {"state": "focus", "from_host": "claude.ai", "from_ai": True}, ts=at(30))
    c.append("insert", {"pos": 0, "text": "edge", "origin": "typed", "dts": [0, 100, 100, 100]}, ts=at(90))      # exactly 60 s: counted
    c.append("insert", {"pos": 4, "text": "out", "origin": "typed", "dts": [0, 100, 100]}, ts=at(90.001))         # just past: not counted
    c.append("source.visit", {"host": "claude.ai", "dwell_ms": 10_000, "ai": True}, ts=at(100))
    c.append("focus", {"state": "focus", "from_host": "claude.ai", "from_ai": True}, ts=at(100))
    c.append("source.visit", {"host": "claude.ai", "dwell_ms": 5_000, "ai": True}, ts=at(110))
    c.append("focus", {"state": "focus", "from_host": "claude.ai", "from_ai": True}, ts=at(110))
    c.append("insert", {"pos": 7, "text": "once", "origin": "typed", "dts": [0, 100, 100, 100]}, ts=at(120))     # inside two windows: counted once
    c.append("session.end", {"reason": "completed"}, ts=at(200))
    ap = ai_presence(c.events)
    assert ap["switches"] == 3
    assert ap["typed_after_switch_chars"] == 8
    assert ap["bursts_after_switch"] == 2
    assert ap["ai_minutes"] == 0.8 and ap["ai_hosts"] == [{"host": "claude.ai", "minutes": 0.8}]


def test_older_records_use_the_host_list():
    """Records from before the `ai` flag: a visit to a known AI host counts, a web host does not,
    and a plain recorder focus event is not a return from an AI site."""
    c = Chain(session="d" * 36, doc=DOC)
    c.append("session.start", {"editor": "notion", "host": "www.notion.so", "title_hash": None, "goal_words": None, "goal_minutes": None}, ts=at(0))
    c.append("source.visit", {"host": "www.perplexity.ai", "dwell_ms": 120_000}, ts=at(0))
    c.append("source.visit", {"host": "en.wikipedia.org", "dwell_ms": 300_000}, ts=at(0))
    c.append("focus", {"state": "focus"}, ts=at(1))
    c.append("insert", {"pos": 0, "text": "typed", "origin": "typed", "dts": [0, 100, 100, 100, 100]}, ts=at(2))
    c.append("session.end", {"reason": "completed"}, ts=at(60))
    ap = ai_presence(c.events)
    assert ap["ai_hosts"] == [{"host": "www.perplexity.ai", "minutes": 2.0}]
    assert ap["switches"] == 0 and ap["typed_after_switch_chars"] == 0 and ap["bursts_after_switch"] == 0
    assert ap["sessions_with_ai"] == 1


def test_hosts_sorted_by_time_then_name():
    c = Chain(session="e" * 36, doc=DOC)
    c.append("session.start", {"editor": "docs", "host": "docs.google.com", "title_hash": None, "goal_words": None, "goal_minutes": None}, ts=at(0))
    c.append("source.visit", {"host": "gemini.google.com", "dwell_ms": 60_000, "ai": True}, ts=at(1))
    c.append("source.visit", {"host": "chatgpt.com", "dwell_ms": 60_000, "ai": True}, ts=at(2))
    c.append("source.visit", {"host": "claude.ai", "dwell_ms": 180_000, "ai": True}, ts=at(3))
    c.append("session.end", {"reason": "completed"}, ts=at(60))
    ap = ai_presence(c.events)
    assert [h["host"] for h in ap["ai_hosts"]] == ["claude.ai", "chatgpt.com", "gemini.google.com"]
    assert ap["ai_minutes"] == 5.0


def test_declaration_states_the_facts_only():
    a = analyse(session_a() + session_b())
    s = ai_sites_sentence(a)
    assert s == ("chatgpt.com was in front for 1 minute during 1 of 2 sessions; "
                 "I returned from it to the document once and typed 8 characters within a minute of returning.")
    text = declaration(a)
    assert s in text and "I pasted text from chatgpt.com" in text
    for word in ("suspicious", "cheat", "detect", "score", "verdict"):
        assert word not in text.lower()
    # no AI site in front: no sentence at all
    assert ai_sites_sentence(analyse(session_b())) is None
    assert "in front" not in declaration(analyse(session_b()))


def test_declaration_wording_for_several_hosts_and_no_returns():
    c = Chain(session="f" * 36, doc=DOC)
    c.append("session.start", {"editor": "docs", "host": "docs.google.com", "title_hash": None, "goal_words": None, "goal_minutes": None}, ts=at(0))
    c.append("source.visit", {"host": "claude.ai", "dwell_ms": 1_356_000, "ai": True}, ts=at(1))
    c.append("source.visit", {"host": "chatgpt.com", "dwell_ms": 20_000, "ai": True}, ts=at(2))
    c.append("insert", {"pos": 0, "text": "x", "origin": "typed", "dts": [0]}, ts=at(3))
    c.append("session.end", {"reason": "completed"}, ts=at(60))
    s = ai_sites_sentence(analyse(c.events))
    assert s == "claude.ai and chatgpt.com were in front for 23 minutes in total (claude.ai 23 minutes, chatgpt.com under a minute) during my only session."
    # returns without typing
    c2 = Chain(session="g" * 36, doc=DOC)
    c2.append("session.start", {"editor": "docs", "host": "docs.google.com", "title_hash": None, "goal_words": None, "goal_minutes": None}, ts=at(0))
    c2.append("source.visit", {"host": "chatgpt.com", "dwell_ms": 90_000, "ai": True}, ts=at(100))
    c2.append("focus", {"state": "focus", "from_host": "chatgpt.com", "from_ai": True}, ts=at(100))
    c2.append("source.visit", {"host": "chatgpt.com", "dwell_ms": 90_000, "ai": True}, ts=at(400))
    c2.append("focus", {"state": "focus", "from_host": "chatgpt.com", "from_ai": True}, ts=at(400))
    c2.append("insert", {"pos": 0, "text": "x", "origin": "typed", "dts": [0]}, ts=at(900))
    c2.append("session.end", {"reason": "completed"}, ts=at(1000))
    s2 = ai_sites_sentence(analyse(c2.events))
    assert s2 == "chatgpt.com was in front for 3 minutes during my only session; I returned from it to the document twice and typed nothing within a minute of returning."


def test_pack_carries_the_block():
    p = build_pack(session_a() + session_b(), title="t")
    assert p["analysis"]["ai_presence"]["switches"] == 1
    assert "within a minute of returning" in p["declaration"]


@pytest.mark.parametrize("path", sorted((ROOT / "web" / "public" / "demo").glob("*.events.json")))
def test_demo_records_still_analyse(path: Path):
    evs = [Event.from_dict(e) for e in json.loads(path.read_text())]
    a = analyse(evs)
    ap = a["ai_presence"]
    assert set(ap) >= {"ai_minutes", "ai_hosts", "switches", "typed_after_switch_chars", "bursts_after_switch",
                       "correction_ratio_after_switch", "correction_ratio_overall", "ai_copy_paste_matches",
                       "sessions_with_ai", "sessions_total", "by_session"}
    assert ap["sessions_total"] == len(a["sessions"]) == len(ap["by_session"])
    # the simulated processes never switch tabs, so nothing is "after a return" in any demo
    assert ap["switches"] == 0 and ap["typed_after_switch_chars"] == 0
    if "human" in path.name or "mixed" in path.name or "autotyped" in path.name:
        assert ap["ai_hosts"] == [] and ap["sessions_with_ai"] == 0
        assert ai_sites_sentence(a) is None
    else:
        # the ai_pasted demos visit chatgpt.com before pasting: a fact the block now shows
        assert [h["host"] for h in ap["ai_hosts"]] == ["chatgpt.com"]
