import type { CSSProperties } from 'react';
import { cx } from './cx';

export type MicroprintEdge = 'top' | 'right' | 'bottom' | 'left';

export type MicroprintProps = {
  /** the record's hashes; joined with " · " and repeated along each edge */
  text: string | string[];
  edges?: MicroprintEdge[] | 'all';
  /** px; 5.5 by default (deliberately below reading size: it is a security feature, not copy) */
  size?: number;
  /** px from the edge; 0.5 sits it in a framed Note's 6 px gutter */
  inset?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * Hashes engraved as microprint along the edges of the positioned parent. Decorative and
 * aria-hidden: always show the hash somewhere readable too (the Certificate's footer does).
 */
export function Microprint({ text, edges = 'all', size, inset, className, style }: MicroprintProps) {
  const line = (Array.isArray(text) ? text : [text]).filter(Boolean).join('  ·  ');
  const run = `${line}  ·  `.repeat(Math.max(4, Math.ceil(3200 / Math.max(1, line.length * 3.4))));
  const list: MicroprintEdge[] = edges === 'all' ? ['top', 'right', 'bottom', 'left'] : edges;
  const vars = { ...(size != null && { '--mp-size': `${size}px` }), ...(inset != null && { '--mp-inset': `${inset}px` }), ...style } as CSSProperties;
  return (
    <div className={cx('microprint-layer', className)} aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...vars }}>
      {list.map((e) => (
        <span key={e} className="microprint-edge" data-edge={e}>
          {run}
        </span>
      ))}
    </div>
  );
}
