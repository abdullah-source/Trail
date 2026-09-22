"""Per-session hash chain and verification (same construction as BlackBox)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable

from trail.core.canonical import GENESIS_HASH
from trail.events import Event


class ChainError(Exception):
    pass


@dataclass
class ChainReport:
    ok: bool
    sessions: int
    events: int
    errors: list[str] = field(default_factory=list)
    heads: dict[str, dict[str, Any]] = field(default_factory=dict)


class Chain:
    def __init__(self, *, session: str, doc: str):
        self.session = session
        self.doc = doc
        self._events: list[Event] = []

    @property
    def head(self) -> str:
        return self._events[-1].hash if self._events else GENESIS_HASH

    @property
    def seq(self) -> int:
        return len(self._events)

    @property
    def events(self) -> list[Event]:
        return list(self._events)

    def append(self, kind: str, data: dict[str, Any], *, ts: str | None = None, id: str | None = None) -> Event:
        ev = Event.create(session=self.session, doc=self.doc, seq=self.seq, kind=kind, data=data,
                          prev=self.head, ts=ts, id=id)
        self._events.append(ev)
        return ev


def verify_chain(events: Iterable[Event]) -> ChainReport:
    by_session: dict[str, list[Event]] = {}
    total = 0
    for ev in events:
        by_session.setdefault(ev.session, []).append(ev)
        total += 1
    errors: list[str] = []
    heads: dict[str, dict[str, Any]] = {}
    for session, evs in sorted(by_session.items()):
        evs.sort(key=lambda e: e.seq)
        prev = GENESIS_HASH
        expected = 0
        doc = evs[0].doc
        for ev in evs:
            where = f"session {session} seq {ev.seq}"
            if ev.seq != expected:
                errors.append(f"{where}: expected seq {expected} (gap or duplicate)")
                expected = ev.seq
            if ev.doc != doc:
                errors.append(f"{where}: doc changed mid-session")
            if ev.prev != prev:
                errors.append(f"{where}: prev hash mismatch")
            if not ev.is_hash_valid():
                errors.append(f"{where}: event hash does not match contents")
            prev = ev.hash
            expected += 1
        heads[session] = {"seq": evs[-1].seq, "hash": evs[-1].hash, "first_ts": evs[0].ts}
    return ChainReport(ok=not errors, sessions=len(by_session), events=total, errors=errors, heads=heads)
