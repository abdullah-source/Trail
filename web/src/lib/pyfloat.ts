// Exact ports of the CPython float/statistics behaviour the analysis relies on, so that
// analysis.ts produces bit-identical numbers to trail/analysis.py (see the parity test).

/** Python's round(x, n) / format(x, ".nf"): correctly rounded on the exact binary value,
 *  ties to even. Returns the decimal string. */
export function pyFormatFixed(x: number, n: number): string {
  if (!Number.isFinite(x)) return String(x);
  const neg = x < 0 || Object.is(x, -0);
  const ax = Math.abs(x);
  // 60 digits is enough to expose an exact tie for any value the analysis produces.
  const exact = ax.toFixed(Math.min(100, n + 60));
  const dot = exact.indexOf('.');
  const intPart = exact.slice(0, dot);
  const frac = exact.slice(dot + 1);
  const kept = frac.slice(0, n);
  const rest = frac.slice(n);
  let digits = intPart + kept; // decimal digits, implicit point n from the right
  const isTie = rest[0] === '5' && /^0*$/.test(rest.slice(1));
  let roundUp: boolean;
  if (isTie) {
    const last = Number(digits[digits.length - 1]);
    roundUp = last % 2 === 1;
  } else {
    roundUp = Number(rest[0]) >= 5;
  }
  if (roundUp) digits = incDigits(digits);
  const ip = n === 0 ? digits : digits.slice(0, digits.length - n) || '0';
  const fp = n === 0 ? '' : digits.slice(digits.length - n);
  const s = n === 0 ? ip : `${ip}.${fp}`;
  return neg ? `-${s}` : s;
}

function incDigits(d: string): string {
  const arr = d.split('');
  let i = arr.length - 1;
  while (i >= 0) {
    if (arr[i] === '9') {
      arr[i] = '0';
      i -= 1;
    } else {
      arr[i] = String(Number(arr[i]) + 1);
      return arr.join('');
    }
  }
  return '1' + arr.join('');
}

/** Python round(x, n) returning a float. */
export function pyRound(x: number, n: number): number {
  if (!Number.isFinite(x)) return x;
  return Number(pyFormatFixed(x, n));
}

/** Python round(x) with no ndigits: returns an int (ties to even). */
export function pyRoundInt(x: number): number {
  return Number(pyFormatFixed(x, 0));
}

/** Python f"{x:,}" for integers. */
export function pyThousands(x: number): string {
  const s = String(Math.trunc(x));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Python f"{x:.1%}" */
export function pyPercent1(x: number): string {
  return pyFormatFixed(x * 100, 1) + '%';
}

/** statistics.median for a list of numbers. */
export function median(data: number[]): number {
  const d = [...data].sort((a, b) => a - b);
  const n = d.length;
  if (n === 0) throw new Error('median of empty');
  const i = Math.floor(n / 2);
  return n % 2 === 1 ? d[i] : (d[i - 1] + d[i]) / 2;
}

/** statistics.mean for integers: exact sum then one correctly rounded division. */
export function mean(data: number[]): number {
  let s = 0n;
  for (const x of data) s += BigInt(x);
  return bigDiv(s, BigInt(data.length));
}

/** statistics.pstdev for integers, correctly rounded exactly as CPython does it. */
export function pstdev(data: number[]): number {
  const n = BigInt(data.length);
  let sx = 0n;
  let sxx = 0n;
  for (const x of data) {
    const b = BigInt(x);
    sx += b;
    sxx += b * b;
  }
  // ssd = (n*sxx - sx*sx) / n ; mss = ssd / n  => mss = (n*sxx - sx*sx) / n^2, reduced.
  let num = n * sxx - sx * sx;
  let den = n * n;
  const g = gcd(num, den);
  if (g > 1n) {
    num /= g;
    den /= g;
  }
  return floatSqrtOfFrac(num, den);
}

const SQRT_BIT_WIDTH = 109;

function floatSqrtOfFrac(n: bigint, m: bigint): number {
  const q = floorDiv(bitLength(n) - bitLength(m) - SQRT_BIT_WIDTH, 2);
  let numerator: bigint;
  let denominator: bigint;
  if (q >= 0) {
    numerator = isqrtFracRto(n, m << BigInt(2 * q)) << BigInt(q);
    denominator = 1n;
  } else {
    numerator = isqrtFracRto(n << BigInt(-2 * q), m);
    denominator = 1n << BigInt(-q);
  }
  return bigDiv(numerator, denominator);
}

function isqrtFracRto(n: bigint, m: bigint): bigint {
  const a = isqrt(n / m);
  return a | (a * a * m !== n ? 1n : 0n);
}

function isqrt(n: bigint): bigint {
  if (n < 0n) throw new Error('isqrt of negative');
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  // Newton refinement to the exact floor.
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) break;
    x = y;
  }
  while (x * x > n) x -= 1n;
  while ((x + 1n) * (x + 1n) <= n) x += 1n;
  return x;
}

function bitLength(n: bigint): number {
  if (n < 0n) n = -n;
  return n === 0n ? 0 : n.toString(2).length;
}

function floorDiv(a: number, b: number): number {
  return Math.floor(a / b);
}

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Correctly rounded conversion of a rational num/den to double (Python int / int). */
export function bigDiv(num: bigint, den: bigint): number {
  if (den === 0n) throw new Error('division by zero');
  const neg = (num < 0n) !== (den < 0n);
  if (num < 0n) num = -num;
  if (den < 0n) den = -den;
  if (num === 0n) return neg ? -0 : 0;
  // Fast path: both exactly representable.
  if (num < 9007199254740992n && den < 9007199254740992n) {
    const r = Number(num) / Number(den);
    return neg ? -r : r;
  }
  // Scale so the quotient has 55+ significant bits, then round half to even.
  const shift = 64 + bitLength(den) - bitLength(num);
  let q: bigint;
  let r: bigint;
  if (shift >= 0) {
    q = (num << BigInt(shift)) / den;
    r = (num << BigInt(shift)) % den;
  } else {
    q = num / (den << BigInt(-shift));
    r = num % (den << BigInt(-shift));
  }
  // q has ~64 bits; keep 53 bits with sticky rounding.
  const extra = bitLength(q) - 53;
  let mant = q;
  let sticky = r !== 0n;
  let roundBit = false;
  if (extra > 0) {
    const mask = (1n << BigInt(extra)) - 1n;
    const low = q & mask;
    mant = q >> BigInt(extra);
    roundBit = (low >> BigInt(extra - 1)) === 1n;
    sticky = sticky || (low & ((1n << BigInt(extra - 1)) - 1n)) !== 0n;
    if (roundBit && (sticky || (mant & 1n) === 1n)) mant += 1n;
  }
  const exp = (extra > 0 ? extra : 0) - shift;
  const res = Number(mant) * Math.pow(2, exp);
  return neg ? -res : res;
}

/** statistics.quantiles(data, n=4, method='exclusive') */
export function quantiles(data: number[], n = 4): number[] {
  const d = [...data].sort((a, b) => a - b);
  const ld = d.length;
  if (ld < 2) {
    if (ld === 1) return Array(n - 1).fill(d[0]);
    throw new Error('quantiles: need at least one data point');
  }
  const m = ld + 1;
  const out: number[] = [];
  for (let i = 1; i < n; i++) {
    let j = Math.floor((i * m) / n);
    j = j < 1 ? 1 : j > ld - 1 ? ld - 1 : j;
    const delta = i * m - j * n;
    out.push((d[j - 1] * (n - delta) + d[j] * delta) / n);
  }
  return out;
}

/** Python str.split() with no arguments: split on runs of whitespace, drop empties. */
export function pySplitWords(text: string): string[] {
  return text.split(/[\s\x1c-\x1f\x85]+/u).filter(Boolean);
}
