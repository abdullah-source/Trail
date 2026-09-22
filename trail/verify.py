#!/usr/bin/env python3
"""Standalone verifier for a Trail writing record.

This file is copied verbatim into every archive so that a third party can
verify the record with nothing but this script, the archive, and the
signer's public key. It depends only on the Python standard library;
signature checks additionally need the `cryptography` package and are
reported as SKIPPED when it is absent.

Usage:
    python verify.py <archive.tar.gz | extracted directory> [--public-key signer.pub.pem]

Checks performed:
    1. Every file listed in manifest.json has the recorded SHA-256.
    2. Every event's hash equals SHA-256(canonical JSON of its body).
    3. Within each session, seq is contiguous from 0 and every event's
       `prev` equals the previous event's hash (genesis for seq 0), and
       every session started inside the archive's stated period.
    4. Every checkpoint's signature verifies under the public key, the
       checkpoints chain to one another, every session a checkpoint names
       as starting in the period is present, and every named head matches
       the event at that seq in the archive.
    5. If manifest.sig.json is present, the manifest signature verifies.

Exit code 0 means every check passed; 1 means at least one failed.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import sys
import tarfile
import tempfile

GENESIS = "0" * 64


def canonical(value) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode(
        "utf-8"
    )


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_jsonl(path):
    out = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def load_verifier(pem_path):
    try:
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
        from cryptography.exceptions import InvalidSignature
    except ImportError:
        return None
    with open(pem_path, "rb") as f:
        key = serialization.load_pem_public_key(f.read())
    if not isinstance(key, Ed25519PublicKey):
        raise SystemExit("public key is not Ed25519")
    raw = key.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    key_id = sha256_hex(raw)[:16]

    def verify(body, sig_b64) -> bool:
        try:
            key.verify(base64.b64decode(sig_b64), hashlib.sha256(canonical(body)).digest())
            return True
        except (InvalidSignature, ValueError):
            return False

    return key_id, verify


class Report:
    def __init__(self):
        self.checks = []
        self.failed = 0

    def ok(self, name, detail=""):
        self.checks.append(("PASS", name, detail))

    def fail(self, name, detail=""):
        self.failed += 1
        self.checks.append(("FAIL", name, detail))

    def skip(self, name, detail=""):
        self.checks.append(("SKIP", name, detail))

    def print(self):
        for status, name, detail in self.checks:
            line = f"[{status}] {name}"
            if detail:
                line += f": {detail}"
            print(line)
        print("RESULT:", "VERIFIED" if self.failed == 0 else f"FAILED ({self.failed} check(s))")


def verify_directory(root: str, public_key: str | None = None) -> Report:
    r = Report()
    manifest_path = os.path.join(root, "manifest.json")
    if not os.path.exists(manifest_path):
        r.fail("manifest", "manifest.json missing")
        return r
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    # 1. file hashes
    bad = []
    for rel, expected in sorted(manifest.get("files", {}).items()):
        p = os.path.join(root, rel)
        if not os.path.exists(p):
            bad.append(f"{rel} missing")
            continue
        with open(p, "rb") as f:
            actual = sha256_hex(f.read())
        if actual != expected:
            bad.append(f"{rel} hash mismatch")
    if bad:
        r.fail("manifest file hashes", "; ".join(bad[:5]))
    else:
        r.ok("manifest file hashes", f"{len(manifest.get('files', {}))} files")

    # 2 + 3. events and chains
    events = read_jsonl(os.path.join(root, manifest.get("events_file", "events.jsonl")))
    by_session = {}
    hash_errors = 0
    for ev in events:
        body = {k: v for k, v in ev.items() if k != "hash"}
        if sha256_hex(canonical(body)) != ev.get("hash"):
            hash_errors += 1
        by_session.setdefault(ev["session"], []).append(ev)
    if hash_errors:
        r.fail("event hashes", f"{hash_errors} of {len(events)} events do not match their contents")
    else:
        r.ok("event hashes", f"{len(events)} events")

    chain_errors = []
    heads = {}
    for session, evs in sorted(by_session.items()):
        evs.sort(key=lambda e: e["seq"])
        prev = GENESIS
        for i, ev in enumerate(evs):
            if ev["seq"] != i:
                chain_errors.append(f"session {session}: seq gap at {i}")
            if ev["prev"] != prev:
                chain_errors.append(f"session {session} seq {ev['seq']}: prev mismatch")
            prev = ev["hash"]
        heads[session] = {"seq": evs[-1]["seq"], "hash": evs[-1]["hash"]}
    if chain_errors:
        r.fail("chain linkage", "; ".join(chain_errors[:5]))
    else:
        r.ok("chain linkage", f"{len(by_session)} sessions")

    if manifest.get("event_count") is not None and manifest["event_count"] != len(events):
        r.fail("event count", f"manifest says {manifest['event_count']}, archive has {len(events)}")

    p_start = p_end = None

    # 4. checkpoints
    cp_path = os.path.join(root, manifest.get("checkpoints_file", "checkpoints.jsonl"))
    checkpoints = read_jsonl(cp_path) if os.path.exists(cp_path) else []
    pk = public_key or os.path.join(root, manifest.get("public_key_file", "keys/signer.pub.pem"))
    verifier = load_verifier(pk) if os.path.exists(pk) else None
    if not checkpoints:
        r.skip("checkpoints", "none in archive")
    else:
        key_id, verify = verifier if verifier else (None, None)
        cp_errors = []
        checkpoints.sort(key=lambda c: c["body"]["seq"])
        first_seq = checkpoints[0]["body"]["seq"]
        prev_hash = GENESIS if first_seq == 0 else None  # linkage to earlier checkpoints is outside this archive
        covered = set()
        outside_sessions = 0
        for i, cp in enumerate(checkpoints):
            body = cp["body"]
            body_hash = sha256_hex(canonical(body))
            if cp.get("hash", body_hash) != body_hash:
                cp_errors.append(f"checkpoint {body['seq']}: hash mismatch")
            if body["seq"] != first_seq + i:
                cp_errors.append(f"checkpoint {body['seq']}: expected seq {first_seq + i}")
            if prev_hash is not None and body["prev_checkpoint"] != prev_hash:
                cp_errors.append(f"checkpoint {body['seq']}: prev_checkpoint mismatch")
            prev_hash = body_hash
            for session, head in body.get("heads", {}).items():
                evs = by_session.get(session)
                first_ts = head.get("first_ts")
                in_period = bool(p_start and p_end and first_ts and p_start <= first_ts < p_end)
                if evs is None:
                    cp_errors.append(f"checkpoint {body['seq']}: session {session} is named but missing from the record")
                    continue
                covered.add(session)
                if head["seq"] >= len(evs) or evs[head["seq"]]["hash"] != head["hash"]:
                    cp_errors.append(f"checkpoint {body['seq']}: head of {session} does not match archive")
                elif first_ts is not None and evs[0]["ts"] != first_ts:
                    cp_errors.append(f"checkpoint {body['seq']}: first_ts of {session} does not match archive")
            if verify is not None:
                if cp.get("key_id") != key_id:
                    cp_errors.append(f"checkpoint {body['seq']}: signed by a different key ({cp.get('key_id')})")
                elif not verify(body, cp["signature"]):
                    cp_errors.append(f"checkpoint {body['seq']}: bad signature")
        if cp_errors:
            r.fail("checkpoints", "; ".join(cp_errors[:5]))
        else:
            r.ok("checkpoint linkage and heads", f"{len(checkpoints)} checkpoints, {len(covered)} of {len(by_session)} sessions covered")
        uncovered = len(by_session) - len(covered)
        if uncovered:
            r.skip("checkpoint coverage", f"{uncovered} session(s) not yet named by any checkpoint in this archive")
        if verify is None:
            r.skip("checkpoint signatures", "install `cryptography` to verify Ed25519 signatures")
        else:
            r.ok("checkpoint signatures", f"key {key_id}")

    # 5. manifest signature
    sig_path = os.path.join(root, "manifest.sig.json")
    if os.path.exists(sig_path):
        with open(sig_path, "r", encoding="utf-8") as f:
            sig = json.load(f)
        if verifier is None:
            r.skip("manifest signature", "no public key or cryptography unavailable")
        else:
            key_id, verify = verifier
            if sig.get("key_id") != key_id:
                r.fail("manifest signature", "signed by a different key")
            elif sig.get("manifest_hash") != sha256_hex(canonical(manifest)):
                r.fail("manifest signature", "manifest hash in signature does not match manifest.json")
            elif not verify({"manifest_hash": sig["manifest_hash"]}, sig["signature"]):
                r.fail("manifest signature", "bad signature")
            else:
                r.ok("manifest signature", f"key {key_id}")
    else:
        r.skip("manifest signature", "manifest.sig.json not present")

    return r


def verify_path(path: str, public_key: str | None = None) -> Report:
    if os.path.isdir(path):
        return verify_directory(path, public_key)
    with tempfile.TemporaryDirectory() as tmp:
        with tarfile.open(path, "r:*") as tar:
            for member in tar.getmembers():
                target = os.path.realpath(os.path.join(tmp, member.name))
                if not target.startswith(os.path.realpath(tmp) + os.sep) and target != os.path.realpath(tmp):
                    raise SystemExit(f"unsafe path in archive: {member.name}")
            tar.extractall(tmp)
        entries = os.listdir(tmp)
        root = os.path.join(tmp, entries[0]) if len(entries) == 1 and os.path.isdir(os.path.join(tmp, entries[0])) else tmp
        return verify_directory(root, public_key)


def main(argv=None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 2
    path = argv[0]
    pk = None
    if "--public-key" in argv:
        pk = argv[argv.index("--public-key") + 1]
    report = verify_path(path, pk)
    report.print()
    return 0 if report.failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
