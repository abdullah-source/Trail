"""Canonical serialization and hashing.

Every hash in the system is computed over the canonical JSON form of a
value: keys sorted, no insignificant whitespace, UTF-8, no NaN/Infinity,
integers and strings only where the schema demands it. Two independent
implementations (Python, TypeScript, the verification script) must produce
byte-identical output for the same value, so the rules are deliberately
few and strict.
"""

from __future__ import annotations

import hashlib
import json
import math
from typing import Any

GENESIS_HASH = "0" * 64
HASH_ALGORITHM = "sha256"


def _reject_floats(value: Any) -> None:
    """Refuse non-finite floats; they have no canonical JSON form."""
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            raise ValueError("non-finite float cannot be canonicalized")
    elif isinstance(value, dict):
        for k, v in value.items():
            if not isinstance(k, str):
                raise ValueError("canonical JSON object keys must be strings")
            _reject_floats(v)
    elif isinstance(value, (list, tuple)):
        for v in value:
            _reject_floats(v)


def canonical_json(value: Any) -> bytes:
    """Serialize a JSON-compatible value to its canonical byte form."""
    _reject_floats(value)
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode("utf-8")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def hash_value(value: Any) -> str:
    """SHA-256 hex digest of a value's canonical JSON form."""
    return sha256_hex(canonical_json(value))


def hash_file(path: str, chunk_size: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()
