import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Reveal } from './document';

/*
 * Motion on the security document (DESIGN-document.md §6): sections rise in once (Reveal), the
 * provenance dots travel, the seal tilts, the hero rosette drifts. Nothing else moves, and all of
 * it stops under reduced motion. FadeUp, Stagger, StaggerItem and Motion keep their names so old
 * imports keep working: FadeUp and Stagger are Reveal groups, the other two are plain divs.
 */

export const EASE = [0.22, 1, 0.36, 1] as const;

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

/** One block rising in once when it scrolls into view (a Reveal of one child). */
export function FadeUp({ children, className, style, delay }: Plain & { delay?: number; distance?: number; inView?: boolean }) {
  return (
    <Reveal className={className} style={style} delay={delay}>
      <div>{children}</div>
    </Reveal>
  );
}

/** A staggered group: each direct child rises 90 ms after the one before. */
export function Stagger({ children, className, style }: Plain & { gap?: number; inView?: boolean }) {
  return (
    <Reveal className={className} style={style}>
      {children}
    </Reveal>
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
  const reduced = usePrefersReducedMotion();
  return (
    <div className={reduced && reducedClassName ? reducedClassName : className} style={style} id={id}>
      {children}
    </div>
  );
}
