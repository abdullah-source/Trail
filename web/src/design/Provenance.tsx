import type { ReactNode } from 'react';
import { Badge, cx } from './components';

/*
 * Provenance: "where each line came from" strip + paste list.
 * Structurally compatible with lib/types LineProvenance and PasteItem, but
 * typed here so the component has no dependency on engineering code.
 */

export type ProvenanceLabel = 'typed' | 'pasted' | 'pasted-edited' | 'mixed' | 'unobserved';
export type ProvenanceLine = { index: number; label: ProvenanceLabel; text?: string };
export type ProvenancePaste = {
  ts: string;
  chars: number;
  source_kind: string;
  source_host: string | null;
  from_self?: boolean;
  surviving_ratio: number;
};

const LABELS: { key: ProvenanceLabel; name: string; cls: string }[] = [
  { key: 'typed', name: 'typed', cls: 'bg-typed' },
  { key: 'pasted', name: 'pasted', cls: 'bg-paste' },
  { key: 'pasted-edited', name: 'pasted, then edited', cls: 'bg-paste/55' },
  { key: 'mixed', name: 'mixed', cls: 'bg-mixed' },
  { key: 'unobserved', name: 'unobserved', cls: 'bg-unobserved' },
];
const bg = Object.fromEntries(LABELS.map((l) => [l.key, l.cls])) as Record<ProvenanceLabel, string>;

export function Swatch({ label, className }: { label: ProvenanceLabel; className?: string }) {
  return <i aria-hidden className={cx('inline-block w-2.5 h-2.5 rounded-[2px] align-[-1px]', bg[label], className)} />;
}

/** One cell per line, in reading order. */
export function ProvenanceStrip({ lines, className }: { lines: ProvenanceLine[]; className?: string }) {
  const counts = {} as Record<ProvenanceLabel, number>;
  for (const l of lines) counts[l.label] = (counts[l.label] || 0) + 1;
  const summary = LABELS.filter((l) => counts[l.key]).map((l) => `${counts[l.key]} ${l.name}`).join(', ');
  return (
    <div className={cx('grid gap-2', className)}>
      <div className="flex h-4 rounded-sm overflow-hidden border border-rule gap-px bg-rule" role="img" aria-label={`Where each line came from: ${summary || 'no lines'}`}>
        {lines.map((l) => (
          <span key={l.index} className={cx('flex-1 min-w-[2px]', bg[l.label] || 'bg-unobserved')} title={`Line ${l.index + 1}: ${l.label}${l.text ? ` — ${l.text.slice(0, 60)}` : ''}`} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft tabular">
        {LABELS.filter((l) => l.key !== 'unobserved' || counts.unobserved).map((l) => (
          <li key={l.key}>
            <Swatch label={l.key} className="mr-1.5" />
            {l.name} {counts[l.key] || 0}
          </li>
        ))}
      </ul>
    </div>
  );
}

const when = (ts: string) => ts.slice(0, 16).replace('T', ' ');
const pct = (r: number) => `${Math.round(r * 100)}%`;
const kindOf = (p: ProvenancePaste): 'ai' | 'pasted' | 'neutral' => (p.source_kind === 'ai' ? 'ai' : p.source_kind === 'web' ? 'pasted' : 'neutral');

/** Every paste, oldest first: when, how much, where from, how much survived. */
export function PasteList({ pastes, limit = 40, className, empty = 'No pastes recorded.' }: { pastes: ProvenancePaste[]; limit?: number; className?: string; empty?: ReactNode }) {
  if (!pastes.length) return <p className={cx('text-sm text-ink-soft', className)}>{empty}</p>;
  return (
    <div className={cx('overflow-x-auto', className)}>
      <table className="w-full text-sm border-collapse min-w-[28rem]">
        <thead>
          <tr className="text-left marginal">
            <th className="font-normal py-2 pr-3">When</th>
            <th className="font-normal py-2 pr-3 text-right">Chars</th>
            <th className="font-normal py-2 pr-3">Source</th>
            <th className="font-normal py-2 pr-3">From</th>
            <th className="font-normal py-2 text-right">Still in text</th>
          </tr>
        </thead>
        <tbody>
          {pastes.slice(0, limit).map((p, i) => (
            <tr key={i} className="border-t border-rule align-top">
              <td className="py-2 pr-3 font-mono text-xs text-ink-soft whitespace-nowrap">{when(p.ts)}</td>
              <td className="py-2 pr-3 text-right tabular">{p.chars.toLocaleString()}</td>
              <td className="py-2 pr-3">
                <Badge kind={kindOf(p)}>{p.source_kind}</Badge>
              </td>
              <td className="py-2 pr-3 break-all">{p.source_host || (p.from_self ? 'this document' : 'unknown')}</td>
              <td className="py-2 text-right tabular">
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden className="inline-block w-12 h-1.5 rounded-sm bg-rule overflow-hidden">
                    <span className="block h-full bg-paste" style={{ width: pct(p.surviving_ratio) }} />
                  </span>
                  {pct(p.surviving_ratio)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {pastes.length > limit && <p className="text-xs text-ink-soft mt-2">Showing {limit} of {pastes.length} pastes.</p>}
    </div>
  );
}

/** Strip + list together, as in the evidence pack. */
export function Provenance({ lines, pastes, className }: { lines: ProvenanceLine[]; pastes: ProvenancePaste[]; className?: string }) {
  return (
    <div className={cx('grid gap-6', className)}>
      <div className="grid gap-3">
        <h3 className="text-xl">Where each line came from</h3>
        <ProvenanceStrip lines={lines} />
      </div>
      <div className="grid gap-3">
        <h3 className="text-xl">Pastes</h3>
        <PasteList pastes={pastes} />
      </div>
    </div>
  );
}

export default Provenance;
