/* The seal: geometry for its engraving (pure functions, used by Seal.tsx to render SVG)
   and the pointer / device-orientation engine that tilts it and moves the foil sheen. */

import { onReducedMotionChange, prefersReducedMotion } from './motion';

export type SealState = 'verified' | 'pending' | 'broken';

const f = (n: number) => n.toFixed(2).replace(/\.?0+$/, '');

/** A scalloped disc (the seal's edge) centred in a 120 box. */
export function scallopPath(r = 58, lobes = 40, depth = 1.6, cx = 60, cy = 60): string {
  const steps = lobes * 8;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const rad = r - depth + depth * Math.cos(lobes * t);
    d += `${i ? 'L' : 'M'}${f(cx + rad * Math.cos(t))} ${f(cy + rad * Math.sin(t))}`;
  }
  return d + 'Z';
}

/** One lobed ring r(θ) = base + amp·sin(nθ); the seal draws it N times rotated (cheap <use>). */
export function lobedRing(base: number, amp: number, n: number, cx = 60, cy = 60): string {
  const steps = n * 16;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const rad = base + amp * Math.sin(n * t);
    d += `${i ? 'L' : 'M'}${f(cx + rad * Math.cos(t))} ${f(cy + rad * Math.sin(t))}`;
  }
  return d + 'Z';
}

/** A circle as a path starting at 12 o'clock, clockwise (for textPath). */
export function circlePath(r: number, cx = 60, cy = 60): string {
  return `M${cx} ${cy - r}A${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}Z`;
}

/** The crack through a broken seal, top to bottom. */
export const CRACK: Array<[number, number]> = [
  [57, -4],
  [63, 18],
  [55, 38],
  [66, 57],
  [56, 76],
  [64, 98],
  [58, 124],
];

export const crackLine = () => CRACK.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('');
export const crackHalf = (side: 'left' | 'right') =>
  (side === 'left' ? [...CRACK, [-6, 124], [-6, -4]] : [...CRACK, [126, 124], [126, -4]]).map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('') + 'Z';

let maskCache = '';
/** The scallop as a CSS mask image, for the foil layer. */
export function sealMask(): string {
  if (maskCache) return maskCache;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><path d='${scallopPath()}' fill='black'/></svg>`;
  maskCache = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  return maskCache;
}

/* ------------------------------------------------------------ engine */

export interface SealEngineOptions {
  /** element whose pointer movement steers the seal (default: the seal's parent) */
  zone?: HTMLElement | null;
  /** max tilt in degrees (default 14) */
  tilt?: number;
  /** follow device orientation on phones (asks permission on iOS at the first tap) */
  orientation?: boolean;
}

/** Tilts the seal and moves its sheen with the pointer; on phones, with the device. */
export function mountSeal(seal: HTMLElement, opts: SealEngineOptions = {}): () => void {
  const zone = opts.zone ?? seal.parentElement ?? seal;
  const max = opts.tilt ?? 14;
  let reduced = prefersReducedMotion();
  const set = (px: number, py: number) => {
    // px, py in [0, 1] across the seal
    const cx = Math.min(1, Math.max(0, px));
    const cy = Math.min(1, Math.max(0, py));
    seal.style.setProperty('--rx', `${((cx - 0.5) * 2 * max).toFixed(2)}deg`);
    seal.style.setProperty('--ry', `${(-(cy - 0.5) * 2 * max).toFixed(2)}deg`);
    seal.style.setProperty('--mx', `${(cx * 100).toFixed(1)}%`);
    seal.style.setProperty('--my', `${(cy * 100).toFixed(1)}%`);
    seal.style.setProperty('--foil-angle', `${(cx * 140 + cy * 70).toFixed(1)}deg`);
  };
  const reset = () => {
    seal.removeAttribute('data-tracking');
    for (const p of ['--rx', '--ry', '--mx', '--my', '--foil-angle']) seal.style.removeProperty(p);
  };
  const onMove = (e: PointerEvent) => {
    if (reduced || e.pointerType === 'touch') return;
    const r = seal.getBoundingClientRect();
    // a soft response that reaches full tilt one seal-width outside the seal
    const px = 0.5 + (e.clientX - (r.left + r.width / 2)) / (r.width * 2);
    const py = 0.5 + (e.clientY - (r.top + r.height / 2)) / (r.height * 2);
    seal.setAttribute('data-tracking', '');
    set(px, py);
  };
  const onLeave = () => reset();
  zone.addEventListener('pointermove', onMove);
  zone.addEventListener('pointerleave', onLeave);

  let orientOn = false;
  const onOrient = (e: DeviceOrientationEvent) => {
    if (reduced || e.gamma == null || e.beta == null) return;
    seal.setAttribute('data-tracking', '');
    set(0.5 + e.gamma / 60, 0.5 + (e.beta - 45) / 60);
  };
  const listenOrientation = () => {
    if (orientOn) return;
    orientOn = true;
    window.addEventListener('deviceorientation', onOrient);
  };
  type DOE = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };
  const DO = (typeof window !== 'undefined' ? (window as unknown as { DeviceOrientationEvent?: DOE }).DeviceOrientationEvent : undefined) as DOE | undefined;
  const onTap = () => {
    if (!DO?.requestPermission) return;
    DO.requestPermission()
      .then((s) => s === 'granted' && listenOrientation())
      .catch(() => {});
  };
  if (opts.orientation && DO) {
    if (typeof DO.requestPermission === 'function') seal.addEventListener('click', onTap);
    else if (matchMedia('(pointer: coarse)').matches) listenOrientation();
  }
  const offReduced = onReducedMotionChange((r) => {
    reduced = r;
    if (r) reset();
  });

  return () => {
    zone.removeEventListener('pointermove', onMove);
    zone.removeEventListener('pointerleave', onLeave);
    seal.removeEventListener('click', onTap);
    window.removeEventListener('deviceorientation', onOrient);
    offReduced();
  };
}
