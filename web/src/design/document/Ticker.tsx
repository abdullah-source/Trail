import { useEffect, useRef, useState } from 'react';
import { cx } from './cx';
import { whenVisible } from './motion';

export type TickerProps = {
  /** the live count, e.g. waitlist sign-ups; update it and the reels roll */
  value: number;
  /** what is being counted, read with the number: "students on the waitlist" */
  label: string;
  /** show the pulsing LIVE marker */
  live?: boolean;
  /** css font-size of the numerals (default 2.5rem) */
  size?: string;
  /** roll up from zero the first time it is seen (default true) */
  countUp?: boolean;
  className?: string;
};

/** Odometer digits: each place is a reel 0–9 that rolls to the new value (900 ms, staggered). */
export function Ticker({ value, label, live, size, countUp = true, className }: TickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(countUp ? 0 : value);
  const [seen, setSeen] = useState(!countUp);
  useEffect(() => {
    if (seen || !ref.current) return;
    return whenVisible(ref.current, () => setSeen(true));
  }, [seen]);
  useEffect(() => {
    if (seen) setShown(value);
  }, [seen, value]);
  const target = Math.max(0, Math.round(value)).toLocaleString('en-US');
  const now = String(Math.max(0, Math.round(shown))).padStart(target.replace(/,/g, '').length, '0');
  let di = 0;
  return (
    <span ref={ref} className={cx('ticker', className)} data-ticker="" data-value={Math.round(value)} style={size ? ({ '--ticker-size': size } as React.CSSProperties) : undefined}>
      <span className="ticker-num" aria-hidden="true">
        {target.split('').map((ch, i) => {
          if (ch === ',') return <span key={`s${i}`} className="ticker-sep" />;
          const d = Number(now[di]);
          const k = di++;
          return (
            <span key={`d${i}`} className="ticker-col">
              <span className="ticker-reel" style={{ '--d': d, '--k': k } as React.CSSProperties}>
                {Array.from({ length: 10 }, (_, n) => (
                  <span key={n}>{n}</span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
      <span className="sr-only" aria-live="polite">
        {target} {label}
      </span>
      {live && <span className="eyebrow ticker-live">Live</span>}
    </span>
  );
}

/** For static pages: roll an existing Ticker's reels to `value` (same digit count). */
export function setTickerValue(el: HTMLElement, value: number) {
  const reels = Array.from(el.querySelectorAll<HTMLElement>('.ticker-reel'));
  const s = String(Math.max(0, Math.round(value))).padStart(reels.length, '0').slice(-reels.length);
  reels.forEach((r, i) => r.style.setProperty('--d', s[i]));
  const sr = el.querySelector('.sr-only');
  if (sr) sr.textContent = `${Math.round(value).toLocaleString('en-US')} ${(sr.textContent || '').replace(/^[\d,]+\s*/, '')}`;
}
