import json
import pytest
from trail.chain import Chain, verify_chain
from trail.core.canonical import GENESIS_HASH
from trail.document import replay
from trail.events import Event, classify_source


def test_chain_and_tamper():
    c = Chain(session="s", doc="d")
    c.append("session.start", {"editor": "notion", "host": "www.notion.so", "title_hash": None, "goal_words": None, "goal_minutes": None})
    c.append("insert", {"pos": 0, "text": "Hello", "origin": "typed", "dts": [0, 120, 90, 200, 150]})
    c.append("paste", {"paste_id": "p1", "pos": 5, "text": " world", "source_host": "chatgpt.com", "source_kind": "ai", "from_self": False})
    evs = c.events
    assert verify_chain(evs).ok and evs[0].prev == GENESIS_HASH and evs[2].prev == evs[1].hash
    d = evs[1].to_dict(); d["data"]["text"] = "Hallo"
    assert not verify_chain(evs[:1] + [Event.from_dict(d)] + evs[2:]).ok
    assert not verify_chain(evs[:1] + evs[2:]).ok


def test_provenance_survives_edits():
    c = Chain(session="s", doc="d")
    c.append("insert", {"pos": 0, "text": "abc\n", "origin": "typed", "dts": [0, 100, 100, 100]})
    c.append("paste", {"paste_id": "p", "pos": 4, "text": "PASTED LINE\n", "source_host": "chatgpt.com", "source_kind": "ai", "from_self": False})
    c.append("insert", {"pos": 0, "text": "X", "origin": "typed", "dts": [0]})          # shifts everything
    c.append("delete", {"pos": 5, "len": 2, "dts": [0, 100]})                                # deletes 'PA' from the paste
    c.append("insert", {"pos": 5, "text": "pa", "origin": "typed", "dts": [0, 100]})       # retypes them
    doc = replay(c.events)
    assert doc.text == "Xabc\npaSTED LINE\n"
    lines = doc.lines()
    assert lines[0].label == "typed" and lines[1].label == "pasted-edited" and lines[1].edited_after_paste
    assert doc.surviving_by_paste() == {"p": len("STED LINE\n")}


def test_unknown_positions_append():
    c = Chain(session="s", doc="gdoc:1")
    c.append("insert", {"pos": -1, "text": "ab", "origin": "typed", "dts": [0, 100]})
    c.append("insert", {"pos": -1, "text": "c", "origin": "typed", "dts": [0]})
    c.append("delete", {"pos": -1, "len": 1, "dts": [0]})
    assert replay(c.events).text == "ab"


def test_resync_marks_unobserved_and_snapshot_checks():
    c = Chain(session="s", doc="d")
    c.append("insert", {"pos": 0, "text": "typed part ", "origin": "typed", "dts": [0] * 11})
    c.append("resync", {"text": "typed part and something the recorder missed"})
    from trail.core.canonical import sha256_hex
    c.append("snapshot", {"text_hash": sha256_hex(b"typed part and something the recorder missed"), "chars": 44, "words": 8, "lines": 1})
    doc = replay(c.events)
    assert doc.unobserved_chars == len("and something the recorder missed") and doc.snapshot_mismatches == 0


def test_source_classification():
    assert classify_source("chatgpt.com") == "ai" and classify_source("chat.openai.com") == "ai"
    assert classify_source("en.wikipedia.org") == "web" and classify_source(None) == "unknown" and classify_source("x", True) == "self"
