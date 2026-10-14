/* ProgressBar: segmented, like an installer. */
import type { CSSProperties } from 'react';
import { cx } from './cx';

export type ProgressBarProps = {
  /** 0 to 1. */
  value: number;
  tone?: 'accent' | 'typed' | 'paste' | 'ink';
  /** Accessible name, e.g. "Checks run" or "BIO 101". */
  label: string;
  /** Fixed number of 8 px segments (installer style). Omit for a fluid bar that fills its box in whole segments. */
  segments?: number;
  /** Mono percentage after the bar. */
  showValue?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function ProgressBar({ value, tone = 'accent', label, segments, showValue, className, style }: ProgressBarProps) {
  const v = Math.min(1, Math.max(0, value));
  const fixed = segments != null;
  const trackStyle: CSSProperties = fixed ? { width: segments * 8 + 4, ...style } : style ?? {};
  const fillStyle: CSSProperties = fixed ? { width: Math.round(v * segments) * 8 } : ({ '--p': v } as CSSProperties);
  return (
    <span className={cx(className)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, width: fixed ? undefined : '100%' }}>
      <span className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} style={{ flex: fixed ? undefined : 1, ...trackStyle }}>
        <span className={cx('progress-fill', tone !== 'accent' && `progress-${tone}`)} style={fillStyle} />
      </span>
      {showValue && (
        <span className="tabular" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
          {Math.round(v * 100)}%
        </span>
      )}
    </span>
  );
}

export default ProgressBar;
