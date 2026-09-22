"""Document reconstruction with per-character provenance.

Replaying a session's events rebuilds the document exactly and tags every
surviving character with where it came from:

    typed        keystrokes
    paste:<id>   a paste event (looked up for source host and kind)
    unobserved   text that appeared while the recorder was not watching (resync)

From that, every line of the final document gets a provenance label:

    typed          >= 90% typed characters
    pasted         >= 90% characters from pastes, none edited since
    pasted-edited  mostly pasted, but with typed edits inside the line
    mixed          anything else
    unobserved     mostly unobserved

The labels are the same definitions the backtest uses as ground truth, so the
backtest checks reconstruction and attribution, not the labelling rule.
"""

from __future__ import annotations

import difflib
from dataclasses import dataclass, field
from typing import Any, Iterable

from trail.core.canonical import sha256_hex
from trail.events import Event, classify_source

TYPED = "typed"
UNOBSERVED = "unobserved"


@dataclass
class PasteInfo:
    paste_id: str
    ts: str
    pos: int
    length: int
    source_host: str | None
    source_kind: str
    from_self: bool
    text_hash: str


@dataclass
class LineProvenance:
    index: int
    text: str
    typed: int
    pasted: int
    unobserved: int
    paste_ids: list[str]
    edited_after_paste: bool
    label: str

    @property
    def chars(self) -> int:
        return len(self.text)


@dataclass
class Document:
    chars: list[str] = field(default_factory=list)
    origin: list[str] = field(default_factory=list)      # TYPED | "paste:<id>" | UNOBSERVED
    edited: list[bool] = field(default_factory=list)     # True if a typed edit touched a pasted char's neighbourhood
    pastes: dict[str, PasteInfo] = field(default_factory=dict)
    typed_chars: int = 0
    deleted_chars: int = 0
    deleted_by_origin: dict[str, int] = field(default_factory=dict)
    unobserved_chars: int = 0
    snapshot_checks: int = 0
    snapshot_mismatches: int = 0
    resyncs: int = 0

    # -- state -------------------------------------------------------------

    @property
    def text(self) -> str:
        return "".join(self.chars)

    def text_hash(self) -> str:
        return sha256_hex(self.text.encode("utf-8"))

    # -- mutation ------------------------------------------------------------

    def _insert(self, pos: int, text: str, origin: str) -> None:
        if pos < 0:  # editor could not report a position (Google Docs): append
            pos = len(self.chars)
        pos = max(0, min(pos, len(self.chars)))
        n = len(text)
        self.chars[pos:pos] = list(text)
        self.origin[pos:pos] = [origin] * n
        self.edited[pos:pos] = [False] * n
        if origin == TYPED:
            # A typed insertion inside or adjacent to pasted text marks that paste as edited.
            for j in (pos - 1, pos + n):
                if 0 <= j < len(self.chars) and self.origin[j].startswith("paste:"):
                    self.edited[j] = True

    def _delete(self, pos: int, length: int) -> None:
        if pos < 0:  # unknown position: delete from the end
            pos = max(0, len(self.chars) - length)
        pos = max(0, min(pos, len(self.chars)))
        end = max(pos, min(pos + length, len(self.chars)))
        for o in self.origin[pos:end]:
            key = "paste" if o.startswith("paste:") else o
            self.deleted_by_origin[key] = self.deleted_by_origin.get(key, 0) + 1
        self.deleted_chars += end - pos
        del self.chars[pos:end]
        del self.origin[pos:end]
        del self.edited[pos:end]
        for j in (pos - 1, pos):
            if 0 <= j < len(self.chars) and self.origin[j].startswith("paste:"):
                self.edited[j] = True

    def apply(self, ev: Event) -> None:
        d = ev.data
        k = ev.kind
        if k == "insert":
            self._insert(int(d["pos"]), str(d["text"]), TYPED)
            self.typed_chars += len(d["text"])
        elif k == "delete":
            self._delete(int(d["pos"]), int(d["len"]))
        elif k == "paste":
            pid = str(d["paste_id"])
            text = str(d["text"])
            self.pastes[pid] = PasteInfo(
                paste_id=pid, ts=ev.ts, pos=int(d["pos"]), length=len(text),
                source_host=d.get("source_host"), source_kind=str(d.get("source_kind") or classify_source(d.get("source_host"), bool(d.get("from_self")))),
                from_self=bool(d.get("from_self")), text_hash=sha256_hex(text.encode("utf-8")),
            )
            self._insert(int(d["pos"]), text, f"paste:{pid}")
        elif k == "resync":
            self._resync(str(d["text"]))
        elif k == "snapshot":
            self.snapshot_checks += 1
            if d.get("text_hash") != self.text_hash():
                self.snapshot_mismatches += 1

    def _resync(self, observed: str) -> None:
        """Reconcile with a full observed text; unexplained differences become unobserved."""
        self.resyncs += 1
        current = self.text
        if current == observed:
            return
        sm = difflib.SequenceMatcher(None, current, observed, autojunk=False)
        new_chars: list[str] = []
        new_origin: list[str] = []
        new_edited: list[bool] = []
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag == "equal":
                new_chars.extend(self.chars[i1:i2]); new_origin.extend(self.origin[i1:i2]); new_edited.extend(self.edited[i1:i2])
            elif tag in ("replace", "insert"):
                seg = observed[j1:j2]
                new_chars.extend(seg); new_origin.extend([UNOBSERVED] * len(seg)); new_edited.extend([False] * len(seg))
                self.unobserved_chars += len(seg)
            # delete: drop
        self.chars, self.origin, self.edited = new_chars, new_origin, new_edited

    # -- provenance ------------------------------------------------------------

    def surviving_by_paste(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for o in self.origin:
            if o.startswith("paste:"):
                out[o[6:]] = out.get(o[6:], 0) + 1
        return out

    def lines(self) -> list[LineProvenance]:
        out: list[LineProvenance] = []
        start = 0
        n = len(self.chars)
        idx = 0
        while start <= n:
            try:
                end = self.chars.index("\n", start)
            except ValueError:
                end = n
            out.append(self._line(idx, start, end))
            idx += 1
            start = end + 1
            if end == n:
                break
        return out

    def _line(self, idx: int, a: int, b: int) -> LineProvenance:
        typed = pasted = unobs = 0
        pids: list[str] = []
        edited = False
        for j in range(a, b):
            o = self.origin[j]
            if o == TYPED:
                typed += 1
            elif o == UNOBSERVED:
                unobs += 1
            else:
                pasted += 1
                pid = o[6:]
                if pid not in pids:
                    pids.append(pid)
                if self.edited[j]:
                    edited = True
        total = max(1, b - a)
        if typed / total >= 0.9:
            label = "typed"
        elif unobs / total >= 0.9:
            label = "unobserved"
        elif pasted / total >= 0.9 and not edited and typed == 0:
            label = "pasted"
        elif pasted / total >= 0.5:
            label = "pasted-edited"
        else:
            label = "mixed"
        return LineProvenance(index=idx, text="".join(self.chars[a:b]), typed=typed, pasted=pasted,
                              unobserved=unobs, paste_ids=pids, edited_after_paste=edited, label=label)


def replay(events: Iterable[Event]) -> Document:
    doc = Document()
    for ev in sorted(events, key=lambda e: (e.ts, e.seq)):
        doc.apply(ev)
    return doc
