/* Mounts every engine on a static page (no React): used by web/public/document-preview.html,
   and usable by any server-rendered page that prints the same markup as the components. */

import { mountGuilloche, type GuillocheMountOptions } from './guilloche-engine';
import { mountReveal, whenVisible } from './motion';
import { mountProvenancePath } from './provenance-engine';
import { mountSeal } from './seal-engine';
import { setTickerValue } from './Ticker';

export function mountDocument(root: ParentNode = document): () => void {
  const offs: Array<() => void> = [];
  root.querySelectorAll<HTMLCanvasElement>('canvas[data-guilloche]').forEach((c) => {
    try {
      offs.push(mountGuilloche(c, JSON.parse(c.dataset.guilloche || '{}') as GuillocheMountOptions));
    } catch {
      /* bad JSON: leave the canvas blank */
    }
  });
  root.querySelectorAll<HTMLElement>('[data-ppath]').forEach((el) => offs.push(mountProvenancePath(el, { dots: Number(el.dataset.dots) || 3, duration: Number(el.dataset.duration) || 6400 })));
  root.querySelectorAll<HTMLElement>('[data-seal]').forEach((el) => offs.push(mountSeal(el, { orientation: true })));
  root.querySelectorAll<HTMLElement>('.reveal').forEach((el) => offs.push(mountReveal(el)));
  root.querySelectorAll<HTMLElement>('[data-ticker][data-value]').forEach((el) => {
    const v = Number(el.dataset.value);
    offs.push(whenVisible(el, () => setTickerValue(el, v)));
  });
  return () => offs.forEach((f) => f());
}

export { setTickerValue };
