"""Writing events.

One session is one chain. Every event carries the hash of the event before
it, so the record of how a document was written cannot be edited after the
fact without breaking every later hash. Signed checkpoints (core/signing.py)
fix the chain head at a point in time.

Envelope (hashed fields):
    v, id, seq, session, doc, ts, kind, data, prev        + hash

Kinds and `data`:
    session.start  {editor, host, title_hash, goal_words, goal_minutes}
    session.end    {reason}
    insert         {pos, text, origin: "typed"|"ime"|"autocorrect", dts: [ms between keystrokes]}
    delete         {pos, len, dts: [ms]}
    paste          {paste_id, pos, text, source_host, source_kind, from_self}
    resync         {text}            full document text observed after a gap; regions that
                                     differ from the reconstructed document get origin "unobserved"
    snapshot       {text_hash, chars, words, lines}
    source.visit   {host, dwell_ms}
    focus          {state: "focus"|"blur"}
    ai.note        {tool, note}      the student's own declaration of an AI use

Text of inserts and pastes lives in the chain because the chain lives on the
student's own device, encrypted. Only chain heads reach the signing server.
"""

from __future__ import annotations

import copy
import uuid
from dataclasses import dataclass
from typing import Any

from trail.core.canonical import GENESIS_HASH, canonical_json, sha256_hex
from trail.core.timeutil import now_ts

SCHEMA_VERSION = 1

KINDS = {
    "session.start", "session.end", "insert", "delete", "paste", "resync",
    "snapshot", "source.visit", "focus", "ai.note",
}

# Hosts that identify a paste as coming from an AI assistant. Public and versioned
# so a reader of an evidence pack can see exactly how a source was classified.
AI_HOSTS = {
    "chatgpt.com", "chat.openai.com", "claude.ai", "gemini.google.com", "bard.google.com",
    "copilot.microsoft.com", "perplexity.ai", "www.perplexity.ai", "poe.com", "character.ai",
    "grok.com", "x.ai", "mistral.ai", "chat.mistral.ai", "deepseek.com", "chat.deepseek.com",
    "you.com", "writesonic.com", "jasper.ai", "app.jasper.ai", "notion.so/ai", "quillbot.com",
    "grammarly.com", "app.grammarly.com", "undetectable.ai", "phrasly.ai", "humanizeai.pro",
}
AI_HOSTS_VERSION = 1


def classify_source(host: str | None, from_self: bool = False) -> str:
    """ai | self | web | unknown"""
    if from_self:
        return "self"
    if not host:
        return "unknown"
    h = host.lower()
    if h in AI_HOSTS or any(h.endswith("." + a) for a in AI_HOSTS):
        return "ai"
    return "web"


def compute_hash(body: dict[str, Any]) -> str:
    return sha256_hex(canonical_json(body))


@dataclass(frozen=True)
class Event:
    session: str
    doc: str
    seq: int
    ts: str
    kind: str
    data: dict[str, Any]
    prev: str
    hash: str
    id: str
    v: int = SCHEMA_VERSION

    @staticmethod
    def body(*, session, doc, seq, ts, kind, data, prev, id, v=SCHEMA_VERSION) -> dict[str, Any]:
        return {"v": v, "id": id, "seq": seq, "session": session, "doc": doc, "ts": ts,
                "kind": kind, "data": data, "prev": prev}

    @classmethod
    def create(cls, *, session, doc, seq, kind, data, prev=GENESIS_HASH, ts=None, id=None) -> "Event":
        if kind not in KINDS:
            raise ValueError(f"unknown event kind {kind!r}")
        body = cls.body(session=session, doc=doc, seq=seq, ts=ts or now_ts(), kind=kind,
                        data=data, prev=prev, id=id or str(uuid.uuid4()))
        return cls(**body, hash=compute_hash(body))

    def body_dict(self) -> dict[str, Any]:
        return Event.body(session=self.session, doc=self.doc, seq=self.seq, ts=self.ts, kind=self.kind,
                          data=copy.deepcopy(self.data), prev=self.prev, id=self.id, v=self.v)

    def to_dict(self) -> dict[str, Any]:
        d = self.body_dict()
        d["hash"] = self.hash
        return d

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Event":
        missing = {"v", "id", "seq", "session", "doc", "ts", "kind", "data", "prev", "hash"} - set(d)
        if missing:
            raise ValueError(f"event missing fields: {sorted(missing)}")
        return cls(v=int(d["v"]), id=str(d["id"]), seq=int(d["seq"]), session=str(d["session"]),
                   doc=str(d["doc"]), ts=str(d["ts"]), kind=str(d["kind"]),
                   data=copy.deepcopy(dict(d["data"])), prev=str(d["prev"]), hash=str(d["hash"]))

    def is_hash_valid(self) -> bool:
        return compute_hash(self.body_dict()) == self.hash
