// Canonical JSON and SHA-256, byte-identical to trail/core/canonical.py.
export function canonical(value) {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isInteger(value)) throw new Error("canonical JSON: only integers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const GENESIS = "0".repeat(64);

export function nowTs(d = new Date()) {
  // YYYY-MM-DDTHH:MM:SS.ffffffZ (microseconds, zero-padded), as in Python.
  return d.toISOString().replace("Z", "000Z");
}

export function uuid() {
  return crypto.randomUUID();
}

export async function makeEvent({ session, doc, seq, kind, data, prev, ts, id }) {
  const body = { v: 1, id: id || uuid(), seq, session, doc, ts: ts || nowTs(), kind, data, prev: prev || GENESIS };
  const hash = await sha256Hex(canonical(body));
  return { ...body, hash };
}
