import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

/*
 * Motion primitives. DESIGN.md §6: on marketing pages only the replay moves.
 * Everything else gets one arrival: 12px rise + fade, 480ms, ease-out.
 * Under prefers-reduced-motion these render static (no transform, no fade).
 */

export const EASE = [0.2, 0.7, 0.2, 1] as const;

/** True when the visitor prefers reduced motion. SSR/first paint safe (false). */
export function usePrefersReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}

type FadeUpProps = HTMLMotionProps<'div'> & {
  children?: ReactNode;
  /** seconds */
  delay?: number;
  /** pixels to rise from */
  distance?: number;
  /** animate when scrolled into view instead of on mount */
  inView?: boolean;
};

/** One element arriving. Use for hero copy, section headers, single cards. */
export function FadeUp({ children, delay = 0, distance = 12, inView = false, ...rest }: FadeUpProps) {
  const reduced = usePrefersReducedMotion();
  if (reduced) return <div className={rest.className as string | undefined}>{children}</div>;
  const visible = { opacity: 1, y: 0 };
  if (inView) {
    // Visible at rest: the element is never parked at opacity 0 waiting for a
    // scroll observer (crawlers, print, full-page captures all see it). When it
    // enters the viewport it plays the rise from a keyframe instead.
    return (
      <motion.div
        initial={false}
        whileInView={{ opacity: [0, 1], y: [distance, 0] }}
        viewport={{ once: true, margin: '-10% 0px' }}
        transition={{ duration: 0.48, ease: EASE, delay }}
        {...rest}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: distance }}
      animate={visible}
      transition={{ duration: 0.48, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

type StaggerProps = HTMLMotionProps<'div'> & {
  children?: ReactNode;
  /** seconds between children */
  gap?: number;
  inView?: boolean;
};

// Items are visible at rest (initial={false}); "shown" plays the rise as keyframes.
const item = {
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: [0, 1], y: [12, 0], transition: { duration: 0.48, ease: EASE } },
};

/** A parent whose direct <StaggerItem> children arrive one after another. */
export function Stagger({ children, gap = 0.07, inView = true, ...rest }: StaggerProps) {
  const reduced = usePrefersReducedMotion();
  if (reduced) return <div className={rest.className as string | undefined}>{children}</div>;
  return (
    <motion.div
      initial={inView ? false : 'hidden'}
      {...(inView ? { whileInView: 'shown', viewport: { once: true, margin: '-10% 0px' } } : { animate: 'shown' })}
      variants={{ shown: { transition: { staggerChildren: gap } } }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, ...rest }: HTMLMotionProps<'div'> & { children?: ReactNode }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) return <div className={rest.className as string | undefined}>{children}</div>;
  return (
    <motion.div variants={item} {...rest}>
      {children}
    </motion.div>
  );
}

/** Wraps any framer-motion props: passes them through normally, strips them under reduced motion. */
export function Motion({ children, reducedClassName, ...rest }: HTMLMotionProps<'div'> & { children?: ReactNode; reducedClassName?: string }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) return <div className={reducedClassName ?? (rest.className as string | undefined)}>{children}</div>;
  return <motion.div {...rest}>{children}</motion.div>;
}
