// Canonical JSON, byte-identical to trail/core/canonical.py and extension/src/chain.js:
// keys sorted, no whitespace, UTF-8, no non-finite floats, ensure_ascii=False.
import { sha256Hex } from './sha256';

export const GENESIS_HASH = '0'.repeat(64);

export function canonical(value: any): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('canonical JSON: non-finite float');
      if (Number.isInteger(value)) return String(value);
      return pyFloatRepr(value);
    }
    if (value === undefined) throw new Error('canonical JSON: undefined');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const keys = Object.keys(value).sort(cmpCodePoints);
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}

// Python sorts keys by code point; JS default sort is by UTF-16 unit. Same for BMP text.
function cmpCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Python's repr of a float is the shortest round-tripping string; JS's String() is too,
// but exponent formatting differs (1e-07 vs 1e-7). Events only contain integers today.
function pyFloatRepr(x: number): string {
  let s = String(x);
  if (!s.includes('e')) return s.includes('.') ? s : s + '.0';
  const m = /^(-?[\d.]+)e([+-])(\d+)$/.exec(s);
  if (!m) return s;
  const mant = m[1].includes('.') ? m[1] : m[1];
  return `${mant}e${m[2]}${m[3].padStart(2, '0')}`;
}

export function hashValue(value: any): string {
  return sha256Hex(canonical(value));
}

export function eventHash(ev: Record<string, any>): string {
  const { hash: _h, ...body } = ev;
  return hashValue(body);
}
