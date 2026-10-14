import { useEffect, useRef, type ReactNode } from 'react';
import { Chip, cx, ProgressBar, ScrollArea, Swatch as KitSwatch } from './desktop';
import { usePrefersReducedMotion } from './motion';

/*
 * Provenance: "where each line came from" strip + paste list, on the desktop kit.
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

/** One cell per line, in reading order. With `animate`, the cells light up left to right once when scrolled into view. */
export function ProvenanceStrip({ lines, className, animate = false }: { lines: ProvenanceLine[]; className?: string; animate?: boolean }) {
  const reduced = usePrefersReducedMotion();
  const bar = useRef<HTMLDivElement>(null);
  const counts = {} as Record<ProvenanceLabel, number>;
  for (const l of lines) counts[l.label] = (counts[l.label] || 0) + 1;
  const summary = LABELS.filter((l) => counts[l.key]).map((l) => `${counts[l.key]} ${l.name}`).join(', ');
  const lit = animate && !reduced;

  // The one-time light-up: Web Animations, so it needs no stylesheet and respects reduced motion.
  useEffect(() => {
    const el = bar.current;
    if (!lit || !el || typeof IntersectionObserver === 'undefined') return;
    const cells = Array.from(el.children) as HTMLElement[];
    if (!cells.length) return;
    const step = Math.min(60, 900 / cells.length);
    // Visible at rest (crawlers, print and full-page captures see the whole strip); the
    // left-to-right pass plays from the dim keyframe once the strip scrolls into view.
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        cells.forEach((c, i) => {
          if (typeof c.animate === 'function') c.animate([{ opacity: 0.18 }, { opacity: 1 }], { duration: 350, delay: i * step, fill: 'backwards', easing: 'steps(3, end)' });
        });
      },
      { rootMargin: '-10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [lit, lines.length]);

  return (
    <div className={cx('grid gap-2', className)}>
      <div ref={bar} className="prov-strip" role="img" aria-label={`Where each line came from: ${summary || 'no lines'}`}>
        {lines.map((l) => (
          <span key={l.index} className={cell[l.label] || 'is-unobserved'} title={`Line ${l.index + 1}: ${l.label}${l.text ? ` — ${l.text.slice(0, 60)}` : ''}`} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-ink-soft tabular">
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

const th = 'marginal font-normal text-left py-1.5 px-2.5 border-b border-rule whitespace-nowrap';
const td = 'py-1.5 px-2.5 border-b border-rule align-top';

/** Every paste, oldest first: when, how much, where from, how much survived. A table in a scrolling well. */
export function PasteList({ pastes, limit = 40, className, empty = 'No pastes recorded.' }: { pastes: ProvenancePaste[]; limit?: number; className?: string; empty?: ReactNode }) {
  if (!pastes.length) return <p className={cx('text-sm text-ink-soft', className)}>{empty}</p>;
  return (
    <div className={cx('grid gap-2', className)}>
      <ScrollArea label="Pastes">
        <table className="w-full border-collapse font-mono text-[13px] whitespace-nowrap min-w-[30rem]">
          <thead>
            <tr>
              <th className={th}>When</th>
              <th className={cx(th, 'text-right')}>Chars</th>
              <th className={th}>Source</th>
              <th className={th}>From</th>
              <th className={cx(th, 'text-right')}>Still in text</th>
            </tr>
          </thead>
          <tbody>
            {pastes.slice(0, limit).map((p, i) => (
              <tr key={i}>
                <td className={cx(td, 'text-ink-soft')}>{when(p.ts)}</td>
                <td className={cx(td, 'text-right tabular')}>{p.chars.toLocaleString()}</td>
                <td className={td}>
                  <Chip kind={kindOf(p)}>{p.source_kind}</Chip>
                </td>
                <td className={cx(td, 'whitespace-normal [overflow-wrap:anywhere]')}>{p.source_host || (p.from_self ? 'this document' : 'unknown')}</td>
                <td className={cx(td, 'text-right tabular')}>
                  <span className="inline-flex items-center gap-2 justify-end">
                    <ProgressBar value={p.surviving_ratio} tone="paste" segments={6} label={`${pct(p.surviving_ratio)} still in text`} />
                    {pct(p.surviving_ratio)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      {pastes.length > limit && (
        <p className="text-xs text-ink-soft">
          Showing {limit} of {pastes.length} pastes.
        </p>
      )}
    </div>
  );
}

/** Strip + list together, as in the evidence pack. */
export function Provenance({ lines, pastes, className, animate }: { lines: ProvenanceLine[]; pastes: ProvenancePaste[]; className?: string; animate?: boolean }) {
  return (
    <div className={cx('grid gap-6', className)}>
      <div className="grid gap-3">
        <h3 className="text-xl">Where each line came from</h3>
        <ProvenanceStrip lines={lines} animate={animate} />
      </div>
      <div className="grid gap-3">
        <h3 className="text-xl">Pastes</h3>
        <PasteList pastes={pastes} />
      </div>
    </div>
  );
}

export default Provenance;
