"""Generate parity fixtures for web/src/lib/analysis.ts from the Python reference.

    cd trail/web && pnpm fixtures      (or: ../.venv/bin/python src/lib/fixtures/make_fixtures.py)

Writes fixtures/<name>.json: {events, analysis, lines, drafts, declaration}
and fixtures/patterns.json: {names, patterns}. Mock essays (mixed, heavy_paster,
honest at 25 lines) are also used by mock.ts for the designer's replay.
"""
from __future__ import annotations
import json, sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3]))
from trail.analysis import analyse
from trail.document import replay
from trail.pack import declaration, drafts, patterns
from trail.synthetic import Writer, load_lines, PROFILES

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

def main() -> None:
    human, pasted = load_lines("human.txt"), load_lines("pasted.txt")
    analyses = []
    names = []
    for name, (profile, seed, lines, start) in SPECS.items():
        d = Writer(profile=profile, seed=seed, start=start, human_lines=human, paste_lines=pasted, target_lines=lines).write()
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
        print(f"{name}: {len(evs)} events, {p.stat().st_size // 1024} KB, {a['document']['final_words']} words, labels {a['line_labels']}")
        analyses.append(a); names.append(name)
    (HERE / "patterns.json").write_text(json.dumps({"names": names, "patterns": patterns(analyses)}, ensure_ascii=False))
    (HERE / "index.json").write_text(json.dumps(names))

if __name__ == "__main__":
    main()
