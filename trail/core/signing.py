"""Ed25519 signing of chain checkpoints.

A checkpoint freezes the heads of every session chain of an agent at a
point in time and is signed with a key the deployer does not control (the
ingestion service's key). Checkpoints are appended to a transparency log
so that neither the deployer nor the service can later rewrite history.

Checkpoint body (hashed and signed):
    {
      "v": 1,
      "tenant": ..., "agent": ...,
      "ts": ..., "seq": n,               # nth checkpoint for this agent
      "prev_checkpoint": <hash or genesis>,
      "heads": {session: {"seq": int, "hash": hex, "first_ts": ts}, ...},  # changed since previous
      "heads_root": SHA-256 of the canonical JSON of the complete head map,
      "events": total event count covered
    }
The signature is over the SHA-256 of the canonical JSON of the body.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

from trail.core.canonical import GENESIS_HASH, canonical_json, hash_value, sha256_hex
from trail.core.timeutil import now_ts

CHECKPOINT_VERSION = 1


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def _unb64(data: str) -> bytes:
    return base64.b64decode(data.encode("ascii"))


class Signer:
    """Holds an Ed25519 private key and signs checkpoint bodies."""

    def __init__(self, private_key: Ed25519PrivateKey):
        self._key = private_key

    @classmethod
    def generate(cls) -> "Signer":
        return cls(Ed25519PrivateKey.generate())

    @classmethod
    def from_pem(cls, pem: bytes, password: bytes | None = None) -> "Signer":
        key = serialization.load_pem_private_key(pem, password=password)
        if not isinstance(key, Ed25519PrivateKey):
            raise TypeError("expected an Ed25519 private key")
        return cls(key)

    def to_pem(self) -> bytes:
        return self._key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )

    @property
    def public_key(self) -> "Verifier":
        return Verifier(self._key.public_key())

    def sign_body(self, body: dict[str, Any]) -> str:
        digest = canonical_json(body)
        return _b64(self._key.sign(sha256_bytes(digest)))


class Verifier:
    """Holds an Ed25519 public key and verifies checkpoint signatures."""

    def __init__(self, public_key: Ed25519PublicKey):
        self._key = public_key

    @classmethod
    def from_pem(cls, pem: bytes) -> "Verifier":
        key = serialization.load_pem_public_key(pem)
        if not isinstance(key, Ed25519PublicKey):
            raise TypeError("expected an Ed25519 public key")
        return cls(key)

    @classmethod
    def from_raw_b64(cls, raw: str) -> "Verifier":
        return cls(Ed25519PublicKey.from_public_bytes(_unb64(raw)))

    def to_pem(self) -> bytes:
        return self._key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )

    def to_raw_b64(self) -> str:
        return _b64(
            self._key.public_bytes(
                encoding=serialization.Encoding.Raw,
                format=serialization.PublicFormat.Raw,
            )
        )

    @property
    def key_id(self) -> str:
        """Stable identifier for the key: SHA-256 of the raw public bytes."""
        raw = self._key.public_bytes(
            encoding=serialization.Encoding.Raw, format=serialization.PublicFormat.Raw
        )
        return sha256_hex(raw)[:16]

    def verify_body(self, body: dict[str, Any], signature_b64: str) -> bool:
        try:
            self._key.verify(_unb64(signature_b64), sha256_bytes(canonical_json(body)))
            return True
        except (InvalidSignature, ValueError):
            return False


def sha256_bytes(data: bytes) -> bytes:
    import hashlib

    return hashlib.sha256(data).digest()


@dataclass(frozen=True)
class Checkpoint:
    body: dict[str, Any]
    signature: str
    key_id: str

    @property
    def hash(self) -> str:
        return hash_value(self.body)

    def to_dict(self) -> dict[str, Any]:
        return {"body": self.body, "signature": self.signature, "key_id": self.key_id, "hash": self.hash}

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Checkpoint":
        cp = cls(body=dict(d["body"]), signature=str(d["signature"]), key_id=str(d["key_id"]))
        if "hash" in d and d["hash"] != cp.hash:
            raise ValueError("checkpoint hash does not match body")
        return cp


def _norm_heads(heads: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {
        s: {"seq": int(h["seq"]), "hash": str(h["hash"]), "first_ts": str(h["first_ts"])}
        for s, h in sorted(heads.items())
    }


def changed_heads(
    all_heads: dict[str, dict[str, Any]], previous: list["Checkpoint"]
) -> dict[str, dict[str, Any]]:
    """Heads that differ from what earlier checkpoints last recorded."""
    seen: dict[str, dict[str, Any]] = {}
    for cp in sorted(previous, key=lambda c: c.body["seq"]):
        seen.update(cp.body.get("heads", {}))
    norm = _norm_heads(all_heads)
    return {s: h for s, h in norm.items() if seen.get(s) != h}


def make_checkpoint(
    signer: Signer,
    *,
    tenant: str,
    agent: str,
    heads: dict[str, dict[str, Any]],
    events: int,
    seq: int,
    prev_checkpoint: str = GENESIS_HASH,
    ts: str | None = None,
    all_heads: dict[str, dict[str, Any]] | None = None,
) -> Checkpoint:
    """Sign a checkpoint.

    `heads` are the session heads this checkpoint names, normally only those
    that changed since the previous checkpoint. `all_heads`, when given, is
    the complete head map; its hash is recorded as `heads_root` so the full
    state at signing time is also committed to.
    """
    body = {
        "v": CHECKPOINT_VERSION,
        "tenant": tenant,
        "agent": agent,
        "ts": ts or now_ts(),
        "seq": seq,
        "prev_checkpoint": prev_checkpoint,
        "heads": _norm_heads(heads),
        "heads_root": hash_value(_norm_heads(all_heads if all_heads is not None else heads)),
        "events": events,
    }
    return Checkpoint(body=body, signature=signer.sign_body(body), key_id=signer.public_key.key_id)


def verify_checkpoint(cp: Checkpoint, verifier: Verifier) -> bool:
    if cp.key_id != verifier.key_id:
        return False
    return verifier.verify_body(cp.body, cp.signature)


def verify_checkpoint_sequence(checkpoints: list[Checkpoint], verifier: Verifier) -> list[str]:
    """Verify signatures and the checkpoint-to-checkpoint hash linkage.

    Returns a list of error strings; empty means the sequence is intact.
    """
    errors: list[str] = []
    prev = GENESIS_HASH
    for i, cp in enumerate(sorted(checkpoints, key=lambda c: c.body["seq"])):
        if cp.body["seq"] != i:
            errors.append(f"checkpoint {cp.body['seq']}: expected seq {i}")
        if cp.body["prev_checkpoint"] != prev:
            errors.append(f"checkpoint {cp.body['seq']}: prev_checkpoint mismatch")
        if not verify_checkpoint(cp, verifier):
            errors.append(f"checkpoint {cp.body['seq']}: bad signature")
        prev = cp.hash
    return errors
