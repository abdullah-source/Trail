/* StatTile, Chip, Swatch, Info: the small parts of a record page. */
import { useId, useState, type ReactNode } from 'react';
import { cx } from './cx';

/** A small "?" that shows one sentence on hover, focus or tap. */
export function Info({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className={cx(className)} style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
      <button
        type="button"
        aria-label="What is this?"
        aria-describedby={id}
        aria-expanded={open}
        className="btn btn-sm"
        style={{ width: 18, height: 18, padding: 0, fontSize: 11 }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      <span role="tooltip" id={id} className="dialog" style={{ display: open ? 'block' : 'none', position: 'absolute', left: 0, top: '100%', zIndex: 30, width: 240, padding: '8px 12px', margin: '8px 0 0', fontSize: '0.75rem', lineHeight: 1.5, fontFamily: 'var(--font-sans)', textTransform: 'none', letterSpacing: 0, textAlign: 'left' }}>
        {text}
      </span>
    </span>
  );
}

export type StatTileProps = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: 'typed' | 'paste' | 'accent';
  info?: string;
  className?: string;
};

/** A bevelled tile: mono caps label, display value on a paper plate (so tone colours keep AA), mono detail. */
export function StatTile({ label, value, detail, tone, info, className }: StatTileProps) {
  return (
    <div className={cx('stat on-chrome', className)}>
      <span className="marginal" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {label}
        {info && <Info text={info} />}
      </span>
      <span className="stat-value" style={tone ? { color: `var(--${tone})` } : undefined}>
        {value}
      </span>
      {detail && <span className="stat-detail">{detail}</span>}
    </div>
  );
}

export type ChipKind = 'typed' | 'pasted' | 'paste' | 'pasted-edited' | 'ai' | 'mixed' | 'unobserved' | 'neutral' | 'accent' | 'web' | 'self' | 'internal' | 'search' | 'unknown';
const chipClass: Partial<Record<ChipKind, string>> = { typed: 'chip-typed', pasted: 'chip-paste', paste: 'chip-paste', 'pasted-edited': 'chip-paste', ai: 'chip-ai', mixed: 'chip-mixed', unobserved: 'chip-unobserved', accent: 'chip-accent' };

/** A framed mono tag on a paper plate: a paste's source, a plan, a status. */
export function Chip({ kind = 'neutral', children, className }: { kind?: ChipKind | string; children: ReactNode; className?: string }) {
  return <span className={cx('chip', chipClass[kind as ChipKind] ?? 'chip-neutral', className)}>{children}</span>;
}

export function Swatch({ kind, className }: { kind: 'typed' | 'paste' | 'pasted' | 'pasted-edited' | 'mixed' | 'unobserved'; className?: string }) {
  const bg = { typed: 'var(--typed)', paste: 'var(--paste)', pasted: 'var(--paste)', 'pasted-edited': 'var(--paste-wash)', mixed: 'var(--mixed)', unobserved: 'var(--unobserved)' }[kind];
  return <i aria-hidden className={cx('swatch', className)} style={{ background: bg }} />;
}

export default StatTile;
