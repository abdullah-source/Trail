import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

/*
 * Motion on the desktop (DESIGN-desktop.md §6): only the record moves. The budget is the
 * window zoom-open (`.win-open` in tokens.css), the caret blink, the replay itself and the
 * one-time light-up of the provenance strip. FadeUp, Stagger, StaggerItem and Motion keep
 * their names so nothing has to change its imports, but they render plain divs, and
 * framer-motion is no longer loaded on marketing pages.
 */

export const EASE = [0.2, 0.7, 0.2, 1] as const;

const QUERY = '(prefers-reduced-motion: reduce)';
const prefers = () => typeof matchMedia !== 'undefined' && matchMedia(QUERY).matches;

/** True when the visitor prefers reduced motion. Tracks the media query. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(prefers);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia(QUERY);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

type Plain = { children?: ReactNode; className?: string; style?: CSSProperties; id?: string };

/** Formerly one element arriving. On the desktop it is a plain div. */
export function FadeUp({ children, className, style, id }: Plain & { delay?: number; distance?: number; inView?: boolean }) {
  return (
    <div className={className} style={style} id={id}>
      {children}
    </div>
  );
}

/** Formerly a staggered parent. On the desktop it is a plain div. */
export function Stagger({ children, className, style, id }: Plain & { gap?: number; inView?: boolean }) {
  return (
    <div className={className} style={style} id={id}>
      {children}
    </div>
  );
}

export function StaggerItem({ children, className, style, id }: Plain) {
  return (
    <div className={className} style={style} id={id}>
      {children}
    </div>
  );
}

export function Motion({ children, className, reducedClassName, style, id }: Plain & { reducedClassName?: string }) {
  return (
    <div className={reducedClassName ?? className} style={style} id={id}>
      {children}
    </div>
  );
}
