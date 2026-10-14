"""Behavioural analysis of a writing record.

Everything here is a pure function of the events. The outputs are *signals*
for a human reader, never verdicts: the evidence pack shows what the record
contains and lets a tutor or panel draw the conclusion.

    cadence        inter-keystroke timing, corrections, bursts and pauses
    pastes         every paste, its source class, how much of it survived,
                   and whether it was edited afterwards
    regularity     signals that the typing was produced by a script rather
                   than a person (too regular, no corrections, no pauses)
    timeline       activity per bucket over the life of the document
    ai_presence    which AI sites were in front while the document was open,
                   how often the writer came back from one, and what was typed
                   right after. Facts about tabs and timing only; no verdict.
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from typing import Any, Iterable

from trail.core.timeutil import ms
from trail.document import Document, replay
from trail.events import Event, classify_source

ANALYSIS_VERSION = "1.1"
PAUSE_MS = 2000          # a gap longer than this between keystrokes is a pause
IDLE_MS = 120_000        # a gap longer than this ends an active stretch
BUCKET_MS = 10 * 60_000  # timeline resolution
SWITCH_WINDOW_MS = 60_000  # typing this soon after returning from an AI tab is counted as "after a switch"


def _intervals(events: list[Event]) -> list[int]:
    """All inter-keystroke intervals (ms): within batches, and the gap from the
    end of one batch to the start of the next (that is where thinking pauses live)."""
    out: list[int] = []
    prev_end: int | None = None
    for ev in sorted(events, key=lambda e: (e.ts, e.seq)):
        if ev.kind not in ("insert", "delete"):
            continue
        dts = [int(x) for x in (ev.data.get("dts") or [])]
        start = ms(ev.ts) + (dts[0] if dts else 0)
        if prev_end is not None:
            out.append(max(0, start - prev_end))
        out.extend(dts[1:])  # dts[0] is the offset of the first key from the batch ts
        prev_end = start + sum(dts[1:])
    return out


def cadence(events: list[Event]) -> dict[str, Any]:
    iv = _intervals(events)
    typed = sum(len(e.data["text"]) for e in events if e.kind == "insert")
    deleted = sum(int(e.data["len"]) for e in events if e.kind == "delete")
    active_ms = active_time_ms(events)
    inter = [x for x in iv if 0 < x < PAUSE_MS]
    pauses = [x for x in iv if x >= PAUSE_MS]
    wpm = (typed / 5) / (active_ms / 60_000) if active_ms > 0 else None
    return {
        "typed_chars": typed,
        "deleted_chars": deleted,
        "correction_ratio": round(deleted / typed, 4) if typed else None,
        "active_minutes": round(active_ms / 60_000, 1),
        "words_per_minute": round(wpm, 1) if wpm is not None else None,
        "inter_key_median_ms": int(statistics.median(inter)) if inter else None,
        "inter_key_cv": round(statistics.pstdev(inter) / statistics.mean(inter), 3) if len(inter) > 1 and statistics.mean(inter) > 0 else None,
        "pauses": len(pauses),
        "longest_pause_s": round(max(pauses) / 1000, 1) if pauses else 0,
        "keystrokes": len(iv) + sum(1 for e in events if e.kind in ("insert", "delete")),
    }


def active_time_ms(events: list[Event]) -> int:
    """Time spent with an edit at least every IDLE_MS."""
    stamps = sorted(ms(e.ts) for e in events if e.kind in ("insert", "delete", "paste"))
    if not stamps:
        return 0
    total = 0
    start = prev = stamps[0]
    for t in stamps[1:]:
        if t - prev > IDLE_MS:
            total += prev - start + 1000
            start = t
        prev = t
    total += prev - start + 1000
    return total


def paste_report(doc: Document, events: list[Event]) -> dict[str, Any]:
    surviving = doc.surviving_by_paste()
    items = []
    for pid, p in doc.pastes.items():
        alive = surviving.get(pid, 0)
        items.append({
            "paste_id": pid, "ts": p.ts, "chars": p.length, "source_host": p.source_host,
            "source_kind": p.source_kind, "from_self": p.from_self,
            "surviving_chars": alive, "surviving_ratio": round(alive / p.length, 3) if p.length else 0.0,
            "text_hash": p.text_hash,
        })
    items.sort(key=lambda i: i["ts"])
    by_kind: dict[str, int] = {}
    for i in items:
        by_kind[i["source_kind"]] = by_kind.get(i["source_kind"], 0) + i["chars"]
    total_pasted = sum(i["chars"] for i in items)
    final = len(doc.chars)
    pasted_alive = sum(surviving.values())
    return {
        "count": len(items),
        "pasted_chars": total_pasted,
        "pasted_chars_surviving": pasted_alive,
        "share_of_final_document": round(pasted_alive / final, 4) if final else 0.0,
        "by_source_kind": dict(sorted(by_kind.items())),
        "ai_pastes": sum(1 for i in items if i["source_kind"] == "ai"),
        "ai_chars_surviving": sum(i["surviving_chars"] for i in items if i["source_kind"] == "ai"),
        "items": items,
    }


def regularity(events: list[Event]) -> dict[str, Any]:
    """Signals that typing may have been scripted. Each signal is reported with the
    measurement that triggered it; thresholds are public constants."""
    iv = [x for x in _intervals(events) if x > 0]
    inter = [x for x in iv if x < PAUSE_MS]
    typed = sum(len(e.data["text"]) for e in events if e.kind == "insert")
    deleted = sum(int(e.data["len"]) for e in events if e.kind == "delete")
    signals: list[dict[str, Any]] = []
    cv = None
    spread = None
    if len(inter) >= 200:
        cv = statistics.pstdev(inter) / statistics.mean(inter)
        q = statistics.quantiles(inter, n=4)
        med = statistics.median(inter)
        # Interquartile range over the median: robust to pauses and outliers.
        # Human typing sits around 0.6 to 1.0; scripts with jitter sit under 0.15.
        spread = (q[2] - q[0]) / med if med > 0 else 0.0
        if spread < 0.35:
            signals.append({"signal": "uniform_rhythm", "value": round(spread, 3), "threshold": 0.35,
                            "meaning": "keystroke intervals vary far less than human typing (IQR / median)"})
    if typed >= 500 and deleted / typed < 0.005:
        signals.append({"signal": "no_corrections", "value": round(deleted / typed, 4), "threshold": 0.005,
                        "meaning": "almost no deletions across a long stretch of typing"})
    pauses = [x for x in iv if x >= PAUSE_MS]
    if typed >= 1500 and not pauses:
        signals.append({"signal": "no_pauses", "value": 0, "threshold": 1,
                        "meaning": "no pause over two seconds while typing more than 1,500 characters"})
    # Long runs of identical intervals (to the millisecond) are a scripting artefact.
    if len(inter) >= 200:
        longest = run = 1
        for a, b in zip(inter, inter[1:]):
            run = run + 1 if abs(a - b) <= 2 else 1
            longest = max(longest, run)
        if longest >= 40:
            signals.append({"signal": "identical_intervals", "value": longest, "threshold": 40,
                            "meaning": "a run of keystrokes with near-identical spacing"})
    score = min(1.0, len(signals) / 3)
    # A uniform rhythm on its own, or any two signals, is reported as "consistent
    # with scripted typing"; a single other signal is shown as an observation only.
    flagged = any(sg["signal"] == "uniform_rhythm" for sg in signals) or len(signals) >= 2
    return {"score": round(score, 2), "flagged": flagged, "signals": signals,
            "inter_key_cv": round(cv, 3) if cv is not None else None,
            "inter_key_spread": round(spread, 3) if spread is not None else None,
            "keystrokes_analysed": len(inter)}


def timeline(events: list[Event]) -> list[dict[str, Any]]:
    if not events:
        return []
    t0 = min(ms(e.ts) for e in events)
    buckets: dict[int, dict[str, int]] = {}
    for e in events:
        if e.kind not in ("insert", "delete", "paste"):
            continue
        b = (ms(e.ts) - t0) // BUCKET_MS
        row = buckets.setdefault(b, {"typed": 0, "deleted": 0, "pasted": 0})
        if e.kind == "insert":
            row["typed"] += len(e.data["text"])
        elif e.kind == "delete":
            row["deleted"] += int(e.data["len"])
        else:
            row["pasted"] += len(e.data["text"])
    return [{"bucket": b, "minute": b * BUCKET_MS // 60_000, **row} for b, row in sorted(buckets.items())]


def sources(events: list[Event]) -> list[dict[str, Any]]:
    agg: dict[str, int] = {}
    for e in events:
        if e.kind == "source.visit":
            h = str(e.data.get("host"))
            agg[h] = agg.get(h, 0) + int(e.data.get("dwell_ms") or 0)
    return [{"host": h, "dwell_minutes": round(d / 60_000, 1)} for h, d in sorted(agg.items(), key=lambda x: -x[1])]


def sessions_summary(events: list[Event]) -> list[dict[str, Any]]:
    by: dict[str, list[Event]] = {}
    for e in events:
        by.setdefault(e.session, []).append(e)
    out = []
    for sid, evs in by.items():
        evs.sort(key=lambda e: e.seq)
        start = next((e for e in evs if e.kind == "session.start"), evs[0])
        out.append({
            "session": sid, "start": evs[0].ts, "end": evs[-1].ts,
            "editor": start.data.get("editor"), "host": start.data.get("host"),
            "active_minutes": round(active_time_ms(evs) / 60_000, 1),
            "typed_chars": sum(len(e.data["text"]) for e in evs if e.kind == "insert"),
            "pasted_chars": sum(len(e.data["text"]) for e in evs if e.kind == "paste"),
            "deleted_chars": sum(int(e.data["len"]) for e in evs if e.kind == "delete"),
            "events": len(evs),
        })
    out.sort(key=lambda s: s["start"])
    return out


# ---- AI sites in front -------------------------------------------------------------------------
# The extension records `source.visit {host, dwell_ms, ai?}` when a tab leaves the front of a focused
# window while a session is open, and `focus {state: "focus", from_host, from_ai}` when the editor tab
# comes back in front. Older records carry no `ai` flag, so the host list decides for them.

def _is_ai_visit(e: Event) -> bool:
    return e.kind == "source.visit" and (bool(e.data.get("ai")) or classify_source(str(e.data.get("host") or "")) == "ai")


def _is_ai_switch(e: Event) -> bool:
    return e.kind == "focus" and bool(e.data.get("from_ai"))


def _is_ai_paste(e: Event) -> bool:
    if e.kind != "paste":
        return False
    kind = e.data.get("source_kind") or classify_source(e.data.get("source_host"), bool(e.data.get("from_self")))
    return str(kind) == "ai"


def _burst_starts(events: list[Event]) -> list[int]:
    """Start (ms) of each run of keystroke batches with no pause of PAUSE_MS or more between them."""
    starts: list[int] = []
    prev_end: int | None = None
    for e in events:
        if e.kind not in ("insert", "delete"):
            continue
        dts = [int(x) for x in (e.data.get("dts") or [])]
        start = ms(e.ts)
        end = start + sum(dts[1:])
        if prev_end is None or start - prev_end >= PAUSE_MS:
            starts.append(start)
        prev_end = max(end, prev_end if prev_end is not None else end)
    return starts


def _ai_presence_for(evs: list[Event]) -> dict[str, Any]:
    """The ai_presence facts over one list of events (already sorted by ts, seq)."""
    hosts_ms: dict[str, int] = {}
    switches: list[int] = []
    for e in evs:
        if _is_ai_visit(e):
            h = str(e.data.get("host"))
            hosts_ms[h] = hosts_ms.get(h, 0) + int(e.data.get("dwell_ms") or 0)
        elif _is_ai_switch(e):
            switches.append(ms(e.ts))

    def after_switch(t: int) -> bool:
        return any(s <= t <= s + SWITCH_WINDOW_MS for s in switches)

    typed = deleted = typed_w = deleted_w = 0
    for e in evs:
        if e.kind == "insert":
            n = len(e.data["text"])
            typed += n
            if after_switch(ms(e.ts)):
                typed_w += n
        elif e.kind == "delete":
            n = int(e.data["len"])
            deleted += n
            if after_switch(ms(e.ts)):
                deleted_w += n
    total_ms = sum(hosts_ms.values())
    return {
        "ai_minutes": round(total_ms / 60_000, 1),
        "ai_hosts": [{"host": h, "minutes": round(d / 60_000, 1)} for h, d in sorted(hosts_ms.items(), key=lambda x: (-x[1], x[0]))],
        "switches": len(switches),
        "typed_after_switch_chars": typed_w,
        "bursts_after_switch": sum(1 for s in _burst_starts(evs) if after_switch(s)),
        "correction_ratio_after_switch": round(deleted_w / typed_w, 4) if typed_w else None,
        "correction_ratio_overall": round(deleted / typed, 4) if typed else None,
        "ai_copy_paste_matches": sum(1 for e in evs if _is_ai_paste(e)),
    }


def ai_presence(events: list[Event]) -> dict[str, Any]:
    """AI sites that were in front while the document was open, per document and per session.
    Every number is an observation about tabs and timing on the writer's computer: nothing here
    says what was on the screen, and nothing here is a judgement."""
    evs = sorted(events, key=lambda e: (e.ts, e.seq))
    out = _ai_presence_for(evs)
    by: dict[str, list[Event]] = {}
    for e in evs:
        by.setdefault(e.session, []).append(e)
    per = []
    for sid, sevs in by.items():
        sevs.sort(key=lambda e: e.seq)
        row = {"session": sid, "start": sevs[0].ts}
        row.update(_ai_presence_for(sorted(sevs, key=lambda e: (e.ts, e.seq))))
        per.append(row)
    per.sort(key=lambda s: s["start"])
    out["sessions_with_ai"] = sum(1 for s in per if s["ai_hosts"] or s["switches"])
    out["sessions_total"] = len(per)
    out["by_session"] = per
    return out


def analyse(events: Iterable[Event]) -> dict[str, Any]:
    evs = sorted(events, key=lambda e: (e.ts, e.seq))
    doc = replay(evs)
    lines = doc.lines()
    label_counts: dict[str, int] = {}
    for ln in lines:
        label_counts[ln.label] = label_counts.get(ln.label, 0) + 1
    final_chars = len(doc.chars)
    typed_alive = sum(1 for o in doc.origin if o == "typed")
    return {
        "version": ANALYSIS_VERSION,
        "document": {
            "doc": evs[0].doc if evs else None,
            "final_chars": final_chars,
            "final_words": len(doc.text.split()),
            "final_lines": len(lines),
            "text_hash": doc.text_hash(),
            "typed_chars_surviving": typed_alive,
            "typed_share": round(typed_alive / final_chars, 4) if final_chars else None,
            "unobserved_chars": doc.unobserved_chars,
            "snapshot_checks": doc.snapshot_checks,
            "snapshot_mismatches": doc.snapshot_mismatches,
            "resyncs": doc.resyncs,
        },
        "line_labels": dict(sorted(label_counts.items())),
        "cadence": cadence(evs),
        "pastes": paste_report(doc, evs),
        "regularity": regularity(evs),
        "timeline": timeline(evs),
        "sources": sources(evs),
        "sessions": sessions_summary(evs),
        "ai_presence": ai_presence(evs),
        "ai_notes": [{"ts": e.ts, **e.data} for e in evs if e.kind == "ai.note"],
        "first_event": evs[0].ts if evs else None,
        "last_event": evs[-1].ts if evs else None,
    }
