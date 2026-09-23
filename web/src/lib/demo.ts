// The public demo: real essays from public datasets, with simulated writing sessions, published
// as static files by the data pipeline. This module is the contract the /demo page reads.
//
//   GET /demo/manifest.json         -> DemoManifest (an array of DemoEssay)
//   GET /demo/<id>.events.json      -> TrailEvent[]  (exactly what the extension exports;
//                                      an object with an `events` array is tolerated too)
//   GET /v1/demo/<id>/pack          -> the same record as a signed .trail.tar.gz (server)
import type { TrailEvent } from './types';

export type DemoKind = 'typed' | 'ai-paste' | 'chunked' | 'autotyped' | 'web-quotes';

export type DemoTruth = {
  /** share of the final text that was typed, 0..1 */
  typed_share?: number | null;
  pasted_chars?: number | null;
  /** host names the pastes came from, e.g. ["chatgpt.com"] */
  paste_sources?: string[] | null;
  /** true when the "typing" was produced by a script rather than a person */
  scripted?: boolean | null;
  [k: string]: unknown;
};

export type DemoExpect = {
  typed_share?: number | null;
  pasted_chars?: number | null;
  paste_count?: number | null;
  ai_pastes?: number | null;
  regularity_flagged?: boolean | null;
  [k: string]: unknown;
};

export type DemoEssay = {
  id: string;
  title: string;
  kind: DemoKind | string;
  blurb: string;
  /** dataset the essay text came from, e.g. "IELTS essays (Kaggle)" */
  source: string;
  words: number;
  sessions: number;
  truth: DemoTruth;
  expect?: DemoExpect;
};

export type DemoManifest = DemoEssay[];

export const KIND_LABEL: Record<DemoKind, string> = {
  typed: 'Typed by a student',
  'ai-paste': 'Pasted from ChatGPT',
  chunked: 'Pasted in chunks, reworded',
  autotyped: 'Auto-typed by a script',
  'web-quotes': 'Typed with web quotes',
};

const ALIASES: Record<string, DemoKind> = {
  typed: 'typed', honest: 'typed', student: 'typed', human: 'typed',
  'ai-paste': 'ai-paste', ai: 'ai-paste', 'ai-pasted': 'ai-paste', pasted: 'ai-paste', chatgpt: 'ai-paste', 'heavy-paster': 'ai-paste', 'heavy-paste': 'ai-paste',
  chunked: 'chunked', mixed: 'chunked', reworded: 'chunked', 'chunked-reword': 'chunked', 'chunks-reworded': 'chunked',
  autotyped: 'autotyped', autotyper: 'autotyped', scripted: 'autotyped', bot: 'autotyped', 'jittered-bot': 'autotyped', script: 'autotyped',
  'web-quotes': 'web-quotes', web: 'web-quotes', quotes: 'web-quotes', gapped: 'web-quotes', 'typed-web-quotes': 'web-quotes',
};

/** Map whatever the manifest says to one of the five badge kinds. Unknown strings fall back to `typed`. */
export function demoKind(kind: string | undefined | null): DemoKind {
  const k = String(kind || '').toLowerCase().replace(/[_\s]+/g, '-');
  return ALIASES[k] || 'typed';
}

export function kindLabel(kind: string | undefined | null): string {
  const k = demoKind(kind);
  return ALIASES[String(kind || '').toLowerCase().replace(/[_\s]+/g, '-')] ? KIND_LABEL[k] : kind || KIND_LABEL[k];
}

export const DEMO_BASE = '/demo';

export class DemoUnavailable extends Error {}

export async function loadDemoManifest(): Promise<DemoManifest> {
  let r: Response;
  try {
    r = await fetch(`${DEMO_BASE}/manifest.json`, { credentials: 'omit' });
  } catch {
    throw new DemoUnavailable('Could not reach the demo files.');
  }
  if (!r.ok) throw new DemoUnavailable('Demo data is not published yet.');
  let json: unknown;
  try {
    json = await r.json();
  } catch {
    throw new DemoUnavailable('Demo data is not published yet.');
  }
  const list = Array.isArray(json) ? json : Array.isArray((json as any)?.essays) ? (json as any).essays : null;
  if (!list) throw new DemoUnavailable('The demo manifest has an unexpected shape.');
  return list.filter((e: any) => e && typeof e.id === 'string').map((e: any) => ({
    ...e,
    title: e.title || e.id,
    blurb: e.blurb || '',
    source: e.source || '',
    words: Number(e.words) || 0,
    sessions: Number(e.sessions) || 0,
    truth: e.truth || {},
  }));
}

export async function loadDemoEvents(id: string): Promise<TrailEvent[]> {
  const r = await fetch(`${DEMO_BASE}/${encodeURIComponent(id)}.events.json`, { credentials: 'omit' });
  if (!r.ok) throw new DemoUnavailable(`The events for "${id}" are not published yet.`);
  const json = await r.json();
  const evs = Array.isArray(json) ? json : Array.isArray(json?.events) ? json.events : null;
  if (!evs) throw new DemoUnavailable(`The events file for "${id}" has an unexpected shape.`);
  return evs as TrailEvent[];
}

/** Where the signed pack for a demo essay lives (built by the server). */
export const demoPackUrl = (id: string) => `/v1/demo/${encodeURIComponent(id)}/pack`;

/* ---- server side: GET /v1/demo (the same essays, with their signed checkpoints and pack URLs) ---- */

export type ServerDemoCheckpoint = { seq: number; ts: string; hash: string; key_id: string };
export type ServerDemo = {
  id: string;
  title: string;
  student?: string;
  course?: string;
  description?: string;
  doc?: string;
  events: number;
  sessions: number;
  first_event?: string | null;
  last_event?: string | null;
  checkpoints: ServerDemoCheckpoint[];
  signed: boolean;
  events_url: string;
  pack_url: string;
};

/** The server's list, or [] when this server does not publish demos. Never throws. */
export async function loadServerDemos(): Promise<ServerDemo[]> {
  try {
    const r = await fetch('/v1/demo', { credentials: 'omit' });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

export type DemoEntry = DemoEssay & { server?: ServerDemo };

/** Manifest entries merged with the server's list by id; essays only the server knows are appended with defaults. */
export function mergeDemos(manifest: DemoManifest, server: ServerDemo[]): DemoEntry[] {
  const byId = new Map(server.map((s) => [s.id, s]));
  const out: DemoEntry[] = manifest.map((m) => ({ ...m, server: byId.get(m.id) }));
  for (const s of server)
    if (!manifest.some((m) => m.id === s.id))
      out.push({ id: s.id, title: s.title || s.id, kind: 'typed', blurb: s.description || '', source: '', words: 0, sessions: s.sessions, truth: {}, server: s });
  return out;
}
