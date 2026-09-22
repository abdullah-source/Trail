"""Backtest: generate a mixed corpus of typed and pasted writing with ground
truth, run it through the recorder pipeline, and measure.

    trail backtest --lines 10000 --out backtest-out

Checks:
    1. Reconstruction: replaying events reproduces the final text exactly.
    2. Snapshots: every snapshot hash matches the reconstructed document.
    3. Chain: every session verifies; a single edited event is detected.
    4. Line provenance: label per line vs ground truth (accuracy, confusion).
    5. Character provenance: origin per character vs ground truth.
    6. Paste accounting: pasted chars and surviving chars match truth.
    7. Scripted typing: auto-typers flagged, humans not (TPR / FPR).
    8. Performance: events per second for hashing, replay, analysis.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from trail.analysis import analyse
from trail.chain import verify_chain
from trail.document import replay
from trail.events import Event
from trail.synthetic import PROFILES, make_corpus

LABELS = ["typed", "pasted", "pasted-edited", "mixed", "unobserved"]


def run(target_lines: int = 10_000, seed: int = 42) -> dict[str, Any]:
    t0 = time.perf_counter()
    docs = make_corpus(target_lines=target_lines, seed=seed)
    gen_s = time.perf_counter() - t0

    total_events = sum(len(d["events"]) for d in docs)
    total_lines = sum(len(d["truth_lines"]) for d in docs)
    typed_lines = sum(1 for d in docs for l in d["truth_lines"] if l["label"] == "typed")
    pasted_lines = sum(1 for d in docs for l in d["truth_lines"] if l["label"] in ("pasted", "pasted-edited"))

    # 3. chain verification + tamper detection
    t0 = time.perf_counter()
    chain_ok = 0
    for d in docs:
        if verify_chain(d["events"]).ok:
            chain_ok += 1
    verify_s = time.perf_counter() - t0
    tamper_detected = 0
    for d in docs[:50]:
        evs = d["events"]
        k = len(evs) // 2
        bad = evs[k].to_dict()
        bad["data"] = dict(bad["data"])
        if bad["kind"] == "insert":
            bad["data"]["text"] = bad["data"]["text"][:-1] + "x"
        else:
            bad["data"]["tampered"] = True
        tampered = evs[:k] + [Event.from_dict(bad)] + evs[k + 1:]
        if not verify_chain(tampered).ok:
            tamper_detected += 1
    # a tampered event with its hash recomputed still breaks the next link
    relinked = 0
    for d in docs[:50]:
        evs = d["events"]
        k = len(evs) // 2
        bad = evs[k].to_dict()
        bad["data"] = {**bad["data"], "tampered": True}
        from trail.events import compute_hash
        body = {x: bad[x] for x in bad if x != "hash"}
        bad["hash"] = compute_hash(body)
        tampered = evs[:k] + [Event.from_dict(bad)] + evs[k + 1:]
        if not verify_chain(tampered).ok:
            relinked += 1

    # 1, 2, 4, 5, 6: reconstruction and provenance
    t0 = time.perf_counter()
    exact = 0
    snap_checks = snap_mism = 0
    confusion = {a: {b: 0 for b in LABELS} for a in LABELS}
    line_correct = line_total = 0
    char_correct = char_total = 0
    paste_ok = 0
    per_profile: dict[str, dict[str, Any]] = {p: {"docs": 0, "lines": 0, "line_acc_num": 0, "flagged": 0} for p in PROFILES}
    regularity_scores: dict[str, list[float]] = {p: [] for p in PROFILES}
    analysis_s = 0.0
    for d in docs:
        doc = replay(d["events"])
        if doc.text == d["truth_text"]:
            exact += 1
        snap_checks += doc.snapshot_checks
        snap_mism += doc.snapshot_mismatches
        lines = doc.lines()
        truth = d["truth_lines"]
        n = min(len(lines), len(truth))
        pp = per_profile[d["profile"]]
        pp["docs"] += 1
        for a, b in zip(lines[:n], truth[:n]):
            confusion[b["label"]][a.label] += 1
            line_total += 1
            pp["lines"] += 1
            if a.label == b["label"]:
                line_correct += 1
                pp["line_acc_num"] += 1
        line_total += abs(len(lines) - len(truth))  # count length mismatch as errors
        to = d["truth_origin"]
        for o_a, o_b in zip(doc.origin, to):
            char_total += 1
            ka = "paste" if o_a.startswith("paste:") else o_a
            kb = "paste" if o_b.startswith("paste:") else o_b
            if ka == kb:
                char_correct += 1
        char_total += abs(len(doc.origin) - len(to))
        truth_pasted_alive = sum(1 for o in to if o.startswith("paste:"))
        if sum(doc.surviving_by_paste().values()) == truth_pasted_alive and d["stats"]["pasted"] == sum(p.length for p in doc.pastes.values()):
            paste_ok += 1
        ta = time.perf_counter()
        a = analyse(d["events"])
        analysis_s += time.perf_counter() - ta
        regularity_scores[d["profile"]].append(a["regularity"]["score"])
        if a["regularity"]["flagged"]:
            pp["flagged"] += 1
        if a["regularity"]["signals"]:
            pp["any_signal"] = pp.get("any_signal", 0) + 1
    replay_s = time.perf_counter() - t0 - analysis_s

    bots = [d for d in docs if d["profile"] in ("autotyper", "jittered_bot")]
    humans = [d for d in docs if d["profile"] not in ("autotyper", "jittered_bot")]
    bot_flagged = sum(per_profile[p]["flagged"] for p in ("autotyper", "jittered_bot"))
    human_flagged = sum(per_profile[p]["flagged"] for p in per_profile if p not in ("autotyper", "jittered_bot"))

    report = {
        "corpus": {
            "documents": len(docs), "events": total_events, "final_lines": total_lines,
            "typed_lines": typed_lines, "pasted_lines": pasted_lines,
            "other_lines": total_lines - typed_lines - pasted_lines,
            "typed_chars": sum(d["stats"]["typed"] for d in docs),
            "pasted_chars": sum(d["stats"]["pasted"] for d in docs),
            "deleted_chars": sum(d["stats"]["deleted"] for d in docs),
            "typos": sum(d["stats"]["typos"] for d in docs),
            "revisions": sum(d["stats"]["revisions"] for d in docs),
            "pastes": sum(d["stats"]["pastes"] for d in docs),
            "profiles": {p: per_profile[p]["docs"] for p in PROFILES},
            "seed": seed,
        },
        "reconstruction": {"exact_documents": exact, "of": len(docs), "snapshot_checks": snap_checks, "snapshot_mismatches": snap_mism},
        "chain": {"sessions_verified": chain_ok, "of": len(docs), "tamper_detected": tamper_detected, "tamper_tests": min(50, len(docs)),
                  "relinked_tamper_detected": relinked},
        "line_provenance": {"accuracy": round(line_correct / line_total, 4) if line_total else None, "lines": line_total, "confusion": confusion,
                            "per_profile": {p: round(v["line_acc_num"] / v["lines"], 4) if v["lines"] else None for p, v in per_profile.items()}},
        "char_provenance": {"accuracy": round(char_correct / char_total, 5) if char_total else None, "chars": char_total},
        "paste_accounting": {"documents_exact": paste_ok, "of": len(docs)},
        "scripted_typing": {
            "bots": len(bots), "bots_flagged": bot_flagged, "true_positive_rate": round(bot_flagged / len(bots), 3) if bots else None,
            "humans": len(humans), "humans_flagged": human_flagged, "false_positive_rate": round(human_flagged / len(humans), 4) if humans else None,
            "mean_score_by_profile": {p: round(sum(s) / len(s), 3) if s else None for p, s in regularity_scores.items()},
            "flagged_by_profile": {p: per_profile[p]["flagged"] for p in PROFILES},
            "any_signal_by_profile": {p: per_profile[p].get("any_signal", 0) for p in PROFILES},
        },
        "performance": {
            "generate_s": round(gen_s, 2), "verify_events_per_s": int(total_events / verify_s) if verify_s else None,
            "replay_events_per_s": int(total_events / replay_s) if replay_s else None,
            "analysis_ms_per_doc": round(1000 * analysis_s / len(docs), 1),
        },
    }
    return report


def to_markdown(r: dict[str, Any]) -> str:
    c, rc, ch, lp, cp, pa, st, pf = (r["corpus"], r["reconstruction"], r["chain"], r["line_provenance"],
                                     r["char_provenance"], r["paste_accounting"], r["scripted_typing"], r["performance"])
    conf = lp["confusion"]
    header = "| truth \\ recorded | " + " | ".join(LABELS) + " |\n|---|" + "---|" * len(LABELS) + "\n"
    rows = "".join(f"| {a} | " + " | ".join(str(conf[a][b]) for b in LABELS) + " |\n" for a in LABELS)
    verdict = all([
        rc["exact_documents"] == rc["of"], rc["snapshot_mismatches"] == 0, ch["sessions_verified"] == ch["of"],
        ch["tamper_detected"] == ch["tamper_tests"], ch["relinked_tamper_detected"] == ch["tamper_tests"],
        (lp["accuracy"] or 0) >= 0.99, (cp["accuracy"] or 0) >= 0.999, pa["documents_exact"] == pa["of"],
        st["true_positive_rate"] is not None and st["true_positive_rate"] >= 0.95,
        st["false_positive_rate"] is not None and st["false_positive_rate"] <= 0.01,
    ])
    return f"""# Trail backtest report

**Result: {"PASS" if verdict else "FAIL"}** (seed {c['seed']})

## Corpus
- {c['documents']} documents, {c['events']:,} events, {c['final_lines']:,} final lines
- Lines by truth: {c['typed_lines']:,} typed, {c['pasted_lines']:,} pasted or pasted-then-edited, {c['other_lines']:,} mixed/unobserved
- {c['typed_chars']:,} characters typed, {c['pasted_chars']:,} pasted in {c['pastes']} pastes, {c['deleted_chars']:,} deleted, {c['typos']} typos corrected, {c['revisions']} revisions
- Writers: {", ".join(f"{k} {v}" for k, v in c['profiles'].items())}

## 1. Reconstruction
- Documents rebuilt byte-for-byte from events: **{rc['exact_documents']} / {rc['of']}**
- Snapshot hashes checked: {rc['snapshot_checks']}, mismatches: **{rc['snapshot_mismatches']}**

## 2. Chain integrity
- Sessions verified: **{ch['sessions_verified']} / {ch['of']}**
- Edited-event tamper detected: **{ch['tamper_detected']} / {ch['tamper_tests']}**; edited-and-rehashed tamper detected: **{ch['relinked_tamper_detected']} / {ch['tamper_tests']}**

## 3. Line provenance (which lines were typed, pasted, edited after pasting)
- Accuracy over {lp['lines']:,} lines: **{lp['accuracy']:.2%}**
- Per writer profile: {", ".join(f"{k} {v:.2%}" for k, v in lp['per_profile'].items() if v is not None)}

{header}{rows}
## 4. Character provenance
- Accuracy over {cp['chars']:,} characters: **{cp['accuracy']:.3%}**

## 5. Paste accounting
- Documents where pasted and surviving character counts match truth exactly: **{pa['documents_exact']} / {pa['of']}**

## 6. Scripted typing signals
- Bots flagged: **{st['bots_flagged']} / {st['bots']}** (true positive rate {st['true_positive_rate']:.1%})
- Humans flagged: **{st['humans_flagged']} / {st['humans']}** (false positive rate {st['false_positive_rate']:.2%})
- Mean regularity score by profile: {", ".join(f"{k} {v}" for k, v in st['mean_score_by_profile'].items() if v is not None)}

## 7. Performance
- Corpus generated in {pf['generate_s']} s; chain verification {pf['verify_events_per_s']:,} events/s; replay {pf['replay_events_per_s']:,} events/s; analysis {pf['analysis_ms_per_doc']} ms per document

## What this does and does not show
It shows that the recorder's replay is exact, that provenance survives edits, deletions and position shifts, that the chain catches edits, and that crude and jittered typing scripts are flagged without flagging humans. It does not show that a human who retypes AI text by hand can be detected: that is not claimed anywhere in the product.
"""


def main(target_lines: int = 10_000, seed: int = 42, out: str = "backtest-out") -> int:
    r = run(target_lines, seed)
    p = Path(out)
    p.mkdir(parents=True, exist_ok=True)
    (p / "report.json").write_text(json.dumps(r, indent=2))
    md = to_markdown(r)
    (p / "report.md").write_text(md)
    print(md)
    return 0 if "PASS" in md.splitlines()[2] else 1
