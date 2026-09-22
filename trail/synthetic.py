"""Synthetic writers for the backtest.

Each writer produces a stream of recorder events for one document and,
independently, the ground truth: the final text with a per-character origin
maintained by the simulator itself (not by trail.document). The backtest
then checks that replaying the events reproduces the text exactly and
attributes every line correctly.

Writer profiles:
    honest       types everything; typos, corrections, pauses, revisions
    mixed        types most, pastes a few blocks from the web or own notes
    heavy_paster pastes most of the essay from an AI tab, edits some of it
    autotyper    pastes nothing, but the "typing" is a script with a fixed interval
    jittered_bot a script with small random jitter (harder to catch)
    gapped       honest writer, but the recorder missed a stretch (resync)
"""

from __future__ import annotations

import random
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from trail.chain import Chain
from trail.core.canonical import sha256_hex
from trail.core.timeutil import format_ts
from trail.events import Event, classify_source

CORPUS = Path(__file__).resolve().parent.parent / "corpus"

AI_HOSTS = ["chatgpt.com", "claude.ai", "gemini.google.com", "perplexity.ai"]
WEB_HOSTS = ["en.wikipedia.org", "www.jstor.org", "scholar.google.com", "plato.stanford.edu", "www.bbc.co.uk"]
PROFILES = ("honest", "mixed", "heavy_paster", "autotyper", "jittered_bot", "gapped")


def load_lines(name: str) -> list[str]:
    p = CORPUS / name
    if p.exists():
        return [l for l in p.read_text().splitlines() if l.strip()]
    # Fallback if the corpus is missing: generated sentences.
    words = "the of and to in that is was he for it with as his on be at by this had not are but from or have an they which one you were".split()
    rng = random.Random(1)
    return [" ".join(rng.choice(words) for _ in range(rng.randint(8, 22))).capitalize() + "." for _ in range(2000)]


@dataclass
class TrueDoc:
    """The simulator's own document with per-character origin. Independent of trail.document."""
    chars: list[str] = field(default_factory=list)
    origin: list[str] = field(default_factory=list)
    edited: list[bool] = field(default_factory=list)

    def insert(self, pos: int, text: str, origin: str) -> None:
        self.chars[pos:pos] = list(text)
        self.origin[pos:pos] = [origin] * len(text)
        self.edited[pos:pos] = [False] * len(text)
        if origin == "typed":
            for j in (pos - 1, pos + len(text)):
                if 0 <= j < len(self.chars) and self.origin[j].startswith("paste:"):
                    self.edited[j] = True

    def delete(self, pos: int, n: int) -> None:
        del self.chars[pos:pos + n]
        del self.origin[pos:pos + n]
        del self.edited[pos:pos + n]
        for j in (pos - 1, pos):
            if 0 <= j < len(self.chars) and self.origin[j].startswith("paste:"):
                self.edited[j] = True

    @property
    def text(self) -> str:
        return "".join(self.chars)

    def line_labels(self) -> list[dict[str, Any]]:
        text = self.text
        out = []
        start = 0
        idx = 0
        while True:
            end = text.find("\n", start)
            if end < 0:
                end = len(text)
            seg_o = self.origin[start:end]
            seg_e = self.edited[start:end]
            typed = sum(1 for o in seg_o if o == "typed")
            unobs = sum(1 for o in seg_o if o == "unobserved")
            pasted = len(seg_o) - typed - unobs
            edited = any(e for o, e in zip(seg_o, seg_e) if o.startswith("paste:"))
            total = max(1, end - start)
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
            out.append({"index": idx, "label": label, "typed": typed, "pasted": pasted, "unobserved": unobs, "chars": end - start})
            idx += 1
            if end >= len(text):
                break
            start = end + 1
        return out


class Writer:
    def __init__(self, *, profile: str, seed: int, start: datetime, human_lines: list[str], paste_lines: list[str],
                 target_lines: int = 40):
        self.profile = profile
        self.rng = random.Random(seed)
        self.now = start
        self.human_lines = human_lines
        self.paste_lines = paste_lines
        self.target_lines = target_lines
        self.doc_id = str(uuid.UUID(int=self.rng.getrandbits(128), version=4))
        self.session_id = str(uuid.UUID(int=self.rng.getrandbits(128), version=4))
        self.chain = Chain(session=self.session_id, doc=self.doc_id)
        self.truth = TrueDoc()
        self.cursor = 0
        self.recording = True             # False during a simulated recorder gap
        self.pending_gap = False
        self.stats = {"typed": 0, "pasted": 0, "deleted": 0, "pastes": 0, "typos": 0, "revisions": 0, "unobserved": 0}
        self._last_key = None

    # -- time -------------------------------------------------------------------

    def ts(self) -> str:
        return format_ts(self.now)

    def _id(self) -> str:
        return str(uuid.UUID(int=self.rng.getrandbits(128), version=4))

    def _interval(self) -> int:
        r = self.rng
        if self.profile == "autotyper":
            return 55
        if self.profile == "jittered_bot":
            return max(20, int(r.gauss(70, 5)))
        base = r.lognormvariate(5.1, 0.55)   # median ~165 ms, human-like spread
        return max(30, min(int(base), 1900))

    # -- emit ----------------------------------------------------------------------

    def _emit(self, kind: str, data: dict[str, Any]) -> None:
        if self.recording:
            self.chain.append(kind, data, ts=self.ts(), id=self._id())

    # -- primitive edits (truth always updated; events only when recording) ----------

    def type_text(self, text: str) -> None:
        """Type text at the cursor as one or more keystroke batches."""
        i = 0
        while i < len(text):
            batch = text[i:i + self.rng.randint(8, 40)]
            dts = []
            t_start = self.now
            for k, ch in enumerate(batch):
                iv = self._interval()
                if k == 0:
                    dts.append(0)
                else:
                    self.now += timedelta(milliseconds=iv)
                    dts.append(iv)
                if ch == " " and self.profile not in ("autotyper", "jittered_bot") and self.rng.random() < 0.08:
                    extra = int(self.rng.lognormvariate(6.2, 0.8))  # word-boundary pause
                    self.now += timedelta(milliseconds=extra)
                    dts[-1] += extra
            pos = self.cursor
            saved_now = self.now
            self.now = t_start
            self._emit("insert", {"pos": pos, "text": batch, "origin": "typed", "dts": dts})
            self.now = saved_now
            self.truth.insert(pos, batch, "typed")
            self.cursor += len(batch)
            self.stats["typed"] += len(batch)
            i += len(batch)
            self.now += timedelta(milliseconds=self._interval())

    def delete_back(self, n: int) -> None:
        n = min(n, self.cursor)
        if n <= 0:
            return
        dts = [0] + [self._interval() for _ in range(n - 1)]
        pos = self.cursor - n
        self._emit("delete", {"pos": pos, "len": n, "dts": dts})
        self.truth.delete(pos, n)
        self.cursor = pos
        self.stats["deleted"] += n
        self.now += timedelta(milliseconds=sum(dts) + self._interval())

    def paste(self, text: str, host: str | None, from_self: bool = False) -> str:
        pid = self._id()
        kind = classify_source(host, from_self)
        self._emit("paste", {"paste_id": pid, "pos": self.cursor, "text": text, "source_host": host,
                             "source_kind": kind, "from_self": from_self})
        self.truth.insert(self.cursor, text, f"paste:{pid}")
        self.cursor += len(text)
        self.stats["pasted"] += len(text)
        self.stats["pastes"] += 1
        self.now += timedelta(milliseconds=self.rng.randint(300, 1500))
        return pid

    def think(self, lo_s: float, hi_s: float) -> None:
        self.now += timedelta(seconds=self.rng.uniform(lo_s, hi_s))

    def snapshot(self) -> None:
        t = self.truth.text
        self._emit("snapshot", {"text_hash": sha256_hex(t.encode("utf-8")), "chars": len(t),
                                "words": len(t.split()), "lines": t.count("\n") + 1})

    def visit(self, host: str) -> None:
        self._emit("source.visit", {"host": host, "dwell_ms": self.rng.randint(20_000, 400_000)})

    # -- higher-level behaviours ---------------------------------------------------

    def type_sentence_humanly(self, sentence: str) -> None:
        """Type with typos and occasional revisions."""
        words = sentence.split(" ")
        for wi, w in enumerate(words):
            token = w + (" " if wi < len(words) - 1 else "")
            if self.profile in ("autotyper", "jittered_bot"):
                self.type_text(token)
                continue
            r = self.rng.random()
            if r < 0.06 and len(w) > 3:
                # typo: type a wrong char mid-word, notice, backspace, retype
                k = self.rng.randint(1, len(w) - 1)
                wrong = w[:k] + self.rng.choice("qwertyuiopasdfghjklzxcvbnm")
                self.type_text(wrong)
                self.think(0.2, 0.9)
                self.delete_back(len(wrong) - k)
                self.type_text(w[k:] + (" " if wi < len(words) - 1 else ""))
                self.stats["typos"] += 1
            else:
                self.type_text(token)
        if self.rng.random() < 0.12:
            # revision: delete the last few words and rephrase
            tail = " ".join(words[-self.rng.randint(1, min(4, len(words))):])
            self.delete_back(len(tail))
            self.think(1.0, 6.0)
            self.type_text(self.rng.choice(self.human_lines).split(".")[0][: len(tail) + 10])
            self.stats["revisions"] += 1

    def edit_inside_last_paste(self, start: int, length: int) -> None:
        """Move into a pasted region, delete a few words, type replacements."""
        if length < 40:
            return
        pos = start + self.rng.randint(5, length - 30)
        self.cursor = pos
        # find a word boundary
        while self.cursor < len(self.truth.chars) and self.truth.chars[self.cursor] != " ":
            self.cursor += 1
        n = self.rng.randint(6, 25)
        n = min(n, len(self.truth.chars) - self.cursor)
        # delete forward: model as moving cursor to end of range then backspacing
        self.cursor += n
        self.delete_back(n)
        self.think(0.5, 3.0)
        self.type_text(" " + " ".join(self.rng.choice(self.human_lines).split()[: self.rng.randint(2, 5)]))
        self.cursor = len(self.truth.chars)

    def recorder_gap(self, n_lines: int) -> None:
        """The recorder stops observing; the writer keeps typing; then a resync."""
        self.recording = False
        for _ in range(n_lines):
            self.type_sentence_humanly(self.rng.choice(self.human_lines))
            self.type_text("\n")
        self.recording = True
        # what the truth knows: those chars are 'unobserved' from the recorder's viewpoint
        # Mark them in truth by re-labelling the just-added region.
        self._emit("resync", {"text": self.truth.text})

    # -- the essay -----------------------------------------------------------------

    def write(self) -> dict[str, Any]:
        r = self.rng
        editor = r.choice(["notion", "word", "generic"])
        self._emit("session.start", {"editor": editor, "host": {"notion": "www.notion.so", "word": "word.cloud.microsoft", "generic": "canvas.university.edu"}[editor],
                                     "title_hash": sha256_hex(b"essay"), "goal_words": 800, "goal_minutes": 90})
        for h in r.sample(WEB_HOSTS, 2):
            self.visit(h)
        if self.profile in ("heavy_paster",):
            self.visit(r.choice(AI_HOSTS))

        lines_done = 0
        gap_done = False
        while lines_done < self.target_lines:
            if lines_done and lines_done % r.randint(6, 12) == 0:
                self.snapshot()
            if self.profile == "gapped" and not gap_done and lines_done > self.target_lines // 3:
                gap_done = True
                n = r.randint(3, 6)
                before = len(self.truth.chars)
                self.recorder_gap(n)
                # truth: relabel the region typed during the gap as unobserved
                for j in range(before, len(self.truth.chars)):
                    self.truth.origin[j] = "unobserved"
                self.stats["unobserved"] += len(self.truth.chars) - before
                lines_done += n
                continue
            p = r.random()
            if self.profile == "heavy_paster" and p < 0.7:
                block = r.randint(2, 6)
                text = "\n".join(r.choice(self.paste_lines) for _ in range(block)) + "\n"
                start = self.cursor
                self.paste(text, r.choice(AI_HOSTS))
                if r.random() < 0.5:
                    self.edit_inside_last_paste(start, len(text))
                lines_done += block
            elif self.profile == "mixed" and p < 0.22:
                block = r.randint(1, 3)
                text = "\n".join(r.choice(self.paste_lines) for _ in range(block)) + "\n"
                host, self_ = (None, True) if r.random() < 0.4 else (r.choice(WEB_HOSTS), False)
                start = self.cursor
                self.paste(text, host, from_self=self_)
                if r.random() < 0.35:
                    self.edit_inside_last_paste(start, len(text))
                lines_done += block
            else:
                self.type_sentence_humanly(r.choice(self.human_lines))
                self.type_text("\n")
                lines_done += 1
                if self.profile not in ("autotyper", "jittered_bot") and r.random() < 0.25:
                    self.think(2, 40)
        self.snapshot()
        self._emit("session.end", {"reason": "completed"})
        events = self.chain.events
        return {
            "profile": self.profile,
            "doc": self.doc_id,
            "session": self.session_id,
            "events": events,
            "truth_text": self.truth.text,
            "truth_lines": self.truth.line_labels(),
            "truth_origin": list(self.truth.origin),
            "stats": dict(self.stats),
        }


def make_corpus(*, target_lines: int = 10_000, seed: int = 42, start: datetime | None = None,
                profile_weights: dict[str, float] | None = None) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    human = load_lines("human.txt")
    pasted = load_lines("pasted.txt")
    start = start or datetime(2026, 10, 5, 18, 0, tzinfo=timezone.utc)
    weights = profile_weights or {"honest": 0.40, "mixed": 0.25, "heavy_paster": 0.15, "autotyper": 0.07, "jittered_bot": 0.05, "gapped": 0.08}
    profiles = list(weights)
    w = [weights[p] for p in profiles]
    docs = []
    total = 0
    i = 0
    while total < target_lines:
        profile = rng.choices(profiles, w)[0]
        writer = Writer(profile=profile, seed=rng.getrandbits(32), start=start + timedelta(hours=3 * i),
                        human_lines=human, paste_lines=pasted, target_lines=rng.randint(25, 70))
        d = writer.write()
        docs.append(d)
        total += len(d["truth_lines"])
        i += 1
    return docs
