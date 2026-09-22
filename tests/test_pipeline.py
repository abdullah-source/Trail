import json
import subprocess
import sys
import tarfile
from datetime import datetime, timezone

from trail.analysis import analyse
from trail.core.signing import Signer, changed_heads, make_checkpoint
from trail.chain import verify_chain
from trail.pack import build_pack, render_html, declaration, patterns
from trail.record import build_record, verify_record
from trail.synthetic import Writer, load_lines, make_corpus
from trail.backtest import run


def _doc(profile, seed=3, lines=30):
    w = Writer(profile=profile, seed=seed, start=datetime(2026, 10, 1, 9, 0, tzinfo=timezone.utc),
               human_lines=load_lines("human.txt"), paste_lines=load_lines("pasted.txt"), target_lines=lines)
    return w.write()


def test_analysis_matches_truth_for_each_profile():
    for profile in ("honest", "mixed", "heavy_paster", "autotyper", "jittered_bot", "gapped"):
        d = _doc(profile)
        a = analyse(d["events"])
        assert a["document"]["text_hash"] == __import__("hashlib").sha256(d["truth_text"].encode()).hexdigest()
        assert a["document"]["snapshot_mismatches"] == 0
        truth = {}
        for l in d["truth_lines"]:
            truth[l["label"]] = truth.get(l["label"], 0) + 1
        assert a["line_labels"] == truth, profile
        if profile in ("autotyper", "jittered_bot"):
            assert a["regularity"]["flagged"], profile
        else:
            assert not a["regularity"]["flagged"], (profile, a["regularity"])
        if profile == "heavy_paster":
            assert a["pastes"]["ai_pastes"] > 0 and "chatgpt.com" in json.dumps(a["pastes"]) or a["pastes"]["ai_pastes"] > 0


def test_pack_is_deterministic_and_declaration_reads():
    d = _doc("heavy_paster")
    p1 = build_pack(d["events"], title="t"); p2 = build_pack(list(reversed(d["events"])), title="t")
    assert json.dumps(p1, sort_keys=True) == json.dumps(p2, sort_keys=True)
    assert "I pasted text from" in p1["declaration"]
    html = render_html(p1)
    assert "Writing record" in html and p1["input_hash"] in html
    d2 = _doc("honest")
    assert "No text in this document was pasted" in build_pack(d2["events"])["declaration"]
    pt = patterns([p1["analysis"], build_pack(d2["events"])["analysis"]])
    assert pt["documents"] == 2 and pt["total_words"] > 0


def test_record_round_trip_and_standalone_verify(tmp_path):
    d = _doc("mixed")
    signer = Signer.generate()
    heads = verify_chain(d["events"]).heads
    cp = make_checkpoint(signer, tenant="u", agent=d["doc"], heads=changed_heads(heads, []), all_heads=heads, events=len(d["events"]), seq=0)
    pack = build_pack(d["events"], checkpoints=[cp.to_dict()], title="Essay")
    path = tmp_path / "essay.trail.tar.gz"
    build_record(path, events=d["events"], checkpoints=[cp.to_dict()], verifier=signer.public_key, signer=signer, pack=pack)
    rep = verify_record(path)
    assert rep.failed == 0, [c for c in rep.checks if c[0] == "FAIL"]
    with tarfile.open(path) as tar:
        tar.extractall(tmp_path / "x")
    root = next((tmp_path / "x").iterdir())
    proc = subprocess.run([sys.executable, "-I", str(root / "verify.py"), str(root)], capture_output=True, text=True)
    assert "RESULT: VERIFIED" in proc.stdout, proc.stdout + proc.stderr
    # tamper: edit one event, keep manifest consistent -> checkpoint head no longer matches
    lines = (root / "events.jsonl").read_text().splitlines()
    ev = json.loads(lines[3]); ev["data"]["tampered"] = True
    lines[3] = json.dumps(ev, sort_keys=True, separators=(",", ":"))
    (root / "events.jsonl").write_text("\n".join(lines) + "\n")
    proc = subprocess.run([sys.executable, "-I", str(root / "verify.py"), str(root)], capture_output=True, text=True)
    assert "RESULT: FAILED" in proc.stdout


def test_backtest_small_passes():
    r = run(target_lines=600, seed=5)
    assert r["reconstruction"]["exact_documents"] == r["reconstruction"]["of"]
    assert r["chain"]["sessions_verified"] == r["chain"]["of"]
    assert r["line_provenance"]["accuracy"] == 1.0 and r["char_provenance"]["accuracy"] == 1.0
    assert r["scripted_typing"]["false_positive_rate"] == 0.0
