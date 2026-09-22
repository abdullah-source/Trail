"""Record archive: the bundle a student exports and a reader verifies.

    <name>/
      manifest.json, manifest.sig.json (if a signer is available)
      events.jsonl            every event, chain order
      checkpoints.jsonl       signed checkpoints
      keys/signer.pub.pem     public key
      pack.json, pack.html    evidence pack (optional)
      declaration.md          AI use declaration (optional)
      verify.py               standalone verifier
      README.md
"""

from __future__ import annotations

import io
import json
import os
import tarfile
from pathlib import Path
from typing import Any, Iterable

from trail import verify as verify_module
from trail.core.canonical import hash_value, sha256_hex
from trail.core.signing import Signer, Verifier
from trail.core.timeutil import now_ts
from trail.events import Event
from trail.pack import build_pack, render_html

RECORD_VERSION = 1


def build_record(out_path: str | os.PathLike[str], *, events: Iterable[Event], checkpoints: list[dict[str, Any]],
                 verifier: Verifier | None, signer: Signer | None = None, pack: dict[str, Any] | None = None,
                 created_at: str | None = None) -> dict[str, Any]:
    evs = sorted(events, key=lambda e: (e.session, e.seq))
    if not evs:
        raise ValueError("no events")
    out_path = Path(out_path)
    name = out_path.name
    for suf in (".tar.gz", ".tgz", ".trail"):
        if name.endswith(suf):
            name = name[: -len(suf)]
            break
    files: dict[str, bytes] = {
        "events.jsonl": _jsonl(e.to_dict() for e in evs),
        "checkpoints.jsonl": _jsonl(sorted(checkpoints, key=lambda c: c["body"]["seq"])),
        "verify.py": Path(verify_module.__file__).read_bytes(),
        "README.md": _readme(name).encode(),
    }
    if verifier is not None:
        files["keys/signer.pub.pem"] = verifier.to_pem()
    if pack is not None:
        files["pack.json"] = _json(pack)
        files["pack.html"] = render_html(pack).encode()
        files["declaration.md"] = pack["declaration"].encode()
    manifest = {
        "v": RECORD_VERSION, "name": name, "created_at": created_at or now_ts(),
        "doc": evs[0].doc, "sessions": sorted({e.session for e in evs}), "event_count": len(evs),
        "checkpoint_count": len(checkpoints), "events_hash": hash_value([e.hash for e in evs]),
        "key_id": verifier.key_id if verifier else None,
        "files": {k: sha256_hex(v) for k, v in sorted(files.items())},
    }
    files["manifest.json"] = _json(manifest)
    if signer is not None:
        mh = hash_value(manifest)
        files["manifest.sig.json"] = _json({"manifest_hash": mh, "signature": signer.sign_body({"manifest_hash": mh}), "key_id": signer.public_key.key_id})
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(out_path, "w:gz") as tar:
        for rel, data in sorted(files.items()):
            info = tarfile.TarInfo(name=f"{name}/{rel}")
            info.size = len(data); info.mtime = 0; info.mode = 0o644
            tar.addfile(info, io.BytesIO(data))
    return manifest


def verify_record(path: str | os.PathLike[str], public_key: str | None = None) -> verify_module.Report:
    return verify_module.verify_path(str(path), public_key)


def _readme(name: str) -> str:
    return f"""# {name}

A Trail writing record. To verify it:

    python verify.py .

Requires Python 3.9+. With the `cryptography` package installed, Ed25519
signatures are checked as well; without it, hashes and chain links are
still verified and signature checks are reported as SKIPPED.

pack.html is the readable evidence pack. events.jsonl is the full record.
"""


def _json(v: Any) -> bytes:
    return (json.dumps(v, sort_keys=True, indent=2, ensure_ascii=False) + "\n").encode()


def _jsonl(vs: Iterable[Any]) -> bytes:
    return "".join(json.dumps(v, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n" for v in vs).encode()
