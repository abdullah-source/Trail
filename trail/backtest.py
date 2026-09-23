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


# -- real texts, simulated processes -------------------------------------------------------
#
#     trail backtest --real [--seed S] [--out DIR]     writes backtest-out/real-report.md
#
# Real human essays and real ChatGPT essays (corpus/real/) are pushed through simulated
# writing processes (trail.synthetic.RealWriter). Trail records the process; it does not
# detect AI text, and this report does not claim that it does.

import statistics

from trail.synthetic import SCENARIOS, make_real_corpus

SCENARIO_NAMES = {
    "human_typed": "human essay typed by hand over several sessions",
    "ai_pasted_whole": "AI essay pasted whole from chatgpt.com, light edits after",
    "ai_pasted_chunks": "AI essay pasted in chunks from chatgpt.com, partly reworded",
    "ai_autotyped": "AI essay auto-typed by a script (uniform rhythm)",
    "mixed_quotes": "human essay typed by hand with quotations pasted from a web source",
}


def _dist(xs: list[float]) -> dict[str, float | None]:
    if not xs:
        return {"min": None, "median": None, "mean": None, "max": None}
    return {"min": round(min(xs), 4), "median": round(statistics.median(xs), 4), "mean": round(statistics.mean(xs), 4), "max": round(max(xs), 4)}


def run_real(seed: int = 42, limit: int | None = None) -> dict[str, Any]:
    t0 = time.perf_counter()
    docs = make_real_corpus(seed=seed, limit=limit)
    gen_s = time.perf_counter() - t0
    per: dict[str, dict[str, Any]] = {s: {"docs": 0, "lines": 0, "words": 0, "events": 0, "sessions": 0, "exact": 0, "chain_ok": 0,
                                          "line_correct": 0, "line_total": 0, "char_correct": 0, "char_total": 0,
                                          "paste_count_ok": 0, "paste_source_ok": 0, "flagged": 0, "any_signal": 0,
                                          "typed_shares": [], "typed_share_abs_err": [], "pastes": 0, "pasted_chars": 0} for s in SCENARIOS}
    confusion = {a: {b: 0 for b in LABELS} for a in LABELS}
    sources_seen: dict[str, int] = {}
    analysis_s = 0.0
    for d in docs:
        p = per[d["scenario"]]
        p["docs"] += 1
        p["events"] += len(d["events"])
        p["sessions"] += d["truth"]["sessions"]
        p["words"] += len(d["truth_text"].split())
        sources_seen[d["source"]] = sources_seen.get(d["source"], 0) + 1
        if verify_chain(d["events"]).ok:
            p["chain_ok"] += 1
        doc = replay(d["events"])
        if doc.text == d["truth_text"]:
            p["exact"] += 1
        lines = doc.lines()
        truth = d["truth_lines"]
        p["lines"] += len(truth)
        for a, b in zip(lines, truth):
            confusion[b["label"]][a.label] += 1
            p["line_total"] += 1
            if a.label == b["label"]:
                p["line_correct"] += 1
        p["line_total"] += abs(len(lines) - len(truth))
        for o_a, o_b in zip(doc.origin, d["truth_origin"]):
            p["char_total"] += 1
            if (o_a.startswith("paste:")) == (o_b.startswith("paste:")) and (o_a == o_b or o_a.startswith("paste:")):
                p["char_correct"] += 1
        p["char_total"] += abs(len(doc.origin) - len(d["truth_origin"]))
        ta = time.perf_counter()
        a = analyse(d["events"])
        analysis_s += time.perf_counter() - ta
        # paste accounting: count, chars, surviving chars, and per-source (host and kind) totals
        tp = d["truth"]
        pr = a["pastes"]
        if pr["count"] == len(tp["paste_sources"]) and pr["pasted_chars"] == tp["pasted_chars"] and pr["pasted_chars_surviving"] == tp["pasted_chars_surviving"]:
            p["paste_count_ok"] += 1
        truth_by_kind: dict[str, int] = {}
        truth_hosts: dict[str, int] = {}
        for s in tp["paste_sources"]:
            truth_by_kind[s["kind"]] = truth_by_kind.get(s["kind"], 0) + s["chars"]
            truth_hosts[s["host"]] = truth_hosts.get(s["host"], 0) + s["chars"]
        rec_hosts: dict[str, int] = {}
        for it in pr["items"]:
            rec_hosts[it["source_host"]] = rec_hosts.get(it["source_host"], 0) + it["chars"]
        if pr["by_source_kind"] == truth_by_kind and rec_hosts == truth_hosts:
            p["paste_source_ok"] += 1
        p["pastes"] += pr["count"]
        p["pasted_chars"] += pr["pasted_chars"]
        p["typed_shares"].append(a["document"]["typed_share"] or 0.0)
        p["typed_share_abs_err"].append(abs((a["document"]["typed_share"] or 0.0) - tp["typed_share"]))
        if a["regularity"]["flagged"]:
            p["flagged"] += 1
        if a["regularity"]["signals"]:
            p["any_signal"] += 1

    scen = {}
    for s, p in per.items():
        scen[s] = {
            "description": SCENARIO_NAMES[s], "documents": p["docs"], "lines": p["lines"], "words": p["words"], "events": p["events"],
            "sessions": p["sessions"], "exact_reconstruction": p["exact"], "chain_verified": p["chain_ok"],
            "line_accuracy": round(p["line_correct"] / p["line_total"], 4) if p["line_total"] else None,
            "char_accuracy": round(p["char_correct"] / p["char_total"], 5) if p["char_total"] else None,
            "typed_share": _dist(p["typed_shares"]), "typed_share_max_abs_error": round(max(p["typed_share_abs_err"]), 5) if p["typed_share_abs_err"] else None,
            "pastes": p["pastes"], "pasted_chars": p["pasted_chars"],
            "paste_accounting_exact": p["paste_count_ok"], "paste_source_exact": p["paste_source_ok"],
            "flagged_scripted": p["flagged"], "any_signal": p["any_signal"],
        }
    human_scen = ("human_typed", "mixed_quotes")
    humans = sum(scen[s]["documents"] for s in human_scen)
    humans_flagged = sum(scen[s]["flagged_scripted"] for s in human_scen)
    bots = scen["ai_autotyped"]["documents"]
    bots_flagged = scen["ai_autotyped"]["flagged_scripted"]
    line_total = sum(per[s]["line_total"] for s in SCENARIOS)
    char_total = sum(per[s]["char_total"] for s in SCENARIOS)
    return {
        "seed": seed,
        "corpus": {"documents": len(docs), "lines": sum(p["lines"] for p in per.values()), "words": sum(p["words"] for p in per.values()),
                   "events": sum(p["events"] for p in per.values()), "sessions": sum(p["sessions"] for p in per.values()),
                   "sources": dict(sorted(sources_seen.items())), "human_texts": len({d["source_id"] for d in docs if d["source_kind"] == "human"}),
                   "ai_texts": len({d["source_id"] for d in docs if d["source_kind"] == "ai"})},
        "scenarios": scen,
        "overall": {
            "exact_reconstruction": sum(p["exact"] for p in per.values()), "chain_verified": sum(p["chain_ok"] for p in per.values()),
            "line_accuracy": round(sum(p["line_correct"] for p in per.values()) / line_total, 4) if line_total else None,
            "char_accuracy": round(sum(p["char_correct"] for p in per.values()) / char_total, 5) if char_total else None,
            "confusion": confusion,
            "paste_accounting_exact": sum(p["paste_count_ok"] for p in per.values()), "paste_source_exact": sum(p["paste_source_ok"] for p in per.values()),
            "humans": humans, "humans_flagged": humans_flagged, "false_positive_rate": round(humans_flagged / humans, 4) if humans else None,
            "autotyped": bots, "autotyped_flagged": bots_flagged, "true_positive_rate": round(bots_flagged / bots, 4) if bots else None,
            "ai_pasted_flagged": scen["ai_pasted_whole"]["flagged_scripted"] + scen["ai_pasted_chunks"]["flagged_scripted"],
        },
        "performance": {"generate_s": round(gen_s, 2), "analysis_ms_per_doc": round(1000 * analysis_s / len(docs), 1) if docs else None},
    }


def real_verdict(r: dict[str, Any]) -> bool:
    o, c = r["overall"], r["corpus"]
    return all([
        o["exact_reconstruction"] == c["documents"], o["chain_verified"] == c["documents"],
        (o["line_accuracy"] or 0) >= 0.99, (o["char_accuracy"] or 0) >= 0.999,
        o["paste_accounting_exact"] == c["documents"], o["paste_source_exact"] == c["documents"],
        o["humans_flagged"] == 0, o["autotyped"] > 0 and o["autotyped_flagged"] == o["autotyped"],
    ])


def to_markdown_real(r: dict[str, Any]) -> str:
    c, o, s = r["corpus"], r["overall"], r["scenarios"]
    conf = o["confusion"]
    header = "| truth \\ recorded | " + " | ".join(LABELS) + " |\n|---|" + "---|" * len(LABELS) + "\n"
    rows = "".join(f"| {a} | " + " | ".join(str(conf[a][b]) for b in LABELS) + " |\n" for a in LABELS)
    scen_rows = "".join(
        f"| {k} | {v['documents']} | {v['sessions']} | {v['lines']:,} | {v['words']:,} | {v['pastes']} | {v['pasted_chars']:,} |\n" for k, v in s.items())
    acc_rows = "".join(
        f"| {k} | {v['exact_reconstruction']}/{v['documents']} | {v['line_accuracy']:.2%} | {v['char_accuracy']:.3%} | {v['paste_accounting_exact']}/{v['documents']} | {v['paste_source_exact']}/{v['documents']} |\n"
        for k, v in s.items())
    ts_rows = "".join(
        f"| {k} | {v['typed_share']['min']:.3f} | {v['typed_share']['median']:.3f} | {v['typed_share']['mean']:.3f} | {v['typed_share']['max']:.3f} | {v['typed_share_max_abs_error']:.5f} |\n"
        for k, v in s.items())
    flag_rows = "".join(f"| {k} | {v['flagged_scripted']}/{v['documents']} | {v['any_signal']}/{v['documents']} |\n" for k, v in s.items())
    fp_note = ("None of the honest human documents were flagged." if o["humans_flagged"] == 0 else
               f"**{o['humans_flagged']} honest human documents were flagged as scripted.** This is a false positive rate of {o['false_positive_rate']:.2%} and must be investigated before this signal is shown to a student.")
    sources = "".join(f"- {k}: {v} simulated documents\n" for k, v in c["sources"].items())
    return f"""# Trail backtest on real texts

**Result: {"PASS" if real_verdict(r) else "FAIL"}** (seed {r['seed']})

**What this is and is not.** Trail does not detect AI-written text and this report does not
claim that it can. Trail records the *process* by which a document was written: keystrokes,
pastes and where they came from, sessions over time. Here, real human essays and real
ChatGPT essays from public datasets (see `corpus/real/SOURCES.md`) are pushed through
simulated writing processes, and the report measures whether the record of the process is
reconstructed and attributed correctly. The same AI essay appears three times with three
different processes; the text is identical, only the record differs. Nothing in the text
itself is used by the analysis.

## Corpus
- {c['human_texts']} real human texts and {c['ai_texts']} real AI texts; {c['documents']} simulated documents, {c['sessions']} writing sessions, {c['events']:,} events
- **{c['lines']:,} lines and {c['words']:,} words processed**
{sources}
## Scenarios

| scenario | documents | sessions | lines | words | pastes | pasted chars |
|---|---|---|---|---|---|---|
{scen_rows}
{"".join(f"- `{k}`: {v['description']}" + chr(10) for k, v in s.items())}
## 1. Reconstruction and provenance
- Documents rebuilt byte-for-byte from events: **{o['exact_reconstruction']} / {c['documents']}**; sessions chain-verified: **{o['chain_verified']} / {c['documents']}**
- Line provenance accuracy: **{o['line_accuracy']:.2%}**; character provenance accuracy: **{o['char_accuracy']:.3%}**

| scenario | exact | line accuracy | char accuracy | paste accounting exact | paste sources exact |
|---|---|---|---|---|---|
{acc_rows}
{header}{rows}
## 2. Typed share by scenario (what the student's record shows)

| scenario | min | median | mean | max | max abs error vs truth |
|---|---|---|---|---|---|
{ts_rows}
A human who typed everything shows 1.000. A human who quoted one or two sources shows
a bit less, with the pastes attributed to the web host they came from. An AI essay pasted
whole shows near zero, with the paste attributed to chatgpt.com. An AI essay *auto-typed*
by a script shows 1.000 typed share: the paste record cannot see it, only the rhythm can.

## 3. Paste-source accounting
- Documents where paste count, pasted characters and surviving characters match truth: **{o['paste_accounting_exact']} / {c['documents']}**
- Documents where characters per source host and per source kind (ai / web / self) match truth: **{o['paste_source_exact']} / {c['documents']}**

## 4. Scripted-typing signal

| scenario | flagged as consistent with scripted typing | any signal at all |
|---|---|---|
{flag_rows}
- Honest human documents flagged: **{o['humans_flagged']} / {o['humans']}**. {fp_note}
- Auto-typed documents flagged: **{o['autotyped_flagged']} / {o['autotyped']}** (true positive rate {o['true_positive_rate']:.1%})
- AI essays that were pasted (not typed) flagged: {o['ai_pasted_flagged']}; there the record already shows the paste, so no rhythm signal is expected.

## 5. Performance
- {c['documents']} documents simulated in {r['performance']['generate_s']} s; analysis {r['performance']['analysis_ms_per_doc']} ms per document

## Limits
- The processes are simulated. Human cadence is a lognormal model with typos, false starts and
  pauses; the auto-typer is a fixed 55 ms interval. A script that imitates human jitter is
  covered by the `jittered_bot` profile in the synthetic backtest, not here.
- A person who reads an AI essay off a second screen and retypes it by hand produces a record
  that looks like honest typing. Trail does not claim to detect that, and this report shows why:
  the `ai_autotyped` scenario is only caught by its rhythm.
- The texts are real but the scenarios were assigned by the simulator: a human essay is always
  typed, an AI essay is always pasted or scripted. The analysis never reads the text, so this
  assignment cannot leak into the results; it only makes the demo honest about what each text is.
"""


def main_real(seed: int = 42, out: str = "backtest-out", limit: int | None = None) -> int:
    r = run_real(seed, limit=limit)
    p = Path(out)
    p.mkdir(parents=True, exist_ok=True)
    (p / "real-report.json").write_text(json.dumps(r, indent=2))
    md = to_markdown_real(r)
    (p / "real-report.md").write_text(md)
    print(md)
    return 0 if real_verdict(r) else 1
