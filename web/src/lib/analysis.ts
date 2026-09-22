// Faithful TypeScript port of trail/analysis.py, trail/document.py and the drafts /
// declaration / patterns functions of trail/pack.py. Pure, synchronous, client-side only.
// Parity with the Python reference is enforced by analysis.test.ts over 20 fixtures.

import type {
  Analysis,
  Cadence,
  Draft,
  LineLabel,
  LineProvenance,
  PasteItem,
  Pastes,
  Patterns,
  Regularity,
  RegularitySignal,
  SessionSummary,
  SourceDwell,
  TimelineBucket,
  TrailEvent,
} from './types';
import { getOpcodes } from './difflib';
import { sha256Hex } from './sha256';
import { mean, median, pstdev, pyFormatFixed, pyPercent1, pyRound, pyRoundInt, pySplitWords, pyThousands, quantiles } from './pyfloat';

export const ANALYSIS_VERSION = '1.0';
export const AI_HOSTS_VERSION = 1;
export const PAUSE_MS = 2000;
export const IDLE_MS = 120_000;
export const BUCKET_MS = 10 * 60_000;

// Mirror of trail/events.py AI_HOSTS.
export const AI_HOSTS = new Set([
  'chatgpt.com', 'chat.openai.com', 'claude.ai', 'gemini.google.com', 'bard.google.com',
  'copilot.microsoft.com', 'perplexity.ai', 'www.perplexity.ai', 'poe.com', 'character.ai',
  'grok.com', 'x.ai', 'mistral.ai', 'chat.mistral.ai', 'deepseek.com', 'chat.deepseek.com',
  'you.com', 'writesonic.com', 'jasper.ai', 'app.jasper.ai', 'notion.so/ai', 'quillbot.com',
  'grammarly.com', 'app.grammarly.com', 'undetectable.ai', 'phrasly.ai', 'humanizeai.pro',
]);

export function classifySource(host: string | null | undefined, fromSelf = false): string {
  if (fromSelf) return 'self';
  if (!host) return 'unknown';
  const h = host.toLowerCase();
  if (AI_HOSTS.has(h)) return 'ai';
  for (const a of AI_HOSTS) if (h.endsWith('.' + a)) return 'ai';
  return 'web';
}

// ---- time ------------------------------------------------------------------------

const TS_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{1,6})Z$/;

/** Microseconds since the epoch for a "%Y-%m-%dT%H:%M:%S.%fZ" timestamp. */
export function tsMicros(ts: string): number {
  const m = TS_RE.exec(ts);
  if (!m) throw new Error(`bad timestamp ${ts}`);
  const base = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  const micro = Number(m[7].padEnd(6, '0'));
  return base * 1000 + micro;
}

/** trail.core.timeutil.ms: int(parse_ts(ts).timestamp() * 1000), same float steps. */
export function ms(ts: string): number {
  const us = tsMicros(ts);
  return Math.trunc((us / 1e6) * 1000);
}

export function tsHourUtc(ts: string): number {
  const m = TS_RE.exec(ts);
  if (!m) throw new Error(`bad timestamp ${ts}`);
  return +m[4];
}

// ---- helpers ---------------------------------------------------------------------------

function cps(text: string): string[] {
  return Array.from(text);
}

function cpLen(text: string): number {
  let n = 0;
  for (const _ of text) n++;
  return n;
}

export function sortEvents(events: TrailEvent[]): TrailEvent[] {
  return [...events].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.seq - b.seq));
}

function isEdit(kind: string): boolean {
  return kind === 'insert' || kind === 'delete' || kind === 'paste' || kind === 'resync';
}

// ---- document --------------------------------------------------------------------------

const TYPED = 'typed';
const UNOBSERVED = 'unobserved';

export type PasteInfo = {
  paste_id: string;
  ts: string;
  pos: number;
  length: number;
  source_host: string | null;
  source_kind: string;
  from_self: boolean;
  text_hash: string;
};

export type FullLineProvenance = LineProvenance & { paste_ids: string[]; edited_after_paste: boolean };

export class Document {
  chars: string[] = [];
  origin: string[] = [];
  edited: boolean[] = [];
  pastes = new Map<string, PasteInfo>();
  typed_chars = 0;
  deleted_chars = 0;
  deleted_by_origin = new Map<string, number>();
  unobserved_chars = 0;
  snapshot_checks = 0;
  snapshot_mismatches = 0;
  resyncs = 0;

  get text(): string {
    return this.chars.join('');
  }

  textHash(): string {
    return sha256Hex(this.text);
  }

  private insert(pos: number, text: string, origin: string): void {
    if (pos < 0) pos = this.chars.length;
    pos = Math.max(0, Math.min(pos, this.chars.length));
    const seg = cps(text);
    const n = seg.length;
    this.chars.splice(pos, 0, ...seg);
    this.origin.splice(pos, 0, ...new Array<string>(n).fill(origin));
    this.edited.splice(pos, 0, ...new Array<boolean>(n).fill(false));
    if (origin === TYPED) {
      for (const j of [pos - 1, pos + n]) {
        if (j >= 0 && j < this.chars.length && this.origin[j].startsWith('paste:')) this.edited[j] = true;
      }
    }
  }

  private delete(pos: number, length: number): void {
    if (pos < 0) pos = Math.max(0, this.chars.length - length);
    pos = Math.max(0, Math.min(pos, this.chars.length));
    const end = Math.max(pos, Math.min(pos + length, this.chars.length));
    for (let i = pos; i < end; i++) {
      const o = this.origin[i];
      const key = o.startsWith('paste:') ? 'paste' : o;
      this.deleted_by_origin.set(key, (this.deleted_by_origin.get(key) || 0) + 1);
    }
    this.deleted_chars += end - pos;
    this.chars.splice(pos, end - pos);
    this.origin.splice(pos, end - pos);
    this.edited.splice(pos, end - pos);
    for (const j of [pos - 1, pos]) {
      if (j >= 0 && j < this.chars.length && this.origin[j].startsWith('paste:')) this.edited[j] = true;
    }
  }

  apply(ev: TrailEvent): void {
    const d = ev.data;
    const k = ev.kind;
    if (k === 'insert') {
      const text = String(d.text);
      this.insert(Math.trunc(Number(d.pos)), text, TYPED);
      this.typed_chars += cpLen(text);
    } else if (k === 'delete') {
      this.delete(Math.trunc(Number(d.pos)), Math.trunc(Number(d.len)));
    } else if (k === 'paste') {
      const pid = String(d.paste_id);
      const text = String(d.text);
      this.pastes.set(pid, {
        paste_id: pid,
        ts: ev.ts,
        pos: Math.trunc(Number(d.pos)),
        length: cpLen(text),
        source_host: d.source_host ?? null,
        source_kind: String(d.source_kind || classifySource(d.source_host, !!d.from_self)),
        from_self: !!d.from_self,
        text_hash: sha256Hex(text),
      });
      this.insert(Math.trunc(Number(d.pos)), text, `paste:${pid}`);
    } else if (k === 'resync') {
      this.resync(String(d.text));
    } else if (k === 'snapshot') {
      this.snapshot_checks += 1;
      if (d.text_hash !== this.textHash()) this.snapshot_mismatches += 1;
    }
  }

  private resync(observed: string): void {
    this.resyncs += 1;
    const current = this.text;
    if (current === observed) return;
    const a = this.chars;
    const b = cps(observed);
    const newChars: string[] = [];
    const newOrigin: string[] = [];
    const newEdited: boolean[] = [];
    for (const [tag, i1, i2, j1, j2] of getOpcodes(a, b)) {
      if (tag === 'equal') {
        for (let i = i1; i < i2; i++) {
          newChars.push(a[i]);
          newOrigin.push(this.origin[i]);
          newEdited.push(this.edited[i]);
        }
      } else if (tag === 'replace' || tag === 'insert') {
        for (let j = j1; j < j2; j++) {
          newChars.push(b[j]);
          newOrigin.push(UNOBSERVED);
          newEdited.push(false);
        }
        this.unobserved_chars += j2 - j1;
      }
    }
    this.chars = newChars;
    this.origin = newOrigin;
    this.edited = newEdited;
  }

  survivingByPaste(): Map<string, number> {
    const out = new Map<string, number>();
    for (const o of this.origin) {
      if (o.startsWith('paste:')) {
        const id = o.slice(6);
        out.set(id, (out.get(id) || 0) + 1);
      }
    }
    return out;
  }

  lines(): FullLineProvenance[] {
    const out: FullLineProvenance[] = [];
    let start = 0;
    const n = this.chars.length;
    let idx = 0;
    while (start <= n) {
      let end = this.chars.indexOf('\n', start);
      if (end < 0) end = n;
      out.push(this.line(idx, start, end));
      idx += 1;
      start = end + 1;
      if (end === n) break;
    }
    return out;
  }

  private line(idx: number, a: number, b: number): FullLineProvenance {
    let typed = 0, pasted = 0, unobs = 0;
    const pids: string[] = [];
    let edited = false;
    for (let j = a; j < b; j++) {
      const o = this.origin[j];
      if (o === TYPED) typed += 1;
      else if (o === UNOBSERVED) unobs += 1;
      else {
        pasted += 1;
        const pid = o.slice(6);
        if (!pids.includes(pid)) pids.push(pid);
        if (this.edited[j]) edited = true;
      }
    }
    const total = Math.max(1, b - a);
    let label: LineLabel;
    if (typed / total >= 0.9) label = 'typed';
    else if (unobs / total >= 0.9) label = 'unobserved';
    else if (pasted / total >= 0.9 && !edited && typed === 0) label = 'pasted';
    else if (pasted / total >= 0.5) label = 'pasted-edited';
    else label = 'mixed';
    return { index: idx, text: this.chars.slice(a, b).join(''), typed, pasted, unobserved: unobs, paste_ids: pids, edited_after_paste: edited, label };
  }
}

export function replay(events: TrailEvent[]): Document {
  const doc = new Document();
  for (const ev of sortEvents(events)) doc.apply(ev);
  return doc;
}

// ---- cadence ---------------------------------------------------------------------------------

function intervals(events: TrailEvent[]): number[] {
  const out: number[] = [];
  let prevEnd: number | null = null;
  for (const ev of sortEvents(events)) {
    if (ev.kind !== 'insert' && ev.kind !== 'delete') continue;
    const dts: number[] = ((ev.data.dts as any[]) || []).map((x) => Math.trunc(Number(x)));
    const start = ms(ev.ts) + (dts.length ? dts[0] : 0);
    if (prevEnd !== null) out.push(Math.max(0, start - prevEnd));
    for (let i = 1; i < dts.length; i++) out.push(dts[i]);
    let rest = 0;
    for (let i = 1; i < dts.length; i++) rest += dts[i];
    prevEnd = start + rest;
  }
  return out;
}

export function activeTimeMs(events: TrailEvent[]): number {
  const stamps = events.filter((e) => e.kind === 'insert' || e.kind === 'delete' || e.kind === 'paste').map((e) => ms(e.ts)).sort((a, b) => a - b);
  if (!stamps.length) return 0;
  let total = 0;
  let start = stamps[0];
  let prev = stamps[0];
  for (let i = 1; i < stamps.length; i++) {
    const t = stamps[i];
    if (t - prev > IDLE_MS) {
      total += prev - start + 1000;
      start = t;
    }
    prev = t;
  }
  total += prev - start + 1000;
  return total;
}

function typedChars(events: TrailEvent[]): number {
  let n = 0;
  for (const e of events) if (e.kind === 'insert') n += cpLen(String(e.data.text));
  return n;
}

function deletedChars(events: TrailEvent[]): number {
  let n = 0;
  for (const e of events) if (e.kind === 'delete') n += Math.trunc(Number(e.data.len));
  return n;
}

export function cadence(events: TrailEvent[]): Cadence {
  const iv = intervals(events);
  const typed = typedChars(events);
  const deleted = deletedChars(events);
  const activeMs = activeTimeMs(events);
  const inter = iv.filter((x) => 0 < x && x < PAUSE_MS);
  const pauses = iv.filter((x) => x >= PAUSE_MS);
  const wpm = activeMs > 0 ? typed / 5 / (activeMs / 60_000) : null;
  const m = inter.length > 1 ? mean(inter) : 0;
  return {
    typed_chars: typed,
    deleted_chars: deleted,
    correction_ratio: typed ? pyRound(deleted / typed, 4) : null,
    active_minutes: pyRound(activeMs / 60_000, 1),
    words_per_minute: wpm !== null ? pyRound(wpm, 1) : null,
    inter_key_median_ms: inter.length ? Math.trunc(median(inter)) : null,
    inter_key_cv: inter.length > 1 && m > 0 ? pyRound(pstdev(inter) / m, 3) : null,
    pauses: pauses.length,
    longest_pause_s: pauses.length ? pyRound(Math.max(...pauses) / 1000, 1) : 0,
    keystrokes: iv.length + events.filter((e) => e.kind === 'insert' || e.kind === 'delete').length,
  };
}

// ---- pastes ----------------------------------------------------------------------------------

export function pasteReport(doc: Document, _events: TrailEvent[]): Pastes {
  const surviving = doc.survivingByPaste();
  const items: PasteItem[] = [];
  for (const [pid, p] of doc.pastes) {
    const alive = surviving.get(pid) || 0;
    items.push({
      paste_id: pid,
      ts: p.ts,
      chars: p.length,
      source_host: p.source_host,
      source_kind: p.source_kind,
      from_self: p.from_self,
      surviving_chars: alive,
      surviving_ratio: p.length ? pyRound(alive / p.length, 3) : 0.0,
      text_hash: p.text_hash,
    });
  }
  items.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  const byKind: Record<string, number> = {};
  for (const i of items) byKind[i.source_kind] = (byKind[i.source_kind] || 0) + i.chars;
  const totalPasted = items.reduce((s, i) => s + i.chars, 0);
  const final = doc.chars.length;
  let pastedAlive = 0;
  for (const v of surviving.values()) pastedAlive += v;
  const sortedByKind: Record<string, number> = {};
  for (const k of Object.keys(byKind).sort()) sortedByKind[k] = byKind[k];
  return {
    count: items.length,
    pasted_chars: totalPasted,
    pasted_chars_surviving: pastedAlive,
    share_of_final_document: final ? pyRound(pastedAlive / final, 4) : 0.0,
    by_source_kind: sortedByKind,
    ai_pastes: items.filter((i) => i.source_kind === 'ai').length,
    ai_chars_surviving: items.filter((i) => i.source_kind === 'ai').reduce((s, i) => s + i.surviving_chars, 0),
    items,
  };
}

// ---- regularity -------------------------------------------------------------------------------

export function regularity(events: TrailEvent[]): Regularity {
  const iv = intervals(events).filter((x) => x > 0);
  const inter = iv.filter((x) => x < PAUSE_MS);
  const typed = typedChars(events);
  const deleted = deletedChars(events);
  const signals: RegularitySignal[] = [];
  let cv: number | null = null;
  let spread: number | null = null;
  if (inter.length >= 200) {
    cv = pstdev(inter) / mean(inter);
    const q = quantiles(inter, 4);
    const med = median(inter);
    spread = med > 0 ? (q[2] - q[0]) / med : 0.0;
    if (spread < 0.35) {
      signals.push({ signal: 'uniform_rhythm', value: pyRound(spread, 3), threshold: 0.35, meaning: 'keystroke intervals vary far less than human typing (IQR / median)' });
    }
  }
  if (typed >= 500 && deleted / typed < 0.005) {
    signals.push({ signal: 'no_corrections', value: pyRound(deleted / typed, 4), threshold: 0.005, meaning: 'almost no deletions across a long stretch of typing' });
  }
  const pauses = iv.filter((x) => x >= PAUSE_MS);
  if (typed >= 1500 && !pauses.length) {
    signals.push({ signal: 'no_pauses', value: 0, threshold: 1, meaning: 'no pause over two seconds while typing more than 1,500 characters' });
  }
  if (inter.length >= 200) {
    let longest = 1, run = 1;
    for (let i = 0; i + 1 < inter.length; i++) {
      run = Math.abs(inter[i] - inter[i + 1]) <= 2 ? run + 1 : 1;
      longest = Math.max(longest, run);
    }
    if (longest >= 40) {
      signals.push({ signal: 'identical_intervals', value: longest, threshold: 40, meaning: 'a run of keystrokes with near-identical spacing' });
    }
  }
  const score = Math.min(1.0, signals.length / 3);
  const flagged = signals.some((s) => s.signal === 'uniform_rhythm') || signals.length >= 2;
  return {
    score: pyRound(score, 2),
    flagged,
    signals,
    inter_key_cv: cv !== null ? pyRound(cv, 3) : null,
    inter_key_spread: spread !== null ? pyRound(spread, 3) : null,
    keystrokes_analysed: inter.length,
  };
}

// ---- timeline, sources, sessions ---------------------------------------------------------------

export function timeline(events: TrailEvent[]): TimelineBucket[] {
  if (!events.length) return [];
  let t0 = Infinity;
  for (const e of events) t0 = Math.min(t0, ms(e.ts));
  const buckets = new Map<number, { typed: number; deleted: number; pasted: number }>();
  for (const e of events) {
    if (e.kind !== 'insert' && e.kind !== 'delete' && e.kind !== 'paste') continue;
    const b = Math.floor((ms(e.ts) - t0) / BUCKET_MS);
    let row = buckets.get(b);
    if (!row) {
      row = { typed: 0, deleted: 0, pasted: 0 };
      buckets.set(b, row);
    }
    if (e.kind === 'insert') row.typed += cpLen(String(e.data.text));
    else if (e.kind === 'delete') row.deleted += Math.trunc(Number(e.data.len));
    else row.pasted += cpLen(String(e.data.text));
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([b, row]) => ({ bucket: b, minute: Math.floor((b * BUCKET_MS) / 60_000), ...row }));
}

export function sources(events: TrailEvent[]): SourceDwell[] {
  const agg = new Map<string, number>();
  for (const e of events) {
    if (e.kind === 'source.visit') {
      const h = String(e.data.host);
      agg.set(h, (agg.get(h) || 0) + Math.trunc(Number(e.data.dwell_ms || 0)));
    }
  }
  return [...agg.entries()].sort((a, b) => b[1] - a[1]).map(([host, d]) => ({ host, dwell_minutes: pyRound(d / 60_000, 1) }));
}

export function sessionsSummary(events: TrailEvent[]): SessionSummary[] {
  const by = new Map<string, TrailEvent[]>();
  for (const e of events) {
    let arr = by.get(e.session);
    if (!arr) {
      arr = [];
      by.set(e.session, arr);
    }
    arr.push(e);
  }
  const out: SessionSummary[] = [];
  for (const [sid, evs] of by) {
    evs.sort((a, b) => a.seq - b.seq);
    const start = evs.find((e) => e.kind === 'session.start') || evs[0];
    out.push({
      session: sid,
      start: evs[0].ts,
      end: evs[evs.length - 1].ts,
      editor: start.data.editor ?? null,
      host: start.data.host ?? null,
      active_minutes: pyRound(activeTimeMs(evs) / 60_000, 1),
      typed_chars: typedChars(evs),
      pasted_chars: evs.filter((e) => e.kind === 'paste').reduce((s, e) => s + cpLen(String(e.data.text)), 0),
      deleted_chars: deletedChars(evs),
      events: evs.length,
    });
  }
  out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return out;
}

// ---- analyse ---------------------------------------------------------------------------------------

export function analyse(events: TrailEvent[]): Analysis {
  const evs = sortEvents(events);
  const doc = replay(evs);
  const lines = doc.lines();
  const labelCounts: Record<string, number> = {};
  for (const ln of lines) labelCounts[ln.label] = (labelCounts[ln.label] || 0) + 1;
  const sortedLabels: Record<string, number> = {};
  for (const k of Object.keys(labelCounts).sort()) sortedLabels[k] = labelCounts[k];
  const finalChars = doc.chars.length;
  let typedAlive = 0;
  for (const o of doc.origin) if (o === TYPED) typedAlive += 1;
  return {
    version: ANALYSIS_VERSION,
    document: {
      doc: evs.length ? evs[0].doc : null,
      final_chars: finalChars,
      final_words: pySplitWords(doc.text).length,
      final_lines: lines.length,
      text_hash: doc.textHash(),
      typed_chars_surviving: typedAlive,
      typed_share: finalChars ? pyRound(typedAlive / finalChars, 4) : null,
      unobserved_chars: doc.unobserved_chars,
      snapshot_checks: doc.snapshot_checks,
      snapshot_mismatches: doc.snapshot_mismatches,
      resyncs: doc.resyncs,
    },
    line_labels: sortedLabels,
    cadence: cadence(evs),
    pastes: pasteReport(doc, evs),
    regularity: regularity(evs),
    timeline: timeline(evs),
    sources: sources(evs),
    sessions: sessionsSummary(evs),
    ai_notes: evs.filter((e) => e.kind === 'ai.note').map((e) => ({ ts: e.ts, ...e.data })),
    first_event: evs.length ? evs[0].ts : null,
    last_event: evs.length ? evs[evs.length - 1].ts : null,
  };
}

// ---- replay helpers for the UI -------------------------------------------------------------------------

/** Text after the first n events (events sorted by ts, seq). */
export function replayTo(events: TrailEvent[], n: number): string {
  const evs = sortEvents(events);
  const doc = new Document();
  for (let i = 0; i < Math.min(n, evs.length); i++) doc.apply(evs[i]);
  return doc.text;
}

/** 1-based cut points (index+1) of insert/delete/paste/resync events, for a replay slider:
 *  replayTo(events, editIndices(events)[k]) is the text after the k-th edit. */
export function editIndices(events: TrailEvent[]): number[] {
  const evs = sortEvents(events);
  const out: number[] = [];
  evs.forEach((e, i) => {
    if (isEdit(e.kind)) out.push(i + 1);
  });
  return out;
}

/** Incremental replay for animation: O(1) per step instead of replaying from scratch. */
export class Replayer {
  readonly events: TrailEvent[];
  readonly doc = new Document();
  private i = 0;
  constructor(events: TrailEvent[]) {
    this.events = sortEvents(events);
  }
  get position(): number {
    return this.i;
  }
  get length(): number {
    return this.events.length;
  }
  get text(): string {
    return this.doc.text;
  }
  /** Apply the next event; returns it, or null at the end. */
  step(): TrailEvent | null {
    if (this.i >= this.events.length) return null;
    const ev = this.events[this.i++];
    this.doc.apply(ev);
    return ev;
  }
  /** Advance to position n (>= current); use a fresh Replayer to go backwards. */
  seek(n: number): void {
    while (this.i < Math.min(n, this.events.length)) this.step();
  }
}

export function lines(events: TrailEvent[]): LineProvenance[] {
  return replay(events).lines().map(({ index, text, typed, pasted, unobserved, label }) => ({ index, text, typed, pasted, unobserved, label }));
}

// ---- drafts ---------------------------------------------------------------------------------------------

export function drafts(events: TrailEvent[], fractions: number[] = [0.25, 0.5, 0.75, 1.0]): Draft[] {
  const evs = sortEvents(events);
  const edits: number[] = [];
  evs.forEach((e, i) => {
    if (isEdit(e.kind)) edits.push(i);
  });
  const out: Draft[] = [];
  if (!edits.length) return out;
  for (const f of fractions) {
    const cut = edits[Math.min(edits.length - 1, pyRoundInt(f * (edits.length - 1)))];
    const doc = new Document();
    for (let i = 0; i <= cut; i++) doc.apply(evs[i]);
    out.push({ fraction: f, ts: evs[cut].ts, chars: doc.chars.length, words: pySplitWords(doc.text).length, text: doc.text });
  }
  return out;
}

// ---- declaration ----------------------------------------------------------------------------------------

export function declaration(a: Analysis, meta: { student?: string; course?: string } = {}): string {
  const p = a.pastes;
  const aiItems = p.items.filter((i) => i.source_kind === 'ai');
  const final = a.document.final_chars || 1;
  const lines: string[] = ['# AI use declaration', ''];
  if (meta.student) lines.push(`**Student:** ${meta.student}  `);
  if (meta.course) lines.push(`**Course / assignment:** ${meta.course}  `);
  lines.push(`**Document record:** ${a.document.doc}  `);
  let activeSum = 0;
  for (const s of a.sessions) activeSum += s.active_minutes;
  lines.push(
    `**Written between:** ${(a.first_event || '').slice(0, 10)} and ${(a.last_event || '').slice(0, 10)}, ${pyFormatFixed(activeSum, 0)} active minutes over ${a.sessions.length} sessions  `,
  );
  lines.push('');
  if (!aiItems.length && !a.ai_notes.length) {
    lines.push('No text in this document was pasted from an AI assistant, and I declare no other AI assistance.');
  } else {
    if (aiItems.length) {
      const alive = aiItems.reduce((s, i) => s + i.surviving_chars, 0);
      const hosts = [...new Set(aiItems.map((i) => i.source_host).filter((h): h is string => !!h))].sort();
      const edited = aiItems.some((i) => 0 < i.surviving_ratio && i.surviving_ratio < 1);
      lines.push(
        `I pasted text from ${hosts.join(', ') || 'an AI assistant'} on ${aiItems.length} occasion(s). ` +
          `${pyThousands(alive)} characters of that text remain in the final document (${pyPercent1(alive / final)} of it). ` +
          (edited ? 'Some of that text was edited after pasting.' : ''),
      );
    }
    for (const n of a.ai_notes) lines.push(`- ${n.tool ?? 'None'}: ${n.note ?? 'None'}`);
    lines.push('');
    lines.push('Everything else in the document was typed by me.');
  }
  lines.push('', `This declaration was generated from my writing record (analysis v${a.version}, AI host list v${AI_HOSTS_VERSION}); the record can be verified with the included script.`, '');
  return lines.join('\n');
}

// ---- patterns ---------------------------------------------------------------------------------------------

export function patterns(analyses: Analysis[]): Patterns {
  const hours: number[] = new Array(24).fill(0);
  const sessionMinutes: number[] = [];
  const wpm: number[] = [];
  const corr: number[] = [];
  const typedShare: number[] = [];
  for (const a of analyses) {
    for (const s of a.sessions) {
      const h = tsHourUtc(s.start);
      hours[h] += s.active_minutes;
      sessionMinutes.push(s.active_minutes);
    }
    if (a.cadence.words_per_minute) wpm.push(a.cadence.words_per_minute);
    if (a.cadence.correction_ratio !== null) corr.push(a.cadence.correction_ratio);
    if (a.document.typed_share !== null) typedShare.push(a.document.typed_share);
  }
  sessionMinutes.sort((a, b) => a - b);
  const med = sessionMinutes.length ? sessionMinutes[Math.floor(sessionMinutes.length / 2)] : null;
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const bestHours = hours.some((h) => h) ? [...Array(24).keys()].sort((x, y) => -hours[x] - -hours[y]).slice(0, 3) : [];
  return {
    documents: analyses.length,
    sessions: sessionMinutes.length,
    best_hours: bestHours,
    active_minutes_by_hour: hours,
    median_session_minutes: med,
    words_per_minute: wpm.length ? pyRound(sum(wpm) / wpm.length, 1) : null,
    correction_ratio: corr.length ? pyRound(sum(corr) / corr.length, 3) : null,
    typed_share: typedShare.length ? pyRound(sum(typedShare) / typedShare.length, 3) : null,
    total_words: analyses.reduce((s, a) => s + a.document.final_words, 0),
  };
}
