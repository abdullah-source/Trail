import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { cx } from './cx';
import { mountReveal } from './motion';

export type RevealProps = {
  as?: 'div' | 'section' | 'ul' | 'ol' | 'header' | 'footer' | 'article';
  /** ms before the first child rises */
  delay?: number;
  /** ms between children (default 90) */
  stagger?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/**
 * The staggered rise: each direct child comes up 20 px and in, 760 ms on cubic-bezier(.22,1,.36,1),
 * 90 ms after the one before, once, when the group scrolls into view. Present at once under
 * reduced motion. Children keep their own layout: Reveal adds no wrapper around each one.
 */
export function Reveal({ as: Tag = 'div', delay, stagger, className, style, children }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return mountReveal(ref.current, { delay, stagger });
  }, [delay, stagger]);
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={cx('reveal', className)} style={style}>
      {children}
    </Tag>
  );
}
