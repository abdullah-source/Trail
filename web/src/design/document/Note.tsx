import { useId, type CSSProperties, type ReactNode } from 'react';
import { cx } from './cx';
import { Guilloche, type GuillocheProps } from './Guilloche';
import { Microprint } from './Microprint';
import { lobedRing } from './seal-engine';

/** "7f7bf4ea91…" → "7F7B·F4EA": the first 8 hex digits, grouped like a banknote serial. */
export function serialOf(hash: string): string {
  const h = hash.replace(/[^0-9a-f]/gi, '').slice(0, 8).toUpperCase().padEnd(8, '0');
  return `${h.slice(0, 4)}·${h.slice(4)}`;
}

/** The serial as printed: "Nº 7F7B·F4EA" in seal red mono. */
export function Serial({ value, tone, className }: { value: string; tone?: 'seal' | 'ink'; className?: string }) {
  return (
    <span className={cx('serial', className)} data-tone={tone === 'ink' ? 'ink' : undefined}>
      <span aria-hidden="true">Nº </span>
      <span className="sr-only">Serial </span>
      {value}
    </span>
  );
}

const WM_A = lobedRing(40, 12, 11);
const WM_B = lobedRing(28, 8, 7);

/** The hover watermark: an engraved rosette in guilloche green. */
export function Watermark({ className }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const a = `wm-${uid}-a`;
  const b = `wm-${uid}-b`;
  return (
    <svg className={cx('note-watermark', className)} viewBox="0 0 120 120" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={0.4}>
      <path id={a} d={WM_A} />
      {Array.from({ length: 9 }, (_, i) => (
        <use key={`a${i}`} href={`#${a}`} transform={`rotate(${((i + 1) * 360) / 110} 60 60)`} />
      ))}
      <path id={b} d={WM_B} />
      {Array.from({ length: 5 }, (_, i) => (
        <use key={`b${i}`} href={`#${b}`} transform={`rotate(${((i + 1) * 360) / 42} 60 60)`} />
      ))}
      <circle cx={60} cy={60} r={56} />
      <circle cx={60} cy={60} r={54.5} />
    </svg>
  );
}

export type NoteProps = {
  as?: 'div' | 'article' | 'section' | 'aside' | 'li';
  /** mono caps, top left */
  label?: ReactNode;
  /** printed top right as "Nº …"; pass the grouped value ("7F7B·F4EA") or use serialOf(hash) */
  serial?: string;
  /** top right instead of a serial: a status Chip, a small action */
  aside?: ReactNode;
  title?: ReactNode;
  titleAs?: 'h2' | 'h3' | 'h4' | 'p';
  /** printer's crop marks outside the corners (default true) */
  crop?: boolean;
  /** the banknote inner frame: a second hairline 6 px inside the edge */
  frame?: boolean;
  /** the rosette that surfaces on hover (default true) */
  watermark?: boolean;
  /** lift 2 px on hover; for cards that are links */
  lift?: boolean;
  /** a low-contrast guilloche behind the content */
  guilloche?: Partial<Pick<GuillocheProps, 'data' | 'variant' | 'tone' | 'intensity' | 'density'>> & { seed: string } | false;
  /** hashes engraved in the frame gutter (turns `frame` on) */
  microprint?: string | string[];
  tone?: 'seal';
  footer?: ReactNode;
  id?: string;
  className?: string;
  style?: CSSProperties;
  'aria-labelledby'?: string;
  children?: ReactNode;
};

/** A note: the document's card. Sheet, hairline, crop marks, an optional serial and watermark. */
export function Note({ as: Tag = 'div', label, serial, aside, title, titleAs: T = 'h3', crop = true, frame, watermark = true, lift, guilloche, microprint, tone, footer, id, className, style, children, ...aria }: NoteProps) {
  const framed = frame || !!microprint;
  const head = label != null || serial != null || aside != null;
  return (
    <Tag
      id={id}
      className={cx('note', className)}
      data-crop={crop ? '' : undefined}
      data-frame={framed ? '' : undefined}
      data-lift={lift ? '' : undefined}
      data-tone={tone}
      style={style}
      aria-labelledby={aria['aria-labelledby']}
    >
      {(guilloche || watermark) && (
        <div className="note-bg" aria-hidden="true">
          {guilloche && <Guilloche {...guilloche} variant={guilloche.variant ?? 'waves'} intensity={guilloche.intensity ?? 'card'} fill />}
          {watermark && <Watermark />}
        </div>
      )}
      {microprint && <Microprint text={microprint} inset={0.5} />}
      {head && (
        <div className="note-head">
          {label != null ? <span className="eyebrow">{label}</span> : <span />}
          {aside ?? (serial != null && <Serial value={serial} />)}
        </div>
      )}
      {title != null && <T className="note-title">{title}</T>}
      {children}
      {footer != null && <div className="note-foot">{footer}</div>}
    </Tag>
  );
}

export type CertificateProps = Omit<NoteProps, 'frame' | 'serial'> & {
  /** the record's hash; gives the serial, the microprint and the guilloche seed */
  hash: string;
  /** further hashes for the microprint (chain head, signature) */
  hashes?: string[];
  /** per-minute typing counts or any series: shapes this certificate's own guilloche */
  data?: number[];
};

/** A Note made into a certificate: framed, microprinted with its hashes, its own guilloche. */
export function Certificate({ hash, hashes = [], data, guilloche, microprint, ...rest }: CertificateProps) {
  return (
    <Note
      {...rest}
      frame
      serial={serialOf(hash)}
      microprint={microprint ?? [hash, ...hashes]}
      guilloche={guilloche === false ? false : { seed: hash, data, ...(guilloche || {}) }}
    />
  );
}
