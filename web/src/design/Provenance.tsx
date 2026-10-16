import type { ReactNode } from 'react';
import { Chip, cx, Swatch as KitSwatch } from './document';

/*
 * Provenance: "where each line came from" strip + paste list, on the security-document kit.
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
  { key: 'typed', name: 'typed', cls: 'is-typed' },
  { key: 'pasted', name: 'pasted', cls: 'is-pasted' },
  { key: 'pasted-edited', name: 'pasted, then edited', cls: 'is-pasted-edited' },
  { key: 'mixed', name: 'mixed', cls: 'is-mixed' },
  { key: 'unobserved', name: 'unobserved', cls: 'is-unobserved' },
];
const cell = Object.fromEntries(LABELS.map((l) => [l.key, l.cls])) as Record<ProvenanceLabel, string>;

export function Swatch({ label, className }: { label: ProvenanceLabel; className?: string }) {
  return <KitSwatch kind={label} className={className} />;
}

/** One cell per line, in reading order. `animate` is accepted for old callers; the strip no
 *  longer animates (DESIGN-document.md §6 keeps motion to the reveal, the dots, the seal and the drift). */
export function ProvenanceStrip({ lines, className }: { lines: ProvenanceLine[]; className?: string; animate?: boolean }) {
  const counts = {} as Record<ProvenanceLabel, number>;
  for (const l of lines) counts[l.label] = (counts[l.label] || 0) + 1;
  const summary = LABELS.filter((l) => counts[l.key]).map((l) => `${counts[l.key]} ${l.name}`).join(', ');
  return (
    <div className={cx('grid gap-2', className)}>
      <div className="prov-strip" role="img" aria-label={`Where each line came from: ${summary || 'no lines'}`}>
        {lines.map((l) => (
          <span key={l.index} className={cell[l.label] || 'is-unobserved'} title={`Line ${l.index + 1}: ${l.label}${l.text ? ` — ${l.text.slice(0, 60)}` : ''}`} />
        ))}
      </div>
      <ul className="mk-legend tabular">
        {LABELS.filter((l) => l.key !== 'unobserved' || counts.unobserved).map((l) => (
          <li key={l.key}>
            <Swatch label={l.key} />
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


/** Every paste, oldest first: when, how much, where from, how much survived. A table in a scrolling well. */
export function PasteList({ pastes, limit = 40, className, empty = 'No pastes recorded.' }: { pastes: ProvenancePaste[]; limit?: number; className?: string; empty?: ReactNode }) {
  if (!pastes.length) return <p className={cx('text-sm text-ink-soft', className)}>{empty}</p>;
  return (
    <div className={cx('grid gap-2', className)}>
      <div className="scroll" role="region" aria-label="Pastes" tabIndex={0}>
        <table className="mk-table font-mono text-[13px] whitespace-nowrap min-w-[30rem]">
          <thead>
            <tr>
              <th>When</th>
              <th className="text-right">Chars</th>
              <th>Source</th>
              <th>From</th>
              <th className="text-right">Still in text</th>
            </tr>
          </thead>
          <tbody>
            {pastes.slice(0, limit).map((p, i) => (
              <tr key={i}>
                <td className="text-ink-soft">{when(p.ts)}</td>
                <td className="text-right tabular">{p.chars.toLocaleString()}</td>
                <td>
                  <Chip kind={kindOf(p)}>{p.source_kind}</Chip>
                </td>
                <td className="whitespace-normal [overflow-wrap:anywhere] min-w-[9rem]">{p.source_host || (p.from_self ? 'this document' : 'unknown')}</td>
                <td className="text-right tabular">
                  <span className="inline-flex items-center gap-2 justify-end">
                    <span className="progress progress-paste w-14" role="img" aria-label={`${pct(p.surviving_ratio)} still in text`} style={{ ['--p' as string]: p.surviving_ratio }}>
                      <span className="progress-fill" />
                    </span>
                    {pct(p.surviving_ratio)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pastes.length > limit && (
        <p className="text-xs text-ink-soft">
          Showing {limit} of {pastes.length} pastes.
        </p>
      )}
    </div>
  );
}

/** Strip + list together, as in the evidence pack. */
export function Provenance({ lines, pastes, className }: { lines: ProvenanceLine[]; pastes: ProvenancePaste[]; className?: string; animate?: boolean }) {
  return (
    <div className={cx('grid gap-6', className)}>
      <div className="grid gap-3">
        <h3 className="note-title">Where each line came from</h3>
        <ProvenanceStrip lines={lines} />
      </div>
      <div className="grid gap-3">
        <h3 className="note-title">Pastes</h3>
        <PasteList pastes={pastes} />
      </div>
    </div>
  );
}

export default Provenance;
