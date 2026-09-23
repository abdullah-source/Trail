"""Demo records: sample essays shipped as static files, signed by this server's key at boot.

The web app plays them from <static>/demo/manifest.json and <static>/demo/<id>.events.json
(the extension's export format: a JSON array of event dicts). So that the public /verify page
gets a full PASS for a demo pack, the events are checkpointed at startup exactly as
POST /v1/checkpoint would for a real user, under a system account (DEMO_EMAIL) that can never
sign in, and the checkpoints go into the transparency log like everyone else's.

Idempotency: Store.checkpoint() only signs when the session heads differ from what earlier
checkpoints for (demo user, doc) already recorded (core.signing.changed_heads), so a second boot
with the same files signs nothing and appends nothing to the log. Changing a demo's events
appends a further checkpoint; changing them *in place* under the same doc id would leave the
old checkpoint naming heads that no longer exist, which is detected and logged at boot.

Nothing here is required for the app to run: a missing or malformed demo directory is a warning.
"""

from __future__ import annotations

import json
import logging
import re
import tempfile
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from trail.chain import verify_chain
from trail.core.signing import Checkpoint, Signer
from trail.events import Event
from trail.pack import build_pack
from trail.record import build_record
from trail.server.store import Store

log = logging.getLogger("trail.demo")

DEMO_EMAIL = "demo@trail.local"
DEMO_ID_RE = re.compile(r"[a-z0-9-]{1,40}")
MANIFEST = "manifest.json"
MAX_EVENTS = 500_000


def record_filename(title: str | None, doc: str) -> str:
    """`<title>.trail.tar.gz`, with the title reduced to a safe file name (same rule as /v1/pack)."""
    safe = re.sub(r"[^A-Za-z0-9_-]+", "-", (title or doc[:12])).strip("-") or "essay"
    return f"{safe[:60]}.trail.tar.gz"


@dataclass
class Demo:
    id: str
    doc: str
    events: list[Event]
    file: str
    title: str | None = None
    student: str | None = None
    course: str | None = None
    description: str | None = None
    sessions: int = 0
    stale: bool = False  # existing checkpoints no longer match the events on disk
    _pack: dict[str, Any] | None = field(default=None, repr=False)
    _record: tuple[str, bytes] | None = field(default=None, repr=False)


def _str(v: Any, limit: int = 200) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s[:limit] or None


def manifest_entries(manifest: Any) -> list[dict[str, Any]]:
    """Accept the shapes a hand-written manifest is likely to take:
    `[{"id": ...}, ...]`, `["id", ...]`, `{"demos": [...]}` and `{"<id>": {...}, ...}`."""
    if isinstance(manifest, dict):
        for key in ("demos", "items", "records", "essays"):
            if isinstance(manifest.get(key), list):
                manifest = manifest[key]
                break
        else:
            return [{"id": k, **v} for k, v in manifest.items() if isinstance(v, dict)]
    if not isinstance(manifest, list):
        raise ValueError("manifest must be a list of demos or an object with a 'demos' list")
    out = []
    for x in manifest:
        if isinstance(x, str):
            out.append({"id": x})
        elif isinstance(x, dict):
            out.append(x)
    return out


def load_events(path: Path) -> list[Event]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, dict) and isinstance(raw.get("events"), list):
        raw = raw["events"]
    if not isinstance(raw, list) or not raw:
        raise ValueError("events file must be a non-empty JSON array of events")
    if len(raw) > MAX_EVENTS:
        raise ValueError(f"too many events ({len(raw)} > {MAX_EVENTS})")
    return [Event.from_dict(e) for e in raw]


def find_demo_dir(static: Path | None, extra: list[Path] | None = None) -> Path | None:
    for base in [static, *(extra or [])]:
        if base is not None and (base / "demo" / MANIFEST).is_file():
            return base / "demo"
    return None


class DemoRegistry:
    """The demos this server knows about, loaded once at boot."""

    def __init__(self, store: Store, signer: Signer):
        self.store = store
        self.signer = signer
        self.demos: dict[str, Demo] = {}
        self.user_id: str | None = None
        self._lock = threading.Lock()

    # -- boot ------------------------------------------------------------------------------------

    def load(self, demo_dir: Path | None) -> None:
        """Load every demo the manifest names and make sure each has a signed checkpoint.
        Never raises: a broken demo is skipped with a warning, a broken directory is ignored."""
        if demo_dir is None:
            return
        try:
            entries = manifest_entries(json.loads((demo_dir / MANIFEST).read_text(encoding="utf-8")))
        except Exception as e:
            log.warning("demo manifest %s unusable: %s", demo_dir / MANIFEST, e)
            return
        for entry in entries:
            demo_id = str(entry.get("id", ""))
            if not DEMO_ID_RE.fullmatch(demo_id):
                log.warning("demo id %r ignored: must match %s", demo_id[:60], DEMO_ID_RE.pattern)
                continue
            try:
                self._load_one(demo_dir, demo_id, entry)
            except Exception as e:
                log.warning("demo %s skipped: %s: %s", demo_id, type(e).__name__, e)
        if self.demos:
            log.info("demo records ready: %s", ", ".join(sorted(self.demos)))

    def _ensure_user(self) -> str:
        if self.user_id is None:
            u, _ = self.store.get_or_create_user(DEMO_EMAIL)
            assert u is not None
            self.user_id = u.id
        return self.user_id

    def _load_one(self, demo_dir: Path, demo_id: str, entry: dict[str, Any]) -> None:
        file = str(entry.get("file") or f"{demo_id}.events.json")
        path = (demo_dir / file).resolve()
        if not str(path).startswith(str(demo_dir.resolve())) or not path.is_file():
            raise FileNotFoundError(file)
        evs = load_events(path)
        rep = verify_chain(evs)
        if not rep.ok:
            raise ValueError("chain errors: " + "; ".join(rep.errors[:3]))
        doc = evs[0].doc
        clash = next((d.id for d in self.demos.values() if d.doc == doc), None)
        if clash:
            raise ValueError(f"doc id {doc[:12]}… is already used by demo {clash}; each demo needs its own document")
        uid = self._ensure_user()
        cp = self.store.checkpoint(uid, doc, rep.heads, self.signer)
        existing = self.store.checkpoints(uid, doc)
        stale = self._stale(existing, evs)
        if stale:
            log.warning("demo %s: an existing checkpoint no longer matches %s (edited in place, or the signing key changed); "
                        "its pack will not verify. Regenerate the demo with a new doc id.", demo_id, file)
        self.demos[demo_id] = Demo(id=demo_id, doc=doc, events=evs, file=file, title=_str(entry.get("title")),
                                   student=_str(entry.get("student")), course=_str(entry.get("course")),
                                   description=_str(entry.get("description"), 1000), sessions=rep.sessions, stale=stale)
        log.info("demo %s: %d events, %d sessions, %d checkpoint(s), %s", demo_id, len(evs), rep.sessions, len(existing),
                 "signed now" if cp else "already signed")

    def _stale(self, checkpoints: list[Checkpoint], evs: list[Event]) -> bool:
        by_session: dict[str, dict[int, str]] = {}
        for e in evs:
            by_session.setdefault(e.session, {})[e.seq] = e.hash
        key_id = self.signer.public_key.key_id
        for cp in checkpoints:
            if cp.key_id != key_id:
                return True
            for s, h in cp.body.get("heads", {}).items():
                if by_session.get(s, {}).get(int(h["seq"])) != h["hash"]:
                    return True
        return False

    # -- serving ---------------------------------------------------------------------------------

    def get(self, demo_id: str) -> Demo | None:
        return self.demos.get(demo_id) if DEMO_ID_RE.fullmatch(demo_id or "") else None

    def checkpoints(self, demo: Demo) -> list[dict[str, Any]]:
        assert self.user_id is not None
        return [c.to_dict() for c in self.store.checkpoints(self.user_id, demo.doc)]

    def summary(self, demo: Demo) -> dict[str, Any]:
        cps = self.checkpoints(demo)
        return {
            "id": demo.id, "title": demo.title, "student": demo.student, "course": demo.course, "description": demo.description,
            "doc": demo.doc, "events": len(demo.events), "sessions": demo.sessions,
            "first_event": demo.events[0].ts, "last_event": max(e.ts for e in demo.events),
            "checkpoints": [{"seq": c["body"]["seq"], "ts": c["body"]["ts"], "hash": c["hash"], "key_id": c["key_id"]} for c in cps],
            "signed": bool(cps) and not demo.stale,
            "events_url": f"/demo/{demo.file}",
            "pack_url": f"/v1/demo/{demo.id}/pack",
        }

    def list(self) -> list[dict[str, Any]]:
        return [self.summary(d) for _, d in sorted(self.demos.items())]

    def pack(self, demo: Demo) -> dict[str, Any]:
        with self._lock:
            if demo._pack is None:
                demo._pack = build_pack(demo.events, checkpoints=self.checkpoints(demo), title=demo.title,
                                        student=demo.student, course=demo.course)
            return demo._pack

    def record(self, demo: Demo) -> tuple[str, bytes]:
        """(file name, bytes) of the .trail.tar.gz evidence pack, built like /v1/pack format=record."""
        pack = self.pack(demo)
        with self._lock:
            if demo._record is None:
                with tempfile.TemporaryDirectory() as tmp:
                    path = Path(tmp) / record_filename(demo.title, demo.doc)
                    build_record(path, events=demo.events, checkpoints=self.checkpoints(demo), verifier=self.signer.public_key,
                                 signer=self.signer, pack=pack)
                    demo._record = (path.name, path.read_bytes())
            return demo._record


__all__ = ["DEMO_EMAIL", "DEMO_ID_RE", "Demo", "DemoRegistry", "find_demo_dir", "load_events", "manifest_entries", "record_filename"]
