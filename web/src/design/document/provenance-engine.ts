/* The provenance path engine: Whistle-style glowing dots travelling a thin line between
   checkpoints, each checkpoint lighting as a dot passes. Framework-free.

   Markup it expects (ProvenancePath.tsx renders exactly this):
     <div class="ppath" data-ppath>
       <svg class="ppath-svg" aria-hidden="true"></svg>
       <ol class="ppath-list"> <li class="ppath-node"> <span class="ppath-pin" data-ppath-pin>…
   Layout is pure CSS (a row, or a column under 620 px of container width); the engine only
   measures the pins and draws through them, so it follows whatever the CSS decides. */

import { onReducedMotionChange, prefersReducedMotion } from './motion';

export interface ProvenanceEngineOptions {
  /** dots on the line at once (default 3) */
  dots?: number;
  /** ms for one dot to travel the whole path (default 6400) */
  duration?: number;
  /** px of glowing tail behind each dot (default 56) */
  tail?: number;
}

const SVG = 'http://www.w3.org/2000/svg';
const el = <K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number>) => {
  const n = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
};

/** A gentle engraved wave through the points: alternate control offsets, like a guilloche thread. */
export function pathThrough(pts: Array<[number, number]>, vertical: boolean): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const sign = i % 2 ? 1 : -1;
    const off = 14 * sign;
    if (vertical) {
      const my = (y1 - y0) / 3;
      d += ` C${(x0 + off).toFixed(1)} ${(y0 + my).toFixed(1)} ${(x1 + off).toFixed(1)} ${(y1 - my).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    } else {
      const mx = (x1 - x0) / 3;
      d += ` C${(x0 + mx).toFixed(1)} ${(y0 + off).toFixed(1)} ${(x1 - mx).toFixed(1)} ${(y1 + off).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
  }
  return d;
}

export function mountProvenancePath(root: HTMLElement, opts: ProvenanceEngineOptions = {}): () => void {
  const dotsN = Math.max(1, opts.dots ?? 3);
  const duration = Math.max(1500, opts.duration ?? 6400);
  const tailLen = opts.tail ?? 56;
  let svg = root.querySelector<SVGSVGElement>('svg.ppath-svg');
  if (!svg) {
    svg = el('svg', { class: 'ppath-svg', 'aria-hidden': 'true' }) as SVGSVGElement;
    root.prepend(svg);
  }
  const pins = Array.from(root.querySelectorAll<HTMLElement>('[data-ppath-pin]'));
  const nodes = pins.map((p) => p.closest<HTMLElement>('.ppath-node') ?? p);

  let reduced = prefersReducedMotion();
  let path: SVGPathElement | null = null;
  let total = 0;
  let stops: number[] = []; // path length at each pin
  let dots: Array<{ halo: SVGCircleElement; core: SVGCircleElement; tail: SVGPathElement }> = [];
  const lastHit = new Array(pins.length).fill(-1e9);
  let raf = 0;
  let running = false;
  let visible = true;
  const t0 = performance.now();

  const build = () => {
    const box = root.getBoundingClientRect();
    if (!box.width || !pins.length) return;
    svg!.setAttribute('viewBox', `0 0 ${box.width.toFixed(1)} ${box.height.toFixed(1)}`);
    const pts = pins.map((p) => {
      const r = p.getBoundingClientRect();
      return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2] as [number, number];
    });
    const vertical = pts.length > 1 && Math.abs(pts[pts.length - 1][0] - pts[0][0]) < Math.abs(pts[pts.length - 1][1] - pts[0][1]);
    const d = pathThrough(pts, vertical);
    svg!.replaceChildren();
    const defs = el('defs', {});
    svg!.append(defs);
    svg!.append(el('path', { d, class: 'ppath-line' }));
    path = el('path', { d, class: 'ppath-line', 'stroke-opacity': 0 }) as SVGPathElement;
    svg!.append(path);
    total = path.getTotalLength();
    // where along the path each pin sits: the nearest sampled point
    const samples = 600;
    const sampled: Array<[number, number, number]> = [];
    for (let i = 0; i <= samples; i++) {
      const s = (i / samples) * total;
      const p = path.getPointAtLength(s);
      sampled.push([s, p.x, p.y]);
    }
    stops = pts.map(([x, y]) => {
      let best = 0;
      let bd = Infinity;
      for (const [s, sx, sy] of sampled) {
        const dd = (sx - x) ** 2 + (sy - y) ** 2;
        if (dd < bd) {
          bd = dd;
          best = s;
        }
      }
      return best;
    });
    dots = [];
    if (reduced) {
      root.setAttribute('data-static', '');
      return;
    }
    root.removeAttribute('data-static');
    for (let k = 0; k < dotsN; k++) {
      const tail = el('path', { d, class: 'ppath-tail' }) as SVGPathElement;
      tail.style.strokeDasharray = `${tailLen} ${total + tailLen}`;
      const halo = el('circle', { r: 9, class: 'ppath-halo' }) as SVGCircleElement;
      const core = el('circle', { r: 2.75, class: 'ppath-dot' }) as SVGCircleElement;
      svg!.append(tail, halo, core);
      dots.push({ halo, core, tail });
    }
    frame(performance.now());
  };

  const frame = (now: number) => {
    if (!path || !total) return;
    const phase = (now - t0) / duration;
    for (let k = 0; k < dots.length; k++) {
      const u = (phase + k / dots.length) % 1;
      const s = u * total;
      const p = path.getPointAtLength(s);
      const { halo, core, tail } = dots[k];
      // fade in at the start of the path and out at its end
      const a = Math.min(1, u / 0.04, (1 - u) / 0.04);
      halo.setAttribute('cx', p.x.toFixed(1));
      halo.setAttribute('cy', p.y.toFixed(1));
      core.setAttribute('cx', p.x.toFixed(1));
      core.setAttribute('cy', p.y.toFixed(1));
      halo.style.opacity = core.style.opacity = tail.style.opacity = String(a);
      tail.style.strokeDashoffset = String(-(s - tailLen));
      stops.forEach((stop, i) => {
        if (Math.abs(stop - s) < 18) lastHit[i] = now;
      });
    }
    nodes.forEach((n, i) => {
      const lit = now - lastHit[i] < 650;
      if (lit !== n.hasAttribute('data-lit')) n.toggleAttribute('data-lit', lit);
    });
  };

  const loop = (now: number) => {
    frame(now);
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (running || reduced || !visible || document.hidden) return;
    running = true;
    raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => build()) : null;
  ro?.observe(root);
  const io =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((es) => {
          visible = es.some((e) => e.isIntersecting);
          if (visible) start();
          else stop();
        })
      : null;
  io?.observe(root);
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);
  const offReduced = onReducedMotionChange((r) => {
    reduced = r;
    stop();
    nodes.forEach((n) => n.removeAttribute('data-lit'));
    build();
    start();
  });
  // fonts change the label heights, and so the pin positions
  (document as Document & { fonts?: FontFaceSet }).fonts?.ready.then(() => build());
  build();
  start();

  return () => {
    stop();
    ro?.disconnect();
    io?.disconnect();
    offReduced();
    document.removeEventListener('visibilitychange', onVis);
    svg?.replaceChildren();
  };
}
