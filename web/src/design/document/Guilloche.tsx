import { useEffect, useRef, type CSSProperties } from 'react';
import { cx } from './cx';
import { mountGuilloche, type GuillocheMountOptions, type GuillocheTone, type GuillocheVariant } from './guilloche-engine';

export type GuillocheProps = {
  /** any string; the same seed (and data) always engraves the same pattern */
  seed: string;
  /** shapes the pattern, e.g. an essay's per-minute typing counts */
  data?: number[];
  variant?: GuillocheVariant;
  tone?: GuillocheTone;
  /** 'hero' (0.55 / 0.6), 'card' (0.16 / 0.2), 'faint' (0.08 / 0.1), or an explicit opacity */
  intensity?: GuillocheMountOptions['intensity'];
  density?: number;
  lineWidth?: number;
  /** engrave in over 1.6 s when first seen (skipped under reduced motion) */
  animate?: boolean;
  /** turn very slowly (240 s per revolution); rosettes only; off under reduced motion */
  drift?: boolean;
  /** absolutely fill the positioned parent (card backgrounds) */
  fill?: boolean;
  /** decorative unless labelled */
  label?: string;
  className?: string;
  style?: CSSProperties;
};

/** A deterministic guilloche on canvas, sharp at any pixel ratio, re-inked on theme change. */
export function Guilloche({ seed, data, variant = 'rosette', tone, intensity, density, lineWidth, animate, drift, fill, label, className, style }: GuillocheProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dataKey = data ? data.join(',') : '';
  useEffect(() => {
    if (!ref.current) return;
    return mountGuilloche(ref.current, { seed, data, variant, tone, intensity, density, lineWidth, animate });
    // dataKey stands in for `data` so a new array with the same values does not redraw
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, dataKey, variant, tone, intensity, density, lineWidth, animate]);
  const opts: GuillocheMountOptions = { seed, data, variant, tone, intensity, density, lineWidth, animate };
  return (
    <canvas
      ref={ref}
      className={cx('guilloche', fill && 'guilloche-fill', className)}
      data-guilloche={JSON.stringify(opts)}
      data-drift={drift && variant === 'rosette' ? '' : undefined}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={style}
    />
  );
}
