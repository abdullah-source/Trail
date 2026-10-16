import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { cx } from './cx';
import { circlePath, crackHalf, crackLine, lobedRing, mountSeal, scallopPath, type SealState } from './seal-engine';

export type { SealState };

export type SealProps = {
  state?: SealState;
  /** px (default 160) */
  size?: number;
  /** the microtext around the ring; a sensible line per state by default */
  ringText?: string;
  /** the accessible name; defaults to "Record verified" / "Checking record" / "Record altered" */
  label?: string;
  /** steer with the pointer over this element instead of the seal's parent */
  zone?: HTMLElement | null;
  /** follow device tilt on phones (iOS asks on first tap). Default true */
  orientation?: boolean;
  className?: string;
  style?: CSSProperties;
};

const RING: Record<SealState, string> = {
  verified: 'VERIFIED RECORD · SIGNATURE VALID · ',
  pending: 'CHECKING SIGNATURE · ONE MOMENT · ',
  broken: 'RECORD ALTERED · CHAIN BROKEN · ',
};
const NAME: Record<SealState, string> = { verified: 'Record verified', pending: 'Checking record', broken: 'Record altered: chain broken' };

const SCALLOP = scallopPath();
const RING_A = lobedRing(31, 6.5, 9);
const RING_B = lobedRing(31, 4, 13);
/** Whole phrases, repeated to fill the ring (~76 mono characters at this size). */
function fitRing(phrase: string): string {
  let out = phrase;
  while (out.length + phrase.length <= 80) out += phrase;
  return out;
}

const COPIES = Array.from({ length: 8 }, (_, i) => i);

/**
 * The verified seal. Foil (the only place foil is allowed) under engraved rosette lines and a
 * microtext ring; tilts and catches light with the pointer. `pending` is ink without foil with a
 * turning dashed ring; `broken` is seal red, cracked in two, the right half knocked out of true.
 */
export function Seal({ state = 'verified', size = 160, ringText, label, zone, orientation = true, className, style }: SealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  useEffect(() => {
    if (!ref.current) return;
    return mountSeal(ref.current, { zone, orientation });
  }, [zone, orientation]);

  const id = (s: string) => `seal-${uid}-${s}`;
  const text = fitRing(ringText ?? RING[state]);
  const ink = state === 'verified' ? 'var(--foil-ink)' : 'currentColor';
  const art = (
    <g id={id('art')}>
      {state !== 'verified' && <path d={SCALLOP} fill={state === 'broken' ? 'var(--seal-wash)' : 'var(--sheet)'} stroke="currentColor" strokeWidth={0.6} />}
      {state === 'verified' && <path d={SCALLOP} fill="none" stroke={ink} strokeOpacity={0.35} strokeWidth={0.5} />}
      <circle cx={60} cy={60} r={52.5} fill="none" stroke={ink} strokeOpacity={0.55} strokeWidth={0.6} />
      <circle cx={60} cy={60} r={40.5} fill="none" stroke={ink} strokeOpacity={0.55} strokeWidth={0.6} />
      <path id={id('ring')} d={circlePath(46.5 - 1.9)} fill="none" />
      <text fontSize={5.1} fill={ink} fillOpacity={0.85}>
        <textPath href={`#${id('ring')}`} textLength={2 * Math.PI * 44.6 - 2} lengthAdjust="spacing">
          {text}
        </textPath>
      </text>
      <g className={state === 'pending' ? 'seal-spin' : undefined} fill="none" stroke={ink} strokeWidth={0.45} strokeOpacity={state === 'verified' ? 0.5 : 0.7}>
        <path id={id('a')} d={RING_A} />
        {COPIES.slice(1).map((i) => (
          <use key={`a${i}`} href={`#${id('a')}`} transform={`rotate(${(i * 40) / COPIES.length} 60 60)`} />
        ))}
        <path id={id('b')} d={RING_B} strokeOpacity={0.6} />
        {COPIES.slice(1, 5).map((i) => (
          <use key={`b${i}`} href={`#${id('b')}`} transform={`rotate(${(i * 27.7) / 4} 60 60)`} />
        ))}
      </g>
      <circle cx={60} cy={60} r={19} fill={state === 'verified' ? 'rgba(255,255,255,.55)' : 'var(--sheet)'} stroke={ink} strokeOpacity={0.7} strokeWidth={0.75} />
      {state === 'pending' && (
        <circle className="seal-spin" cx={60} cy={60} r={56} fill="none" stroke="currentColor" strokeWidth={1} strokeDasharray="2 5" strokeLinecap="round" />
      )}
      {state === 'verified' && <path d="M51.5 60.5l6 6 11-12.5" fill="none" stroke={ink} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />}
      {state === 'pending' && (
        <g fill="currentColor">
          <circle cx={53} cy={60} r={1.8} />
          <circle cx={60} cy={60} r={1.8} />
          <circle cx={67} cy={60} r={1.8} />
        </g>
      )}
      {state === 'broken' && <path d="M53 53l14 14M67 53 53 67" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />}
    </g>
  );

  return (
    <div
      ref={ref}
      className={cx('seal', className)}
      data-seal=""
      data-state={state}
      role="img"
      aria-label={label ?? NAME[state]}
      style={{ '--seal-size': `${size}px`, ...style } as CSSProperties}
    >
      <div className="seal-body">
        {state === 'verified' && <div className="seal-foil" />}
        <svg className="seal-art" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
          {state === 'broken' ? (
            <>
              <defs>
                <clipPath id={id('l')}>
                  <path d={crackHalf('left')} />
                </clipPath>
                <clipPath id={id('r')}>
                  <path d={crackHalf('right')} />
                </clipPath>
                {art}
              </defs>
              <use href={`#${id('art')}`} clipPath={`url(#${id('l')})`} transform="translate(-1.5 0) rotate(-2 60 60)" />
              <use href={`#${id('art')}`} clipPath={`url(#${id('r')})`} transform="translate(3 2) rotate(5 60 60)" />
              <path d={crackLine()} fill="none" stroke="currentColor" strokeWidth={0.6} strokeDasharray="1 2" transform="translate(0.8 0.5)" />
            </>
          ) : (
            art
          )}
        </svg>
        {state === 'verified' && <div className="seal-sheen" />}
      </div>
    </div>
  );
}
