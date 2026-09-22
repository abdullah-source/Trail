// Parity test: the TypeScript analysis must match the Python reference exactly on every
// numeric field, line label, draft, declaration and pattern number, across 20+ fixtures
// covering every writer profile (DECISIONS §8.2). Regenerate fixtures with `pnpm fixtures`.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { analyse, declaration, drafts, editIndices, lines, patterns, replayTo, Replayer } from './analysis';
import { canonical, eventHash } from './canonical';
import { pyFormatFixed, pyRound, pstdev, quantiles } from './pyfloat';
import { sha256Hex } from './sha256';
import type { Analysis, TrailEvent } from './types';

const DIR = join(__dirname, 'fixtures');
const names: string[] = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8'));
const load = (n: string) => JSON.parse(readFileSync(join(DIR, `${n}.json`), 'utf8'));

describe('python primitives', () => {
  it('rounds like CPython (ties to even on the exact binary value)', () => {
    expect(pyRound(0.125, 2)).toBe(0.12);
    expect(pyRound(0.375, 2)).toBe(0.38);
    expect(pyRound(2.5, 0)).toBe(2);
    expect(pyRound(3.5, 0)).toBe(4);
    expect(pyRound(2.675, 2)).toBe(2.67); // binary 2.675 is below the tie
    expect(pyFormatFixed(0.5, 0)).toBe('0');
    expect(pyFormatFixed(1.05, 1)).toBe('1.1'); // 1.05 is slightly above in binary
    expect(pyFormatFixed(12, 1)).toBe('12.0');
  });
  it('matches statistics.pstdev and quantiles', () => {
    expect(pstdev([1, 2, 3, 4])).toBe(1.118033988749895);
    expect(pstdev([100, 150, 150, 200])).toBe(35.35533905932738);
    expect(quantiles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual([2.75, 5.5, 8.25]);
  });
  it('hashes like hashlib and canonical.py', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(canonical({ b: 1, a: [true, null, 'é'] })).toBe('{"a":[true,null,"é"],"b":1}');
  });
});

describe('analysis parity with trail/analysis.py', () => {
  expect(names.length).toBeGreaterThanOrEqual(20);
  for (const name of names) {
    it(name, () => {
      const fx = load(name);
      const events: TrailEvent[] = fx.events;
      // Every event hash recomputes byte-identically (chain.js / canonical.py parity).
      for (const ev of events) expect(eventHash(ev)).toBe(ev.hash);

      const a = analyse(events);
      expect(a).toStrictEqual(fx.analysis as Analysis);

      expect(lines(events)).toStrictEqual(fx.lines);
      expect(drafts(events)).toStrictEqual(fx.drafts);
      expect(declaration(a, { student: 'A. Student', course: 'PHIL101 · Essay 2' })).toBe(fx.declaration);
      expect(declaration(a)).toBe(fx.declaration_plain);

      // Replay helpers agree with the full replay and with each other.
      const idx = editIndices(events);
      expect(replayTo(events, events.length)).toBe(lines(events).map((l) => l.text).join('\n'));
      const rp = new Replayer(events);
      rp.seek(idx[idx.length - 1]);
      expect(rp.text).toBe(replayTo(events, idx[idx.length - 1]));
    });
  }

  it('patterns across all fixtures', () => {
    const px = JSON.parse(readFileSync(join(DIR, 'patterns.json'), 'utf8'));
    const analyses = (px.names as string[]).map((n) => analyse(load(n).events));
    expect(patterns(analyses)).toStrictEqual(px.patterns);
  });

  it('fixture set covers every writer profile', () => {
    const profiles = new Set(readdirSync(DIR).filter((f) => f.endsWith('.json') && !['index.json', 'patterns.json'].includes(f)).map((f) => load(f.replace('.json', '')).profile));
    expect([...profiles].sort()).toEqual(['autotyper', 'gapped', 'heavy_paster', 'honest', 'jittered_bot', 'mixed']);
  });
});
