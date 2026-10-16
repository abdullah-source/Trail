/* Motion helpers shared by every engine and component. Nothing here imports React. */

export const EASE_RISE = 'cubic-bezier(.22,1,.36,1)';
export const DUR_RISE = 760;

/** True when the person asked the OS for less motion. Safe on the server (returns false). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Calls `fn` whenever the reduced-motion preference changes. Returns an unsubscribe. */
export function onReducedMotionChange(fn: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const on = () => fn(mq.matches);
  mq.addEventListener('change', on);
  return () => mq.removeEventListener('change', on);
}

/** Calls `fn` when the theme may have changed: html[data-theme], data-surface, or the OS scheme. */
export function onThemeChange(fn: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mo = new MutationObserver(fn);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-surface', 'class'] });
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', fn);
  return () => {
    mo.disconnect();
    mq.removeEventListener('change', fn);
  };
}

/** The rise curve, cubic-bezier(.22,1,.36,1), evaluated in JS (Newton on x, then y). */
export function easeRise(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const x1 = 0.22, y1 = 1, x2 = 0.36, y2 = 1;
  const bx = (u: number) => 3 * x1 * u * (1 - u) ** 2 + 3 * x2 * u * u * (1 - u) + u ** 3;
  const by = (u: number) => 3 * y1 * u * (1 - u) ** 2 + 3 * y2 * u * u * (1 - u) + u ** 3;
  const dx = (u: number) => 3 * x1 * (1 - u) ** 2 + 6 * (x2 - x1) * u * (1 - u) + 3 * (1 - x2) * u * u;
  let u = t;
  for (let i = 0; i < 6; i++) {
    const d = dx(u);
    if (Math.abs(d) < 1e-6) break;
    u -= (bx(u) - t) / d;
    u = Math.min(1, Math.max(0, u));
  }
  return by(u);
}

/** Runs `fn` once when `el` first scrolls into view (or immediately without IntersectionObserver). */
export function whenVisible(el: Element, fn: () => void, rootMargin = '0px 0px -8% 0px', threshold = 0.12): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    fn();
    return () => {};
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        fn();
      }
    },
    { rootMargin, threshold },
  );
  io.observe(el);
  return () => io.disconnect();
}

/** The staggered rise: sets data-in on `el` when it enters the viewport. Children rise in turn (CSS). */
export function mountReveal(el: HTMLElement, opts: { delay?: number; stagger?: number } = {}): () => void {
  if (opts.delay != null) el.style.setProperty('--reveal-delay', `${opts.delay}ms`);
  if (opts.stagger != null) el.style.setProperty('--stagger', `${opts.stagger}ms`);
  if (prefersReducedMotion()) {
    el.setAttribute('data-in', '');
    return () => {};
  }
  return whenVisible(el, () => el.setAttribute('data-in', ''));
}
