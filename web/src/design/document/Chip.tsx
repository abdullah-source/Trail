import type { ReactNode } from 'react';
import { cx } from './cx';

/** Provenance first; the rest map onto it. Names match the desktop kit's ChipKind. */
export type ChipKind =
  | 'typed'
  | 'pasted'
  | 'paste'
  | 'pasted-edited'
  | 'ai'
  | 'signed'
  | 'mixed'
  | 'unobserved'
  | 'neutral'
  | 'accent'
  | 'web'
  | 'self'
  | 'internal'
  | 'search'
  | 'unknown'
  | 'seal'
  | 'guilloche';

/** A mono caps pill with a provenance dot. Colour is never the only signal: the words carry it. */
export function Chip({ kind = 'neutral', plain, className, children, title }: { kind?: ChipKind; plain?: boolean; className?: string; children: ReactNode; title?: string }) {
  return (
    <span className={cx('chip', `chip-${kind}`, className)} data-plain={plain ? '' : undefined} title={title}>
      {children}
    </span>
  );
}

const SWATCH: Partial<Record<ChipKind, string>> = {
  typed: 'var(--typed)',
  pasted: 'var(--paste)',
  paste: 'var(--paste)',
  'pasted-edited': 'var(--paste-wash)',
  ai: 'var(--paste)',
  signed: 'var(--signed)',
  accent: 'var(--signed)',
  mixed: 'var(--mixed)',
  unobserved: 'var(--unobserved)',
  seal: 'var(--seal)',
  guilloche: 'var(--guilloche)',
};

/** A legend dot. */
export function Swatch({ kind, className }: { kind: ChipKind; className?: string }) {
  return <span aria-hidden="true" className={cx('swatch', className)} style={{ background: SWATCH[kind] ?? 'var(--ink-soft)' }} />;
}
