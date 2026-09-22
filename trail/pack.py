"""Evidence pack, AI-use declaration, drafts and patterns.

`build_pack` is deterministic over (events, checkpoints): the same record
produces the same JSON and the same HTML, and the pack carries the hash of
its inputs so a reader can regenerate it from the record and compare.
"""

from __future__ import annotations

import html
from typing import Any, Iterable

from trail.analysis import analyse
from trail.core.canonical import hash_value
from trail.core.timeutil import ms, parse_ts
from trail.document import Document, replay
from trail.events import AI_HOSTS_VERSION, Event

PACK_VERSION = 1


# -- drafts --------------------------------------------------------------------

def drafts(events: list[Event], points: Iterable[float] = (0.25, 0.5, 0.75, 1.0)) -> list[dict[str, Any]]:
    """Reconstruct the document at fractions of the way through the record."""
    evs = sorted(events, key=lambda e: (e.ts, e.seq))
    edits = [i for i, e in enumerate(evs) if e.kind in ("insert", "delete", "paste", "resync")]
    out = []
    if not edits:
        return out
    for f in points:
        cut = edits[min(len(edits) - 1, int(round(f * (len(edits) - 1))))]
        doc = Document()
        for e in evs[: cut + 1]:
            doc.apply(e)
        out.append({"fraction": f, "ts": evs[cut].ts, "chars": len(doc.chars), "words": len(doc.text.split()),
                    "text": doc.text, "text_hash": doc.text_hash()})
    return out


# -- declaration -----------------------------------------------------------------

def declaration(a: dict[str, Any], *, student: str | None = None, course: str | None = None) -> str:
    p = a["pastes"]
    ai_items = [i for i in p["items"] if i["source_kind"] == "ai"]
    final = a["document"]["final_chars"] or 1
    lines = ["# AI use declaration", ""]
    if student:
        lines.append(f"**Student:** {student}  ")
    if course:
        lines.append(f"**Course / assignment:** {course}  ")
    lines.append(f"**Document record:** {a['document']['doc']}  ")
    lines.append(f"**Written between:** {a['first_event'][:10]} and {a['last_event'][:10]}, {sum(s['active_minutes'] for s in a['sessions']):.0f} active minutes over {len(a['sessions'])} sessions  ")
    lines.append("")
    if not ai_items and not a["ai_notes"]:
        lines.append("No text in this document was pasted from an AI assistant, and I declare no other AI assistance.")
    else:
        if ai_items:
            alive = sum(i["surviving_chars"] for i in ai_items)
            hosts = sorted({i["source_host"] for i in ai_items if i["source_host"]})
            lines.append(f"I pasted text from {', '.join(hosts) or 'an AI assistant'} on {len(ai_items)} occasion(s). "
                         f"{alive:,} characters of that text remain in the final document ({alive / final:.1%} of it). "
                         + ("Some of that text was edited after pasting." if any(0 < i['surviving_ratio'] < 1 for i in ai_items) else ""))
        for n in a["ai_notes"]:
            lines.append(f"- {n.get('tool')}: {n.get('note')}")
        lines.append("")
        lines.append("Everything else in the document was typed by me.")
    lines += ["", f"This declaration was generated from my writing record (analysis v{a['version']}, AI host list v{AI_HOSTS_VERSION}); the record can be verified with the included script.", ""]
    return "\n".join(lines)


# -- patterns --------------------------------------------------------------------

def patterns(analyses: list[dict[str, Any]]) -> dict[str, Any]:
    """What the student's own writing looks like across documents."""
    hours = [0] * 24
    session_minutes: list[float] = []
    wpm: list[float] = []
    corr: list[float] = []
    typed_share: list[float] = []
    for a in analyses:
        for s in a["sessions"]:
            h = parse_ts(s["start"]).hour
            hours[h] += s["active_minutes"]
            session_minutes.append(s["active_minutes"])
        if a["cadence"]["words_per_minute"]:
            wpm.append(a["cadence"]["words_per_minute"])
        if a["cadence"]["correction_ratio"] is not None:
            corr.append(a["cadence"]["correction_ratio"])
        if a["document"]["typed_share"] is not None:
            typed_share.append(a["document"]["typed_share"])
    session_minutes.sort()
    med = session_minutes[len(session_minutes) // 2] if session_minutes else None
    return {
        "documents": len(analyses),
        "sessions": len(session_minutes),
        "best_hours": sorted(range(24), key=lambda h: -hours[h])[:3] if any(hours) else [],
        "active_minutes_by_hour": hours,
        "median_session_minutes": med,
        "words_per_minute": round(sum(wpm) / len(wpm), 1) if wpm else None,
        "correction_ratio": round(sum(corr) / len(corr), 3) if corr else None,
        "typed_share": round(sum(typed_share) / len(typed_share), 3) if typed_share else None,
        "total_words": sum(a["document"]["final_words"] for a in analyses),
    }


# -- pack ------------------------------------------------------------------------

def build_pack(events: Iterable[Event], *, checkpoints: list[dict[str, Any]] | None = None,
               student: str | None = None, course: str | None = None, title: str | None = None) -> dict[str, Any]:
    evs = sorted(events, key=lambda e: (e.ts, e.seq))
    a = analyse(evs)
    cps = sorted(checkpoints or [], key=lambda c: c["body"]["seq"])
    d = drafts(evs)
    inputs = {"events": [e.hash for e in evs], "checkpoints": [c.get("hash") for c in cps], "pack": PACK_VERSION}
    return {
        "v": PACK_VERSION,
        "title": title,
        "student": student,
        "course": course,
        "input_hash": hash_value(inputs),
        "analysis": a,
        "declaration": declaration(a, student=student, course=course),
        "drafts": [{k: v for k, v in x.items() if k != "text"} | {"excerpt": x["text"][:600]} for x in d],
        "checkpoints": [{"seq": c["body"]["seq"], "ts": c["body"]["ts"], "hash": c.get("hash"), "key_id": c.get("key_id"),
                         "heads": c["body"].get("heads", {})} for c in cps],
    }


def _pct(x: float | None) -> str:
    return "n/a" if x is None else f"{x * 100:.1f}%"


def render_html(pack: dict[str, Any]) -> str:
    a = pack["analysis"]
    esc = html.escape
    doc = a["document"]
    cad = a["cadence"]
    p = a["pastes"]
    reg = a["regularity"]
    tl = a["timeline"]
    mx = max([b["typed"] + b["pasted"] for b in tl] + [1])
    bars = "".join(
        f'<g transform="translate({12 + i * 9},0)"><rect y="{100 - 100 * b["typed"] / mx:.1f}" width="6" height="{100 * b["typed"] / mx:.1f}" fill="var(--typed)"/>'
        f'<rect y="{100 - 100 * (b["typed"] + b["pasted"]) / mx:.1f}" width="6" height="{100 * b["pasted"] / mx:.1f}" fill="var(--pasted)"/></g>'
        for i, b in enumerate(tl[:120])
    )
    labels = a["line_labels"]
    total_lines = max(1, doc["final_lines"])
    strip = "".join(
        f'<span class="seg {esc(k)}" style="width:{100 * n / total_lines:.2f}%" title="{esc(k)}: {n} lines"></span>'
        for k, n in labels.items()
    )
    paste_rows = "".join(
        f"<tr><td>{esc(i['ts'][:16].replace('T', ' '))}</td><td>{i['chars']:,}</td><td>{esc(i['source_kind'])}</td>"
        f"<td>{esc(i['source_host'] or ('this document' if i['from_self'] else 'unknown'))}</td><td>{_pct(i['surviving_ratio'])}</td></tr>"
        for i in p["items"][:40]
    ) or "<tr><td colspan=5>No pastes recorded.</td></tr>"
    sess_rows = "".join(
        f"<tr><td>{esc(s['start'][:16].replace('T', ' '))}</td><td>{esc(str(s['editor']))}</td><td>{s['active_minutes']}</td>"
        f"<td>{s['typed_chars']:,}</td><td>{s['pasted_chars']:,}</td><td>{s['deleted_chars']:,}</td></tr>"
        for s in a["sessions"]
    )
    sig_rows = "".join(f"<li><strong>{esc(s['signal'])}</strong> ({s['value']} vs threshold {s['threshold']}): {esc(s['meaning'])}</li>" for s in reg["signals"])
    if reg["flagged"]:
        reg_text = "The typing rhythm in this record is consistent with scripted input. The signals are listed below; a reader should weigh them with the rest of the record."
    elif reg["signals"]:
        reg_text = "One observation about typing rhythm is listed below. On its own it is not evidence of scripted input."
    else:
        reg_text = f"Typing rhythm looks like a person: median {cad['inter_key_median_ms']} ms between keys, spread {reg['inter_key_spread']}, {cad['pauses']} pauses over two seconds, {_pct(cad['correction_ratio'])} of typed characters later deleted."
    draft_blocks = "".join(
        f"<div class='draft'><div class='k'>{int(d['fraction'] * 100)}% through · {esc(d['ts'][:16].replace('T', ' '))} · {d['words']:,} words</div><pre>{esc(d['excerpt'])}{'…' if d['chars'] > 600 else ''}</pre></div>"
        for d in pack["drafts"]
    )
    src_rows = "".join(f"<tr><td>{esc(s['host'])}</td><td>{s['dwell_minutes']}</td></tr>" for s in a["sources"]) or "<tr><td colspan=2>None recorded.</td></tr>"
    cps = pack["checkpoints"]
    cp_text = (f"{len(cps)} signed checkpoints, first {esc(cps[0]['ts'][:16].replace('T', ' '))}, last {esc(cps[-1]['ts'][:16].replace('T', ' '))}, key <code>{esc(str(cps[-1]['key_id']))}</code>."
               if cps else "No signed checkpoints are included with this record.")
    unobs = f"<p class='warn'>{doc['unobserved_chars']:,} characters appeared while the recorder was not watching ({doc['resyncs']} resync events). They are shown as unobserved and make no claim either way.</p>" if doc["unobserved_chars"] else ""
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>Writing record: {esc(pack.get('title') or doc['doc'][:8])}</title>
<style>
:root{{--ink:#141a21;--muted:#66717e;--rule:#dfe4ea;--typed:#2b7a4b;--pasted:#c9541c;--mixed:#b58a1b;--unobserved:#8a94a0;--bg:#fff}}
@page{{size:A4;margin:16mm}} body{{font:11pt/1.45 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg);margin:0;padding:28px;max-width:860px}}
h1{{font-size:21pt;margin:0 0 2px}} h2{{font-size:12.5pt;margin:22px 0 6px;border-bottom:1px solid var(--rule);padding-bottom:3px}} .sub{{color:var(--muted);margin-bottom:14px}}
.tiles{{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}} .tile{{border:1px solid var(--rule);border-radius:6px;padding:9px 11px}} .tile .k{{font-size:8.5pt;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}} .tile .v{{font-size:19pt;font-weight:600}} .tile .d{{font-size:8.5pt;color:var(--muted)}}
table{{border-collapse:collapse;width:100%;font-size:9.5pt}} th,td{{text-align:left;padding:4px 6px;border-bottom:1px solid var(--rule);vertical-align:top}} th{{color:var(--muted);font-weight:500}}
code{{font:9pt ui-monospace,Menlo,monospace;background:#f3f4f6;padding:0 3px;border-radius:3px}} .strip{{display:flex;height:14px;border-radius:3px;overflow:hidden;border:1px solid var(--rule)}} .seg.typed{{background:var(--typed)}} .seg.pasted{{background:var(--pasted)}} .seg.pasted-edited{{background:#e58a5a}} .seg.mixed{{background:var(--mixed)}} .seg.unobserved{{background:var(--unobserved)}}
.legend{{font-size:9pt;color:var(--muted);margin-top:4px}} .legend i{{display:inline-block;width:9px;height:9px;border-radius:2px;margin:0 3px 0 10px;vertical-align:middle}}
.draft{{border:1px solid var(--rule);border-radius:6px;padding:8px 10px;margin:8px 0}} .draft .k{{font-size:8.5pt;color:var(--muted)}} pre{{white-space:pre-wrap;font:9pt/1.4 ui-monospace,Menlo,monospace;margin:4px 0 0;max-height:120px;overflow:hidden}}
.warn{{background:#fff6ea;border:1px solid #f1d7ad;border-radius:6px;padding:8px 10px;font-size:10pt}} .foot{{margin-top:24px;padding-top:8px;border-top:1px solid var(--rule);font-size:8.5pt;color:var(--muted);overflow-wrap:anywhere}}
.two{{display:grid;grid-template-columns:1fr 1fr;gap:22px}} svg{{width:100%;height:auto;display:block}}
</style></head><body>
<h1>Writing record</h1>
<div class="sub">{esc(pack.get('title') or 'Untitled document')}{(' · ' + esc(pack['student'])) if pack.get('student') else ''}{(' · ' + esc(pack['course'])) if pack.get('course') else ''} · written {esc(a['first_event'][:10])} to {esc(a['last_event'][:10])} · record <code>{esc(doc['doc'][:8])}</code></div>
<div class="tiles">
 <div class="tile"><div class="k">Final length</div><div class="v">{doc['final_words']:,}</div><div class="d">words, {doc['final_lines']} lines</div></div>
 <div class="tile"><div class="k">Typed</div><div class="v">{_pct(doc['typed_share'])}</div><div class="d">of the final text was typed</div></div>
 <div class="tile"><div class="k">Pasted</div><div class="v">{_pct(p['share_of_final_document'])}</div><div class="d">{p['count']} pastes, {p['ai_pastes']} from AI tools</div></div>
 <div class="tile"><div class="k">Active time</div><div class="v">{cad['active_minutes']:.0f}</div><div class="d">minutes over {len(a['sessions'])} sessions</div></div>
 <div class="tile"><div class="k">Deleted</div><div class="v">{cad['deleted_chars']:,}</div><div class="d">characters removed while writing</div></div>
</div>
{unobs}
<h2>How the document grew</h2>
<svg viewBox="0 0 {max(200, 24 + 9 * min(120, len(tl)))} 112" role="img" aria-label="Characters added per ten minutes">{bars}<line x1="8" y1="100.5" x2="{max(200, 24 + 9 * min(120, len(tl)))}" y2="100.5" stroke="#dfe4ea"/></svg>
<div class="legend">each bar is ten minutes<i style="background:var(--typed)"></i>typed<i style="background:var(--pasted)"></i>pasted</div>
<h2>Where each line came from</h2>
<div class="strip">{strip}</div>
<div class="legend">{", ".join(f"{k}: {n}" for k, n in labels.items())}<i style="background:var(--typed)"></i>typed<i style="background:var(--pasted)"></i>pasted<i style="background:#e58a5a"></i>pasted then edited<i style="background:var(--mixed)"></i>mixed<i style="background:var(--unobserved)"></i>unobserved</div>
<div class="two"><div>
<h2>Pastes</h2>
<table><tr><th>When (UTC)</th><th>Chars</th><th>Source</th><th>From</th><th>Still in text</th></tr>{paste_rows}</table>
</div><div>
<h2>Sessions</h2>
<table><tr><th>Start (UTC)</th><th>Editor</th><th>Active min</th><th>Typed</th><th>Pasted</th><th>Deleted</th></tr>{sess_rows}</table>
<h2>Sources open while writing</h2>
<table><tr><th>Site</th><th>Minutes</th></tr>{src_rows}</table>
</div></div>
<h2>Typing rhythm</h2>
<p>{reg_text}</p>{f"<ul>{sig_rows}</ul>" if sig_rows else ""}
<h2>Drafts</h2>
{draft_blocks}
<h2>Declaration</h2>
<pre style="max-height:none;font-family:inherit;font-size:10.5pt">{esc(pack['declaration'])}</pre>
<h2>Verification</h2>
<p>{cp_text} Final text hash <code>{esc(doc['text_hash'][:24])}…</code>. {doc['snapshot_checks']} snapshot hashes checked, {doc['snapshot_mismatches']} mismatches. Run <code>python verify.py</code> inside the record folder to check every hash, chain link and signature.</p>
<div class="foot">Pack v{pack['v']} · analysis v{a['version']} · input hash {esc(pack['input_hash'])}. This record shows how the document was produced and that the record was not altered after each signed checkpoint. It does not judge the content and does not claim to detect text that was retyped by hand.</div>
</body></html>"""
