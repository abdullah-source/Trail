"""Demo records for the web app: six real essays with simulated writing processes.

    python -m trail.demo_data --out web/public/demo [--seed 7] [--now 2026-09-22T12:00:00Z]

Writes <id>.events.json (a JSON array of events, exactly what the extension exports
and the browser replay engine reads) and manifest.json with the ground truth of each
simulation next to what the Python analysis computed from the record ("expect").
Trail records process, not content: the texts are real human and real ChatGPT essays
from public datasets (corpus/real/SOURCES.md); the processes are simulated.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from trail.analysis import analyse
from trail.chain import verify_chain
from trail.core.timeutil import parse_ts
from trail.document import replay
from trail.synthetic import RealWriter, load_lines, load_real

# demo id -> (scenario, kind shown to the web app, which corpus, preferred source prefix)
PLAN = [
    ("demo-human-1", "human_typed", "human", "gb-human"),
    ("demo-human-2", "human_typed", "human", "gb-human"),
    ("demo-ai-pasted-1", "ai_pasted_whole", "ai", "gb-gpt"),
    ("demo-ai-chunks-1", "ai_pasted_chunks", "ai", "gb-gpt"),
    ("demo-ai-autotyped-1", "ai_autotyped", "ai", "gb-gpt"),
    ("demo-mixed-1", "mixed_quotes", "human", "gb-human"),
]
KIND = {"human_typed": "human", "ai_pasted_whole": "ai_pasted", "ai_pasted_chunks": "ai_chunks",
        "ai_autotyped": "ai_autotyped", "mixed_quotes": "mixed"}
WORDS = (300, 600)
# Hand-written titles for the texts the default seed picks; title_from() is the fallback.
TITLES = {
    "gb-human-5": "The role of the medical office assistant",
    "gb-human-152": "Why clinical experience matters in medical education",
    "gb-human-247": "European colonial powers in the Caribbean",
    "gb-gpt-81": "What globalization means for managers",
    "gb-gpt-220": "Supply and demand in market economies",
    "gb-gpt-69": "Philosophical and mathematical logic",
}
STOP = {"the", "a", "an", "of", "in", "on", "and", "to", "for", "is", "was", "that", "this", "it", "as", "by", "with", "at", "from"}


def title_from(text: str) -> str:
    """A plausible essay title: the gist of the first real sentence, at most eight words."""
    first = next((l for l in text.split("\n") if len(l.split()) > 6 and not l.rstrip().endswith(":")), text.split("\n")[0])
    sent = re.split(r"(?<=[.!?])\s+", first)[0]
    sent = re.sub(r"\([^)]*\)", "", sent)                      # drop citations
    sent = re.split(r"[:;,]| -- | - ", sent)[0].strip()
    words = sent.split()
    if words and words[0].lower() in ("the", "a", "an", "in", "this"):
        words = words[1:]
    cut = words[:8]
    while cut and cut[-1].lower() in STOP:
        cut.pop()
    title = " ".join(cut).strip(" .!?\"'")
    return (title[0].upper() + title[1:]) if title else "Untitled essay"


def blurb(scenario: str, truth: dict[str, Any], a: dict[str, Any]) -> str:
    n = truth["sessions"]
    reg = a["regularity"]
    hosts = sorted({s["host"] for s in truth["paste_sources"]})
    if scenario == "human_typed":
        return (f"Every character was typed by hand over {n} session{'s' if n != 1 else ''}, with typos corrected and pauses "
                f"between sentences; no pastes, {a['cadence']['deleted_chars']} characters deleted along the way.")
    if scenario == "ai_pasted_whole":
        return (f"One paste of {truth['pasted_chars']:,} characters from chatgpt.com, then a few sentences reworded by hand; "
                f"{truth['typed_share']:.0%} of the final text was typed.")
    if scenario == "ai_pasted_chunks":
        return (f"{len(truth['paste_sources'])} pastes from chatgpt.com, one paragraph at a time over {n} session{'s' if n != 1 else ''}, "
                f"with some paragraphs partly reworded; {truth['typed_share']:.0%} of the final text was typed.")
    if scenario == "ai_autotyped":
        return (f"No pastes and a 100% typed share, but the keystroke rhythm is uniform (spread {reg['inter_key_spread']}) with no "
                f"corrections in {a['cadence']['typed_chars']:,} characters: consistent with scripted typing, which Trail reports as a signal, not a verdict.")
    return (f"Typed by hand over {n} sessions with {len(truth['paste_sources'])} quotation{'s' if len(truth['paste_sources']) != 1 else ''} pasted "
            f"from {', '.join(hosts)}; {truth['typed_share']:.0%} of the final text was typed.")


def build(out: Path, *, seed: int = 7, now: datetime | None = None) -> list[dict[str, Any]]:
    now = now or datetime.now(timezone.utc)
    rng = random.Random(seed)
    corpus = {"human": load_real("human"), "ai": load_real("ai")}
    quotes = load_real("quotes")
    lines = load_lines("human.txt")
    if not corpus["human"] or not corpus["ai"]:
        raise SystemExit("corpus/real/*.jsonl missing; run corpus/real/build.py first")
    used: set[str] = set()
    out.mkdir(parents=True, exist_ok=True)
    manifest = []
    for demo_id, scenario, which, prefix in PLAN:
        pool = [t for t in corpus[which] if WORDS[0] <= t["words"] <= WORDS[1] and t["id"] not in used and t["id"].startswith(prefix)]
        item = rng.choice(pool)
        used.add(item["id"])
        # spread the sessions over the last two weeks, ending before `now`
        start = now - timedelta(days=rng.uniform(3, 12), hours=rng.uniform(0, 12))
        for _ in range(8):
            w = RealWriter(scenario=scenario, text=item["text"], seed=rng.getrandbits(32), start=start, quotes=quotes,
                           human_lines=lines, session_gap_hours=(6.0, 60.0))
            # one stable, distinct doc id per demo: the server keys checkpoints on it
            w.doc_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"trail-demo/{demo_id}"))
            d = w.write()
            last = parse_ts(d["events"][-1].ts)
            if last < now:
                break
            start -= (last - now) + timedelta(hours=2)
        evs = d["events"]
        doc = replay(evs)
        if doc.text != d["truth_text"] or not verify_chain(evs).ok:
            raise RuntimeError(f"{demo_id}: record does not replay to the text")
        a = analyse(evs)
        (out / f"{demo_id}.events.json").write_text(json.dumps([e.to_dict() for e in evs], ensure_ascii=False, separators=(",", ":")))
        truth = d["truth"]
        manifest.append({
            "id": demo_id,
            "title": TITLES.get(item["id"]) or title_from(item["text"]),
            "kind": KIND[scenario],
            "blurb": blurb(scenario, truth, a),
            "description": blurb(scenario, truth, a),
            "source": item["source"],
            "source_id": item["id"],
            "source_url": item["url"],
            "licence": item["licence"],
            "words": a["document"]["final_words"],
            "sessions": truth["sessions"],
            "first_event": evs[0].ts,
            "last_event": evs[-1].ts,
            "truth": {
                "typed_share": truth["typed_share"],
                "pasted_chars": truth["pasted_chars"],
                "paste_sources": [{"host": s["host"], "kind": s["kind"], "chars": s["chars"]} for s in truth["paste_sources"]],
                "scripted": scenario == "ai_autotyped",
            },
            "expect": {
                "typed_share": a["document"]["typed_share"],
                "pasted_chars": a["pastes"]["pasted_chars"],
                "pasted_chars_surviving": a["pastes"]["pasted_chars_surviving"],
                "ai_pastes": a["pastes"]["ai_pastes"],
                "by_source_kind": a["pastes"]["by_source_kind"],
                "regularity_flagged": a["regularity"]["flagged"],
                "regularity_signals": [s["signal"] for s in a["regularity"]["signals"]],
                "line_labels": a["line_labels"],
                "sessions": len(a["sessions"]),
                "active_minutes": a["cadence"]["active_minutes"],
                "events": len(evs),
            },
        })
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    return manifest


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="write demo records for the web app")
    ap.add_argument("--out", default="web/public/demo")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--now", help="ISO timestamp to treat as now (default: current time)")
    a = ap.parse_args(argv)
    now = parse_ts(a.now) if a.now else None
    m = build(Path(a.out), seed=a.seed, now=now)
    for e in m:
        print(f"{e['id']:<22} {e['kind']:<13} {e['words']:>4} words  {e['sessions']} session(s)  typed {e['truth']['typed_share']:.3f} -> {e['expect']['typed_share']:.3f}"
              f"  flagged {e['expect']['regularity_flagged']}  {e['title']!r}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
