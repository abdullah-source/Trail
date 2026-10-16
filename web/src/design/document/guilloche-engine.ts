/* The guilloche generator. Deterministic: the same seed and data always engrave the same
   pattern, so every record has its own rosette and it never changes between renders.
   Pure canvas 2D, no React; `mountGuilloche` adds sizing, theming and the draw-in. */

import { easeRise, onThemeChange, prefersReducedMotion, whenVisible } from './motion';

export type GuillocheVariant = 'rosette' | 'waves';
export type GuillocheTone = 'guilloche' | 'ink' | 'typed' | 'paste' | 'signed' | 'seal';

export interface GuillochePattern {
  /** any string: a record id, a hash, a page name */
  seed: string;
  /** optional series that shapes the pattern, e.g. an essay's per-minute typing counts */
  data?: number[];
  variant?: GuillocheVariant;
  /** strand multiplier, 0.4–2 (default 1) */
  density?: number;
}

export interface GuillocheDrawOptions extends GuillochePattern {
  color: string;
  color2?: string;
  /** 0–1 */
  opacity?: number;
  /** css px, before device-pixel scaling (default 0.6) */
  lineWidth?: number;
  /** 0–1: how much of each strand is engraved (draw-in) */
  progress?: number;
  /** device pixel ratio the context is scaled by */
  dpr?: number;
}

/* ------------------------------------------------------------ randomness */

/** FNV-1a 32-bit hash of a string. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a tiny seeded PRNG in [0, 1). */
export function rng(seed: string | number): () => number {
  let a = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length) % xs.length];

/** Normalises a series to 0–1 and returns a smooth periodic sampler f(u), u in [0, 1). */
export function envelope(data: number[] | undefined, periodic = true): (u: number) => number {
  if (!data || data.length < 2) return () => 0.5;
  const lo = Math.min(...data);
  const hi = Math.max(...data);
  const span = hi - lo || 1;
  // light 3-tap smoothing so a single spike does not tear the pattern
  const n = data.length;
  const s = data.map((_, i) => {
    const a = data[periodic ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = data[i];
    const c = data[periodic ? (i + 1) % n : Math.min(n - 1, i + 1)];
    return ((a + 2 * b + c) / 4 - lo) / span;
  });
  return (u: number) => {
    const x = (((u % 1) + 1) % 1) * (periodic ? n : n - 1);
    const i = Math.floor(x);
    const f = x - i;
    const a = s[i % n];
    const b = s[periodic ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const w = (1 - Math.cos(f * Math.PI)) / 2; // cosine interpolation
    return a + (b - a) * w;
  };
}

/* ------------------------------------------------------------ geometry */

export interface Strand {
  pts: Float32Array; // x0,y0,x1,y1,...
  second: boolean; // drawn in color2
}

/** The strands of a pattern in a w × h box. Pure and deterministic. */
export function guillocheStrands(w: number, h: number, p: GuillochePattern): Strand[] {
  const variant = p.variant ?? 'rosette';
  const density = Math.min(2, Math.max(0.4, p.density ?? 1));
  const r = rng(`${p.seed}|${variant}`);
  const env = envelope(p.data, variant === 'rosette');
  return variant === 'rosette' ? rosette(w, h, r, env, density) : waves(w, h, r, env, density);
}

function rosette(w: number, h: number, r: () => number, env: (u: number) => number, density: number): Strand[] {
  const out: Strand[] = [];
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) / 2 - 2;
  const TAU = Math.PI * 2;

  // 1. the outer rope: a few phase-shifted lobed rings, crossing like a twisted cord.
  //    The data only breathes the amplitude, so the outline stays round and engraved.
  const n1 = pick(r, [26, 28, 30, 32, 34, 36]);
  const S1 = Math.max(4, Math.round(8 * density));
  const base1 = R * 0.8;
  const amp1 = R * 0.105;
  const steps1 = Math.max(720, n1 * 36);
  for (let k = 0; k < S1; k++) {
    const ph = (k / S1) * TAU;
    const pts = new Float32Array((steps1 + 1) * 2);
    for (let i = 0; i <= steps1; i++) {
      const t = (i / steps1) * TAU;
      const e = 0.72 + 0.5 * env(t / TAU);
      const rad = base1 + amp1 * e * Math.sin(n1 * t + ph);
      pts[i * 2] = cx + rad * Math.cos(t);
      pts[i * 2 + 1] = cy + rad * Math.sin(t);
    }
    out.push({ pts, second: false });
  }

  // 1b. layered petals: a lower lobe count, phases fanned over a narrow arc
  const n2 = pick(r, [10, 12, 14, 16]);
  const S1b = Math.max(6, Math.round(14 * density));
  const steps1b = Math.max(720, n2 * 48);
  for (let k = 0; k < S1b; k++) {
    const ph = (k / S1b) * (Math.PI / 2.2);
    const pts = new Float32Array((steps1b + 1) * 2);
    for (let i = 0; i <= steps1b; i++) {
      const t = (i / steps1b) * TAU;
      const rad = R * 0.6 + R * 0.085 * Math.sin(n2 * t + ph) + R * 0.012 * Math.sin(n1 * t);
      pts[i * 2] = cx + rad * Math.cos(t);
      pts[i * 2 + 1] = cy + rad * Math.sin(t);
    }
    out.push({ pts, second: true });
  }

  // 2. the inner rosette: a hypotrochoid family, rotated copies
  const ratio = pick(r, [
    [7, 3],
    [9, 4],
    [11, 4],
    [13, 5],
    [8, 3],
  ]);
  const Rh = R * 0.5;
  const rh = (Rh * ratio[1]) / ratio[0];
  const d = rh * (0.75 + r() * 0.35);
  const S2 = Math.round(10 * density);
  const turns = ratio[1];
  const steps2 = 540 * turns;
  const scale = (R * 0.42) / (Rh - rh + d);
  for (let k = 0; k < S2; k++) {
    const rot = (k / S2) * (TAU / ratio[0]);
    const pts = new Float32Array((steps2 + 1) * 2);
    for (let i = 0; i <= steps2; i++) {
      const t = (i / steps2) * TAU * turns;
      const x = (Rh - rh) * Math.cos(t) + d * Math.cos(((Rh - rh) / rh) * t);
      const y = (Rh - rh) * Math.sin(t) - d * Math.sin(((Rh - rh) / rh) * t);
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      pts[i * 2] = cx + (x * c - y * s) * scale;
      pts[i * 2 + 1] = cy + (x * s + y * c) * scale;
    }
    out.push({ pts, second: true });
  }

  // 3. two fine engraved rings framing the braid
  for (const f of [0.475, 0.69, 0.935, 0.955]) {
    const steps = 360;
    const pts = new Float32Array((steps + 1) * 2);
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * TAU;
      const rad = R * f + R * 0.006 * Math.sin(n1 * 2 * t);
      pts[i * 2] = cx + rad * Math.cos(t);
      pts[i * 2 + 1] = cy + rad * Math.sin(t);
    }
    out.push({ pts, second: false });
  }
  return out;
}

function waves(w: number, h: number, r: () => number, env: (u: number) => number, density: number): Strand[] {
  const out: Strand[] = [];
  const TAU = Math.PI * 2;
  const bandH = Math.max(56, Math.min(140, h / Math.max(1, Math.round(h / 120))));
  const rows = Math.max(1, Math.round(h / bandH));
  const step = h / rows;
  const S = Math.round(9 * density);
  const f1 = 2 + Math.floor(r() * 3); // full waves across the width
  const f2 = 9 + Math.floor(r() * 8);
  const steps = Math.max(240, Math.round(w / 3));
  for (let row = 0; row < rows; row++) {
    const cy = step * (row + 0.5);
    const amp = step * 0.36;
    const rowPh = r() * TAU;
    for (let k = 0; k < S; k++) {
      const ph = (k / S) * TAU;
      const pts = new Float32Array((steps + 1) * 2);
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const e = 0.35 + 0.65 * env(u);
        const y = cy + amp * e * Math.sin(TAU * f1 * u + ph + rowPh) * Math.cos(TAU * 0.5 * u + rowPh) + step * 0.07 * Math.sin(TAU * f2 * u + ph * 2);
        pts[i * 2] = u * w;
        pts[i * 2 + 1] = y;
      }
      out.push({ pts, second: k % 3 === 2 });
    }
  }
  return out;
}

/* ------------------------------------------------------------ drawing */

/** Engraves a pattern onto a 2D context already scaled to css pixels. Clears first. */
export function drawGuilloche(ctx: CanvasRenderingContext2D, w: number, h: number, o: GuillocheDrawOptions, strands = guillocheStrands(w, h, o)) {
  const progress = Math.min(1, Math.max(0, o.progress ?? 1));
  ctx.clearRect(0, 0, w, h);
  if (progress <= 0) return;
  ctx.save();
  ctx.globalAlpha = o.opacity ?? 1;
  ctx.lineWidth = o.lineWidth ?? 0.6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const second of [true, false]) {
    ctx.strokeStyle = second ? o.color2 ?? o.color : o.color;
    ctx.beginPath();
    for (const s of strands) {
      if (s.second !== second) continue;
      const n = s.pts.length / 2;
      const last = Math.max(1, Math.floor((n - 1) * progress));
      ctx.moveTo(s.pts[0], s.pts[1]);
      for (let i = 1; i <= last; i++) ctx.lineTo(s.pts[i * 2], s.pts[i * 2 + 1]);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------------ mounting */

export interface GuillocheMountOptions extends GuillochePattern {
  tone?: GuillocheTone;
  /** 'hero' | 'card' | 'faint' read the opacity tokens; a number is used as is */
  intensity?: 'hero' | 'card' | 'faint' | number;
  lineWidth?: number;
  /** engrave the strands in over 1.6 s the first time the canvas is seen */
  animate?: boolean;
}

const TONE_VAR: Record<GuillocheTone, string> = {
  guilloche: '--guilloche',
  ink: '--ink',
  typed: '--typed',
  paste: '--paste',
  signed: '--signed',
  seal: '--seal',
};

/** Sizes `canvas` to its box (device-pixel sharp), draws, redraws on resize and theme change. */
export function mountGuilloche(canvas: HTMLCanvasElement, opts: GuillocheMountOptions): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  let w = 0;
  let h = 0;
  let strands: Strand[] = [];
  let progress = opts.animate && !prefersReducedMotion() ? 0 : 1;
  let raf = 0;

  const colours = () => {
    const cs = getComputedStyle(canvas);
    const tone = opts.tone ?? 'guilloche';
    const color = cs.getPropertyValue(TONE_VAR[tone]).trim() || '#5e8c7a';
    const color2 = tone === 'guilloche' ? cs.getPropertyValue('--guilloche-2').trim() || color : color;
    const i = opts.intensity ?? 'card';
    const opacity = typeof i === 'number' ? i : parseFloat(cs.getPropertyValue(`--guilloche-${i}`)) || 0.2;
    return { color, color2, opacity };
  };

  const paint = () => {
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGuilloche(ctx, w, h, { ...opts, ...colours(), progress, lineWidth: opts.lineWidth, dpr }, strands);
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const nw = Math.round(rect.width);
    const nh = Math.round(rect.height);
    if (nw === w && nh === h) return;
    w = nw;
    h = nh;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    strands = w && h ? guillocheStrands(w, h, opts) : [];
    paint();
  };

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(canvas);
  resize();
  const offTheme = onThemeChange(paint);

  let offVisible = () => {};
  if (progress < 1) {
    offVisible = whenVisible(canvas, () => {
      const t0 = performance.now();
      const dur = 1600;
      const tick = (now: number) => {
        progress = easeRise(Math.min(1, (now - t0) / dur));
        paint();
        if (progress < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, '0px', 0.05);
  }

  return () => {
    ro?.disconnect();
    offTheme();
    offVisible();
    cancelAnimationFrame(raf);
  };
}
