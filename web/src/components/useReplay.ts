// The replay engine. A custom requestAnimationFrame renderer over the shared Replayer:
// one DOM line per essay line, provenance runs inside it, session gaps compressed to a beat.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Replayer, editIndices, ms, sortEvents } from '../lib/analysis';
import type { TrailEvent } from '../lib/types';
import { fmtGap } from './format';

export type RunClass = 'typed' | 'paste' | 'unobserved';
export type Run = { cls: RunClass; text: string; pid?: string };
export type Line = { key: number; runs: Run[]; caret: number | null; pasteHere: PasteMark | null };
export type PasteMark = { pid: string; host: string | null; kind: string; chars: number };

export type Frame = {
  position: number; // events applied
  lines: Line[];
  words: number;
  chars: number;
  elapsedMs: number; // wall-clock time since the first event
  gapNote: string | null; // "2h 14m later" when a long gap precedes this position
  lastPaste: PasteMark | null;
};

export type Schedule = {
  events: TrailEvent[];
  times: number[]; // virtual ms at which position p is reached, length n+1
  duration: number;
  milestones: number[]; // positions for 25/50/75/100% of edits (same cut as drafts())
  gapNotes: Map<number, string>;
  edits: number;
};

const BEAT_MS = 1200; // what a long pause becomes on screen
const PAUSE_MS = 2000;

function pyRoundInt(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

export function buildSchedule(events: TrailEvent[]): Schedule {
  const evs = sortEvents(events);
  const n = evs.length;
  const times = new Array<number>(n + 1).fill(0);
  const gapNotes = new Map<number, string>();
  for (let p = 1; p <= n; p++) {
    const raw = p >= 2 ? Math.max(0, ms(evs[p - 1].ts) - ms(evs[p - 2].ts)) : 0;
    let comp = raw;
    if (raw > PAUSE_MS) {
      comp = BEAT_MS;
      if (raw > 60_000) gapNotes.set(p, fmtGap(raw));
    }
    times[p] = times[p - 1] + comp;
  }
  const idx = editIndices(evs);
  const milestones = [0.25, 0.5, 0.75, 1.0].map((f) => (idx.length ? idx[Math.min(idx.length - 1, pyRoundInt(f * (idx.length - 1)))] : 0));
  return { events: evs, times, duration: times[n], milestones, gapNotes, edits: idx.length };
}

function positionAt(times: number[], vt: number): number {
  // largest p with times[p] <= vt
  let lo = 0,
    hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid] <= vt) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

const cpLen = (s: string) => Array.from(s).length;

function caretAfter(ev: TrailEvent | null, len: number): number | null {
  if (!ev) return null;
  const d = ev.data;
  const pos = Math.trunc(Number(d.pos));
  if (ev.kind === 'insert' || ev.kind === 'paste') return pos < 0 ? len : Math.min(len, pos + cpLen(String(d.text)));
  if (ev.kind === 'delete') return pos < 0 ? len : Math.min(len, pos);
  if (ev.kind === 'resync') return len;
  return null;
}

function renderFrame(sched: Schedule, rep: Replayer, position: number): Frame {
  const doc = rep.doc;
  const chars = doc.chars;
  const origin = doc.origin;
  const n = chars.length;
  // last edit event applied → caret and paste mark
  let lastEdit: TrailEvent | null = null;
  let lastPaste: PasteMark | null = null;
  for (let i = position - 1; i >= 0 && (!lastEdit || !lastPaste); i--) {
    const e = sched.events[i];
    if (!lastEdit && (e.kind === 'insert' || e.kind === 'delete' || e.kind === 'paste' || e.kind === 'resync')) lastEdit = e;
    if (!lastPaste && e.kind === 'paste') {
      const info = doc.pastes.get(String(e.data.paste_id));
      lastPaste = { pid: String(e.data.paste_id), host: info?.source_host ?? e.data.source_host ?? null, kind: info?.source_kind ?? 'unknown', chars: cpLen(String(e.data.text)) };
    }
    if (position - i > 400 && lastEdit) break; // do not scan the whole record for a paste that is far back
  }
  const caret = caretAfter(lastEdit, n);
  const lines: Line[] = [];
  let start = 0;
  let key = 0;
  let words = 0;
  while (start <= n) {
    let end = chars.indexOf('\n', start);
    if (end < 0) end = n;
    const runs: Run[] = [];
    let cur: Run | null = null;
    let inWord = false;
    let pasteHere: PasteMark | null = null;
    for (let j = start; j < end; j++) {
      const o = origin[j];
      const cls: RunClass = o === 'typed' ? 'typed' : o === 'unobserved' ? 'unobserved' : 'paste';
      const pid = cls === 'paste' ? o.slice(6) : undefined;
      if (lastPaste && pid === lastPaste.pid && !pasteHere) pasteHere = lastPaste;
      if (!cur || cur.cls !== cls || cur.pid !== pid) {
        cur = { cls, text: '', pid };
        runs.push(cur);
      }
      const ch = chars[j];
      cur.text += ch;
      const ws = ch === ' ' || ch === '\t';
      if (!ws && !inWord) words++;
      inWord = !ws;
    }
    const caretHere = caret !== null && caret >= start && caret <= end ? caret - start : null;
    lines.push({ key: key++, runs, caret: caretHere, pasteHere });
    start = end + 1;
    if (end === n) break;
  }
  const first = sched.events[0];
  const last = position > 0 ? sched.events[position - 1] : null;
  return {
    position,
    lines,
    words,
    chars: n,
    elapsedMs: first && last ? Math.max(0, ms(last.ts) - ms(first.ts)) : 0,
    gapNote: sched.gapNotes.get(position) ?? null,
    lastPaste,
  };
}

export type ReplayOptions = {
  autoplay?: boolean;
  loop?: boolean;
  speed?: number;
  still?: boolean; // reduced motion: milestones only, no rAF
  startAt?: 'start' | 'end' | number;
};

export function useReplay(events: TrailEvent[], opts: ReplayOptions = {}) {
  const sched = useMemo(() => buildSchedule(events), [events]);
  const repRef = useRef<Replayer | null>(null);
  const vtRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);
  const holdRef = useRef(0);
  const [speed, setSpeed] = useState(opts.speed ?? 4);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);

  const go = useCallback(
    (position: number): Frame => {
      const p = Math.max(0, Math.min(sched.events.length, position));
      let rep = repRef.current;
      if (!rep || rep.position > p || rep.events !== sched.events) {
        rep = new Replayer(sched.events);
        repRef.current = rep;
      }
      rep.seek(p);
      return renderFrame(sched, rep, p);
    },
    [sched],
  );

  const initial = (): number => {
    const s = opts.startAt ?? (opts.still ? sched.milestones[0] : 'start');
    if (s === 'start') return 0;
    if (s === 'end') return sched.events.length;
    return s;
  };
  const [frame, setFrame] = useState<Frame>(() => go(initial()));

  // re-seed when events change
  useEffect(() => {
    repRef.current = null;
    vtRef.current = 0;
    const p = initial();
    vtRef.current = sched.times[p] ?? 0;
    setFrame(go(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sched]);

  const stop = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastRef.current = null;
  }, []);

  const tick = useCallback(
    (now: number) => {
      if (!playingRef.current) return;
      const last = lastRef.current ?? now;
      lastRef.current = now;
      const dt = now - last;
      if (holdRef.current > 0) {
        holdRef.current -= dt;
        if (holdRef.current <= 0) {
          vtRef.current = 0;
          setFrame(go(0));
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      vtRef.current += dt * speedRef.current;
      const p = positionAt(sched.times, vtRef.current);
      setFrame((f) => (f.position === p ? f : go(p)));
      if (p >= sched.events.length) {
        if (opts.loop) {
          holdRef.current = 2600;
        } else {
          stop();
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [sched, go, opts.loop, stop],
  );

  const play = useCallback(() => {
    if (opts.still || !sched.events.length) return;
    if (positionAt(sched.times, vtRef.current) >= sched.events.length) {
      vtRef.current = 0;
      setFrame(go(0));
    }
    playingRef.current = true;
    setPlaying(true);
    lastRef.current = null;
    holdRef.current = 0;
    rafRef.current = requestAnimationFrame(tick);
  }, [opts.still, sched, go, tick]);

  const seek = useCallback(
    (position: number) => {
      const p = Math.max(0, Math.min(sched.events.length, position));
      vtRef.current = sched.times[p];
      holdRef.current = 0;
      setFrame(go(p));
    },
    [sched, go],
  );

  const toggle = useCallback(() => (playingRef.current ? stop() : play()), [play, stop]);

  useEffect(() => {
    if (opts.autoplay && !opts.still) play();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sched, opts.autoplay, opts.still]);

  // pause when the tab is hidden; resume when visible
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) lastRef.current = null;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const milestoneIndex = sched.milestones.findIndex((m) => m >= frame.position);
  return {
    frame,
    schedule: sched,
    playing,
    play,
    stop,
    toggle,
    seek,
    speed,
    setSpeed,
    total: sched.events.length,
    progress: sched.events.length ? frame.position / sched.events.length : 0,
    milestoneIndex: milestoneIndex < 0 ? sched.milestones.length - 1 : milestoneIndex,
  };
}
