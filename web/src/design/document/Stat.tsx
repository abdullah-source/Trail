import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cx } from './cx';

/** The "?" affordance: a tooltip on hover and focus, a toggle on tap. Escape closes it. */
export function Info({ text, label = 'What this means', className }: { text: ReactNode; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);
  return (
    <span ref={ref} className={cx('info', className)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="info-btn" aria-label={label} aria-expanded={open} aria-describedby={open ? id : undefined} onClick={() => setOpen((o) => !o)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
        ?
      </button>
      <span id={id} role="tooltip" className="info-pop" hidden={!open}>
        {text}
      </span>
    </span>
  );
}

export type StatTone = 'typed' | 'paste' | 'signed' | 'accent';

export type StatProps = {
  label: ReactNode;
  value: ReactNode;
  /** small unit after the numeral: "%", "min" */
  unit?: ReactNode;
  detail?: ReactNode;
  tone?: StatTone;
  /** explanation behind a "?" next to the label */
  info?: string;
  /** 0–1: a 3 px bar under the value */
  bar?: number;
  className?: string;
};

/** Big expanded numerals, banknote style; mono caps label; mono detail. */
export function Stat({ label, value, unit, detail, tone, info, bar, className }: StatProps) {
  return (
    <div className={cx('stat', className)} data-tone={tone}>
      <div className="stat-label">
        <span className="eyebrow">{label}</span>
        {info && <Info text={info} />}
      </div>
      <div className="stat-value">
        {value}
        {unit != null && <span className="stat-unit">{unit}</span>}
      </div>
      {bar != null && (
        <div className="stat-bar" aria-hidden="true" style={{ ['--p' as string]: Math.min(1, Math.max(0, bar)) }}>
          <i />
        </div>
      )}
      {detail != null && <div className="stat-detail">{detail}</div>}
    </div>
  );
}
/** Alias for callers of the desktop kit. */
export const StatTile = Stat;
