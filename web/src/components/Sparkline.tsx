import { useMemo } from 'react';
import type { TimelineBucket } from '../lib/types';

/** Cumulative growth of a document over its timeline buckets, as a tiny inline SVG. */
export function Sparkline({ timeline, width = 96, height = 24, className }: { timeline: TimelineBucket[]; width?: number; height?: number; className?: string }) {
  const d = useMemo(() => {
    if (!timeline.length) return null;
    let acc = 0;
    const pts = timeline.map((b) => (acc += b.typed + b.pasted - b.deleted));
    const max = Math.max(1, ...pts);
    const n = pts.length;
    const x = (i: number) => (n === 1 ? width : (i / (n - 1)) * (width - 2) + 1);
    const y = (v: number) => height - 1 - (Math.max(0, v) / max) * (height - 2);
    const path = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const area = `${path} L${x(n - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`;
    return { path, area };
  }, [timeline, width, height]);
  if (!d) return <svg width={width} height={height} className={className} aria-hidden />;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <path d={d.area} fill="currentColor" opacity="0.12" />
      <path d={d.path} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Two-tone bar: typed share vs pasted share of the final text. */
export function ShareBar({ typed, className }: { typed: number | null; className?: string }) {
  const t = typed === null ? 0 : Math.max(0, Math.min(1, typed));
  return (
    <div className={`flex h-1.5 rounded-full overflow-hidden bg-rule ${className || ''}`} aria-hidden>
      <span className="bg-typed" style={{ width: `${t * 100}%` }} />
      <span className="bg-paste" style={{ width: `${(1 - t) * 100}%` }} />
    </div>
  );
}
