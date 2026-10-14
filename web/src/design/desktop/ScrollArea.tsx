/* ScrollArea: a box that scrolls with 16 px desktop scrollbars (dithered track, bevelled thumb, arrow buttons). */
import type { CSSProperties, ReactNode } from 'react';
import { cx } from './cx';

export type ScrollAreaProps = {
  children: ReactNode;
  maxHeight?: number | string;
  /** Accessible name; the region is keyboard-focusable so it can be scrolled with arrows. */
  label?: string;
  /** Draw it as a sunken well (tables, lists). */
  sunken?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function ScrollArea({ children, maxHeight, label, sunken = true, className, style }: ScrollAreaProps) {
  return (
    <div className={cx('scroll', sunken && 'bevel-in', className)} role={label ? 'region' : undefined} aria-label={label} tabIndex={0} style={{ maxHeight, ...style }}>
      {children}
    </div>
  );
}

export default ScrollArea;
