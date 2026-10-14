"""Generate parity fixtures for web/src/lib/analysis.ts from the Python reference.

    cd trail/web && pnpm fixtures      (or: ../.venv/bin/python src/lib/fixtures/make_fixtures.py)

Writes fixtures/<name>.json: {events, analysis, lines, drafts, declaration}
and fixtures/patterns.json: {names, patterns}. Mock essays (mixed, heavy_paster,
honest at 25 lines) are also used by mock.ts for the designer's replay.
The ai-tabs-* fixtures exercise the ai_presence block: a writer who keeps an AI
tab open, comes back from it and types (the events the extension records for that).
"""
from __future__ import annotations
import json, sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3]))
from trail.analysis import analyse
from trail.chain import Chain
from trail.core.canonical import sha256_hex
from trail.document import replay
from trail.pack import declaration, drafts, patterns
from trail.synthetic import WEB_HOSTS, Writer, load_lines, PROFILES


class AiTabWriter(Writer):
    """A mixed writer with an AI tab open in another tab. Sessions listed in `ai_sessions` as True
    switch to the AI tab now and then; coming back is recorded the way the extension records it:
    the editor tab's own dwell as a source.visit, the AI tab's dwell as source.visit {ai: true},
    then focus {state: "focus", from_host, from_ai: true} and the recorder's visibility events."""

    def __init__(self, *, seed: int, start: datetime, human_lines: list[str], paste_lines: list[str],
                 ai_sessions: list[bool], ai_hosts: list[str], lines_per_session: int = 8):
        super().__init__(profile="mixed", seed=seed, start=start, human_lines=human_lines, paste_lines=paste_lines,
                         target_lines=lines_per_session * len(ai_sessions))
        self.ai_sessions = ai_sessions
        self.ai_hosts = ai_hosts
        self.lines_per_session = lines_per_session
        self._done: list = []

    def _start_session(self) -> None:
        self.session_id = self._id()
        self.chain = Chain(session=self.session_id, doc=self.doc_id)
        self._emit("session.start", {"editor": "docs", "host": "docs.google.com", "title_hash": sha256_hex(b"ai tabs"),
                                     "goal_words": 600, "goal_minutes": 60})
        self._front_since = self.now

    def _ai_round_trip(self, host: str) -> None:
        r = self.rng
        # leave the editor: the recorder sees the tab hidden, the background closes the editor tab's dwell
        self._emit("focus", {"state": "hidden"})
        self._emit("source.visit", {"host": "docs.google.com", "dwell_ms": int((self.now - self._front_since).total_seconds() * 1000)})
        dwell = r.randint(15_000, 240_000)
        self.now += timedelta(milliseconds=dwell)
        # back: the AI tab's dwell, the return itself, and the recorder seeing the tab again
        self._emit("source.visit", {"host": host, "dwell_ms": dwell, "ai": True})
        self._emit("focus", {"state": "focus", "from_host": host, "from_ai": True})
        self._emit("focus", {"state": "visible"})
        self._front_since = self.now

    def write(self) -> dict[str, Any]:
        r = self.rng
        for si, with_ai in enumerate(self.ai_sessions):
            self._start_session()
            for h in r.sample(WEB_HOSTS, 1):
                self.visit(h)
            done = 0
            while done < self.lines_per_session:
                if with_ai and r.random() < 0.4:
                    host = r.choice(self.ai_hosts)
                    self._ai_round_trip(host)
                    self.think(0.5, 6.0)
                    if r.random() < 0.3:
                        text = r.choice(self.paste_lines) + "\n"
                        start = self.cursor
                        self.paste(text, host)
                        if r.random() < 0.5:
                            self.edit_inside_last_paste(start, len(text))
                    else:
                        self.type_sentence_humanly(r.choice(self.human_lines))
                        self.type_text("\n")
                    done += 1
                    if r.random() < 0.5:
                        self.think(60, 200)   # some typing lands outside the one-minute window
                else:
                    self.type_sentence_humanly(r.choice(self.human_lines))
                    self.type_text("\n")
                    done += 1
                    if r.random() < 0.25:
                        self.think(2, 40)
                if done % 4 == 0:
                    self.snapshot()
            self.snapshot()
            last = si == len(self.ai_sessions) - 1
            self._emit("session.end", {"reason": "completed" if last else "closed"})
            self._done.extend(self.chain.events)
            if not last:
                self.now += timedelta(hours=r.uniform(5, 30))
        return {"profile": self.profile, "doc": self.doc_id, "events": list(self._done), "truth_text": self.truth.text,
                "truth_lines": self.truth.line_labels(), "truth_origin": list(self.truth.origin), "stats": dict(self.stats)}

# name -> (profile, seed, lines, start)
SPECS: dict[str, tuple[str, int, int, datetime]] = {
    "mock-mixed": ("mixed", 7, 25, datetime(2026, 9, 14, 21, 40, tzinfo=timezone.utc)),
    "mock-heavy_paster": ("heavy_paster", 11, 25, datetime(2026, 9, 9, 23, 5, tzinfo=timezone.utc)),
    "mock-honest": ("honest", 3, 25, datetime(2026, 9, 17, 22, 15, tzinfo=timezone.utc)),
}
i = 0
for profile in PROFILES:
    for seed in (1, 2, 3):
        i += 1
        SPECS[f"{profile}-{seed}"] = (profile, seed * 13 + i, 10 + (seed * 3) % 7, datetime(2026, 10, 1 + i, 8 + (i * 5) % 14, 7 * i % 60, tzinfo=timezone.utc))

# name -> (seed, ai_sessions, ai_hosts, start)
AI_SPECS: dict[str, tuple[int, list[bool], list[str], datetime]] = {
    "ai-tabs-1": (21, [False, True], ["chatgpt.com"], datetime(2026, 10, 3, 19, 10, tzinfo=timezone.utc)),
    "ai-tabs-2": (22, [True, False, True], ["claude.ai", "chatgpt.com"], datetime(2026, 10, 6, 13, 25, tzinfo=timezone.utc)),
}


def main() -> None:
    human, pasted = load_lines("human.txt"), load_lines("pasted.txt")
    analyses = []
    names = []
    docs = [(name, lambda profile=profile, seed=seed, lines=lines, start=start: Writer(profile=profile, seed=seed, start=start, human_lines=human, paste_lines=pasted, target_lines=lines).write())
            for name, (profile, seed, lines, start) in SPECS.items()]
    docs += [(name, lambda seed=seed, ai_sessions=ai_sessions, ai_hosts=ai_hosts, start=start: AiTabWriter(seed=seed, start=start, human_lines=human, paste_lines=pasted, ai_sessions=ai_sessions, ai_hosts=ai_hosts).write())
             for name, (seed, ai_sessions, ai_hosts, start) in AI_SPECS.items()]
    for name, make in docs:
        d = make()
        profile = d["profile"]
        evs = d["events"]
        a = analyse(evs)
        doc = replay(evs)
        out = {
            "profile": profile,
            "events": [e.to_dict() for e in evs],
            "analysis": a,
            "lines": [{"index": l.index, "text": l.text, "typed": l.typed, "pasted": l.pasted, "unobserved": l.unobserved, "label": l.label} for l in doc.lines()],
            "drafts": [{k: v for k, v in x.items() if k != "text_hash"} for x in drafts(evs)],
            "declaration": declaration(a, student="A. Student", course="PHIL101 · Essay 2"),
            "declaration_plain": declaration(a),
        }
        p = HERE / f"{name}.json"
        p.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
        ap = a["ai_presence"]
        print(f"{name}: {len(evs)} events, {p.stat().st_size // 1024} KB, {a['document']['final_words']} words, labels {a['line_labels']}, "
              f"ai {ap['ai_minutes']} min / {ap['switches']} switches / {ap['typed_after_switch_chars']} chars after")
        analyses.append(a); names.append(name)
    (HERE / "patterns.json").write_text(json.dumps({"names": names, "patterns": patterns(analyses)}, ensure_ascii=False))
    (HERE / "index.json").write_text(json.dumps(names))

if __name__ == "__main__":
    main()
