import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, IconButton, Window } from './desktop';
import { usePrefersReducedMotion } from './motion';

/*
 * ReplayHero: an essay being written, as a time-lapse, in a player window.
 * The script below is compiled once into "micro" events (one per keystroke,
 * one per paste, strike/cut for a rewrite, one per session gap). Playback is a
 * requestAnimationFrame clock; the document at step k is rebuilt from scratch
 * (a few hundred splices), which makes scrubbing, looping and pausing trivial.
 * One DOM node per run of same-origin text, never per character.
 *
 * The window: striped title bar (essay title, timecode at the right), the essay
 * sheet, the transport bar (step back, play/pause, step forward, bevelled scrubber),
 * and a provenance strip that fills in as the record grows. Only the record moves.
 */

export type ReplayOp =
  | { t: number; op: 'type'; text: string; before?: string }
  | { t: number; op: 'delete'; len?: number; find?: string; pos?: number }
  | { t: number; op: 'paste'; text: string; src: string; before?: string }
  | { t: number; op: 'gap'; min: number };

/** t = seconds since the session began (virtual). Positions resolve by substring so the script stays readable. */
export const SCRIPT: ReplayOp[] = [
  { t: 0, op: 'type', text: 'Cities are not designed for silence.' },
  { t: 9, op: 'type', text: ' In the spring of 2020, ' },
  { t: 17, op: 'type', text: 'New York recored' },
  { t: 22, op: 'delete', len: 4 },
  { t: 23, op: 'type', text: 'orded its quietest month' },
  { t: 31, op: 'type', text: ' since seismographs began listening.' },
  { t: 44, op: 'type', text: '\n\n' },
  { t: 50, op: 'type', text: 'This essay argues that the quiet ' },
  { t: 62, op: 'type', text: 'was not an absence but a measurement.' },
  { t: 78, op: 'gap', min: 22 },
  { t: 1400, op: 'delete', find: 'This essay argues that the quiet was not an absence but a measurement.' },
  { t: 1406, op: 'type', text: 'The quiet, I will argue, was not an absence.' },
  { t: 1424, op: 'type', text: ' It was a measurement: ' },
  { t: 1433, op: 'type', text: 'the first time the city could hear itself.' },
  { t: 1452, op: 'type', text: '\n\n' },
  { t: 1460, op: 'paste', src: 'jstor.org', text: 'Seismic noise levels in urban areas fell by up to 50% during lockdown periods (Lecocq et al., 2020).' },
  { t: 1478, op: 'delete', find: 'Seismic noise levels in urban areas fell' },
  { t: 1481, op: 'type', text: 'Urban seismic noise fell', before: ' by up to 50%' },
  { t: 1494, op: 'type', text: ' That number is where this essay starts.' },
  { t: 1512, op: 'gap', min: 38 },
  { t: 3800, op: 'type', text: '\n\n' },
  { t: 3806, op: 'paste', src: 'chatgpt.com', text: 'The pandemic fundamentally transformed the urban soundscape in unprecedented ways.' },
  { t: 3824, op: 'delete', find: 'The pandemic fundamentally transformed the urban soundscape in unprecedented ways.' },
  { t: 3831, op: 'type', text: 'What the quiet exposed was ' },
  { t: 3842, op: 'type', text: 'everything the noise had been covering: ' },
  { t: 3856, op: 'type', text: 'birdsong, arguments, ' },
  { t: 3864, op: 'type', text: 'the hum of a fridge two floors down.' },
  { t: 3880, op: 'type', text: ' This essay listens to that.' },
  { t: 3895, op: 'type', text: '\n\n' },
  { t: 3900, op: 'type', text: 'Listening is not a metafor' },
  { t: 3910, op: 'delete', len: 3 },
  { t: 3911, op: 'type', text: 'phor here.' },
  { t: 3915, op: 'type', text: ' It is the method.' },
];

type Origin = 'typed' | 'pasted';
type Micro = { at: number; vt: number } & (
  | { k: 'ins'; pos: number; ch: string }
  | { k: 'del'; pos: number }
  | { k: 'strike'; pos: number; len: number }
  | { k: 'cut'; pos: number; len: number }
  | { k: 'paste'; pos: number; text: string; src: string; pid: number }
  | { k: 'gap'; min: number }
);
type Ch = { c: string; o: Origin; pid?: number; s?: boolean };
type Doc = { chars: Ch[]; cursor: number; edited: Set<number>; gap?: number };

const jitter = (i: number) => ((i * 7919 + 13) % 97) / 97;

function compile(script: ReplayOp[], speed = 1): Micro[] {
  const out: Micro[] = [];
  let text = '';
  let at = 0;
  let pid = 0;
  const idx = (s: string | undefined) => (s ? text.indexOf(s) : -1);
  script.forEach((s, si) => {
    const next = script[si + 1]?.t ?? s.t + 8;
    const start = out.length;
    if (s.op === 'type' || s.op === 'paste') {
      let pos = idx(s.before);
      if (pos < 0) pos = text.length;
      if (s.op === 'type') {
        for (let i = 0; i < s.text.length; i++) {
          const ch = s.text[i];
          const prev = s.text[i - 1];
          at += (30 + 50 * jitter(out.length)) * speed;
          if (prev === ' ') at += 20 * speed;
          if (prev === '.' || prev === ',' || prev === ':') at += 150 * speed;
          if (ch === '\n') at += 260 * speed;
          out.push({ at, vt: 0, k: 'ins', pos: pos + i, ch });
        }
      } else {
        at += 350 * speed;
        out.push({ at, vt: 0, k: 'paste', pos, text: s.text, src: s.src, pid: ++pid });
        at += 600 * speed;
      }
      text = text.slice(0, pos) + s.text + text.slice(pos);
    } else if (s.op === 'delete') {
      let pos: number, len: number;
      if (s.find) {
        pos = idx(s.find);
        len = s.find.length;
      } else {
        len = s.len ?? 1;
        pos = s.pos ?? text.length - len;
      }
      if (pos < 0) return;
      if (len >= 12) {
        at += 450 * speed;
        out.push({ at, vt: 0, k: 'strike', pos, len });
        at += 700 * speed;
        out.push({ at, vt: 0, k: 'cut', pos, len });
      } else {
        at += 220 * speed;
        for (let i = len - 1; i >= 0; i--) {
          at += 60 * speed;
          out.push({ at, vt: 0, k: 'del', pos: pos + i });
        }
      }
      text = text.slice(0, pos) + text.slice(pos + len);
    } else {
      at += 300 * speed;
      out.push({ at, vt: next, k: 'gap', min: s.min });
      at += 1100 * speed;
    }
    const n = out.length - start;
    if (s.op !== 'gap') for (let i = start; i < out.length; i++) out[i].vt = s.t + ((i - start) / n) * (next - s.t);
  });
  return out;
}

function build(micro: Micro[], k: number): Doc {
  const chars: Ch[] = [];
  const edited = new Set<number>();
  let cursor = 0;
  let gap: number | undefined;
  for (let i = 0; i < k; i++) {
    const m = micro[i];
    gap = undefined;
    switch (m.k) {
      case 'ins': {
        const a = chars[m.pos - 1]?.pid;
        if (a && a === chars[m.pos]?.pid) edited.add(a);
        chars.splice(m.pos, 0, { c: m.ch, o: 'typed' });
        cursor = m.pos + 1;
        break;
      }
      case 'del': {
        const p = chars[m.pos]?.pid;
        if (p) edited.add(p);
        chars.splice(m.pos, 1);
        cursor = m.pos;
        break;
      }
      case 'strike':
        for (let j = m.pos; j < m.pos + m.len; j++) chars[j].s = true;
        cursor = m.pos + m.len;
        break;
      case 'cut':
        for (let j = m.pos; j < m.pos + m.len; j++) if (chars[j].pid) edited.add(chars[j].pid as number);
        chars.splice(m.pos, m.len);
        cursor = m.pos;
        break;
      case 'paste':
        chars.splice(m.pos, 0, ...Array.from(m.text, (c) => ({ c, o: 'pasted' as Origin, pid: m.pid })));
        cursor = m.pos + m.text.length;
        break;
      case 'gap':
        gap = m.min;
    }
  }
  return { chars, cursor, edited, gap };
}

const START = 22 * 60 + 41; // 22:41, when essays get written
const clock = (vt: number) => {
  const m = (START + Math.floor(vt / 60)) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const words = (d: Doc) => d.chars.map((c) => c.c).join('').split(/\s+/).filter(Boolean).length;

type ProvLabel = 'typed' | 'pasted' | 'pasted-edited' | 'mixed';
const PROV_NAME: Record<ProvLabel, string> = { typed: 'typed', pasted: 'pasted', 'pasted-edited': 'pasted, then edited', mixed: 'mixed' };

/** The document so far, one cell per line of about `width` mono characters, labelled by where its text came from. */
function stripCells(doc: Doc, width = 64): ProvLabel[] {
  const cells: ProvLabel[] = [];
  let run: Ch[] = [];
  const push = () => {
    if (!run.length) return;
    const live = run.filter((c) => !c.s);
    const pasted = live.filter((c) => c.o === 'pasted');
    const typed = live.filter((c) => c.o === 'typed');
    if (!pasted.length) cells.push('typed');
    else if (!typed.length) cells.push(pasted.some((c) => c.pid && doc.edited.has(c.pid)) ? 'pasted-edited' : 'pasted');
    else cells.push('mixed');
    run = [];
  };
  for (const c of doc.chars) {
    if (c.c === '\n') {
      push();
      continue;
    }
    run.push(c);
    if (run.length >= width) push();
  }
  push();
  return cells;
}

/** The page itself: paragraphs of runs. */
function Page({ doc, src, caret, caretRef }: { doc: Doc; src: Map<number, string>; caret: boolean; caretRef?: React.RefObject<HTMLSpanElement> }) {
  const paras: ReactNode[] = [];
  let runs: ReactNode[] = [];
  let run: Ch[] = [];
  const seen = new Set<number>();
  const flush = () => {
    if (!run.length) return;
    const h = run[0];
    const text = run.map((c) => c.c).join('');
    const key = `${paras.length}-${runs.length}`;
    if (h.pid) {
      const first = !seen.has(h.pid);
      seen.add(h.pid);
      runs.push(
        <span key={`p${h.pid}-${key}`}>
          {first && <span className="inline-block align-baseline font-mono text-[10px] leading-none tracking-wide text-paste border border-paste px-1 py-[2px] mr-1 select-none">{src.get(h.pid)}</span>}
          <span className={h.s ? 'strike' : doc.edited.has(h.pid) ? 'prov-paste-edited' : 'prov-paste'}>{text}</span>
        </span>,
      );
    } else
      runs.push(
        <span key={key} className={h.s ? 'strike' : undefined}>
          {text}
        </span>,
      );
    run = [];
  };
  const endPara = () => {
    flush();
    if (runs.length) paras.push(<p key={paras.length}>{runs}</p>);
    runs = [];
  };
  doc.chars.forEach((c, i) => {
    if (caret && i === doc.cursor) {
      flush();
      runs.push(<span key="caret" ref={caretRef} className="caret" aria-hidden />);
    }
    if (c.c === '\n') return endPara();
    const h = run[0];
    if (h && (h.o !== c.o || h.pid !== c.pid || !!h.s !== !!c.s)) flush();
    run.push(c);
  });
  if (caret && doc.cursor >= doc.chars.length) {
    flush();
    runs.push(<span key="caret" ref={caretRef} className="caret" aria-hidden />);
  }
  endPara();
  return <>{paras}</>;
}

/** The paper strip under the transport: counts and the provenance cells so far. */
function Strip({ doc, w, typed, pasted }: { doc: Doc; w: number; typed: number; pasted: number }) {
  const cells = useMemo(() => stripCells(doc), [doc]);
  const counts = cells.reduce((acc, c) => ((acc[c] = (acc[c] || 0) + 1), acc), {} as Partial<Record<ProvLabel, number>>);
  const summary = (Object.keys(counts) as ProvLabel[]).map((k) => `${counts[k]} ${PROV_NAME[k]}`).join(', ');
  return (
    <div className="px-4 py-2 border-t border-frame bg-sheet grid gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-ink-soft tabular">
        <span className="marginal">Where each line came from</span>
        <span className="ml-auto">{w} words</span>
        <span className="text-typed">{typed} typed</span>
        <span className="text-paste">{pasted} pasted</span>
      </div>
      <div className="prov-strip" role="img" aria-label={cells.length ? `Where each line came from so far: ${summary}` : 'Nothing written yet'}>
        {cells.map((c, i) => (
          <span key={i} className={`is-${c}`} />
        ))}
      </div>
    </div>
  );
}

const SHEET = 'essay px-4 sm:px-6 pt-4 pb-6 h-[320px] sm:h-[380px] [&>p]:mb-[1em]';

export type ReplayHeroProps = { script?: ReplayOp[]; title?: string; editor?: string; speed?: number; className?: string };

export function ReplayHero({ script = SCRIPT, title = 'Cities and silence', editor = 'Google Docs', speed = 1, className = '' }: ReplayHeroProps) {
  const reduced = usePrefersReducedMotion();
  const micro = useMemo(() => compile(script, speed), [script, speed]);
  const src = useMemo(() => new Map(micro.flatMap((m) => (m.k === 'paste' ? [[m.pid, m.src] as [number, string]] : []))), [micro]);
  const total = micro.length;
  const [k, setK] = useState(reduced ? total : 0);
  const [userPaused, setUserPaused] = useState(false);
  const [held, setHeld] = useState(false); // hover or scrubber focus
  const playing = !reduced && !userPaused && !held;
  const kRef = useRef(k);
  const clockRef = useRef(0); // playback ms at last pause
  const originRef = useRef(0); // performance.now() at playback ms 0
  const sheet = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);

  // playback clock
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    originRef.current = performance.now() - clockRef.current;
    let last = performance.now();
    const tick = (now: number) => {
      if (now - last > 600) originRef.current += now - last; // tab was hidden: do not skip ahead
      last = now;
      const el = now - originRef.current;
      let n = kRef.current;
      if (n >= total) {
        if (el - micro[total - 1].at > 2600) {
          originRef.current = now;
          n = 0;
        }
      } else while (n < total && micro[n].at <= el) n++;
      if (n !== kRef.current) {
        kRef.current = n;
        setK(n);
      }
      clockRef.current = now - originRef.current;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, micro, total]);

  const doc = useMemo(() => build(micro, k), [micro, k]);

  // keep the caret on the page
  useEffect(() => {
    const el = sheet.current,
      c = caretRef.current;
    if (!el || !c) return;
    const want = c.offsetTop - el.clientHeight * 0.62;
    if (c.offsetTop > el.scrollTop + el.clientHeight - 40 || c.offsetTop < el.scrollTop) el.scrollTop = Math.max(0, want);
  }, [doc.cursor]);

  const seek = (n: number) => {
    kRef.current = n;
    clockRef.current = n > 0 ? micro[n - 1].at : 0;
    originRef.current = performance.now() - clockRef.current;
    setK(n);
  };

  // the moments worth stepping to: the start, every paste, every session gap, the end
  const marks = useMemo(() => {
    const m = [0];
    micro.forEach((x, i) => {
      if (x.k === 'paste' || x.k === 'gap') m.push(i);
    });
    m.push(total);
    return m;
  }, [micro, total]);
  const back = () => seek([...marks].reverse().find((m) => m < kRef.current - 1) ?? 0);
  const forward = () => seek(marks.find((m) => m > kRef.current) ?? total);

  const vt = k > 0 ? micro[k - 1].vt : 0;
  const w = words(doc);
  const typed = doc.chars.filter((c) => c.o === 'typed' && !c.s).length;
  const pasted = doc.chars.filter((c) => c.o === 'pasted' && !c.s).length;
  const pct = Math.round((k / total) * 100);

  /* ---------- reduced motion: three drafts, step control ---------- */
  if (reduced) {
    return <Stills micro={micro} src={src} title={title} editor={editor} className={className} />;
  }

  return (
    <div className={`min-w-0 ${className}`} onPointerEnter={(e) => e.pointerType === 'mouse' && setHeld(true)} onPointerLeave={(e) => e.pointerType === 'mouse' && setHeld(false)}>
      <Window as="figure" title={title} icon="document" right={clock(vt)} bodyClassName="p-0">
        <div ref={sheet} className={`${SHEET} overflow-hidden`} aria-live="off">
          <Page doc={doc} src={src} caret caretRef={caretRef} />
        </div>
        <div className="transport on-chrome">
          <IconButton icon="back" label="Back to the previous moment" onClick={back} />
          <IconButton icon={userPaused ? 'play' : 'pause'} label={userPaused ? 'Play replay' : 'Pause replay'} onClick={() => setUserPaused((p) => !p)} />
          <IconButton icon="forward" label="Forward to the next moment" onClick={forward} />
          <div className="relative flex-1 min-w-[6rem]">
            {micro.map((m, i) =>
              m.k === 'paste' || m.k === 'gap' ? <span key={i} aria-hidden className={`absolute top-0 w-[2px] h-[6px] ${m.k === 'paste' ? 'bg-paste' : 'bg-margin'}`} style={{ left: `calc(${(i / total) * 100}% - 1px)` }} /> : null,
            )}
            <input
              type="range"
              className="range relative"
              min={0}
              max={total}
              value={k}
              onChange={(e) => seek(Number(e.target.value))}
              onFocus={() => setHeld(true)}
              onBlur={() => setHeld(false)}
              aria-label="Replay position"
              aria-valuetext={`${pct}% through, ${w} words`}
            />
          </div>
          <span className="tabular whitespace-nowrap">{doc.gap ? `${doc.gap} min later` : editor}</span>
        </div>
        <Strip doc={doc} w={w} typed={typed} pasted={pasted} />
      </Window>
    </div>
  );
}

function Stills({ micro, src, title, editor, className }: { micro: Micro[]; src: Map<number, string>; title: string; editor: string; className: string }) {
  const total = micro.length;
  const drafts = useMemo(() => [0.3, 0.64, 1].map((f) => build(micro, Math.round(f * total))), [micro, total]);
  const [i, setI] = useState(2);
  const d = drafts[i];
  const vt = micro[Math.round([0.3, 0.64, 1][i] * total) - 1].vt;
  const typed = d.chars.filter((c) => c.o === 'typed' && !c.s).length;
  const pasted = d.chars.filter((c) => c.o === 'pasted' && !c.s).length;
  return (
    <div className={`min-w-0 ${className}`}>
      <Window as="figure" title={title} icon="document" right={clock(vt)} bodyClassName="p-0">
        <div className={`${SHEET} overflow-auto`}>
          <Page doc={d} src={src} caret={false} />
        </div>
        <div className="transport on-chrome flex-wrap">
          <span role="group" aria-label="Choose a draft" className="flex gap-1">
            {['Draft 1', 'Draft 2', 'Final'].map((l, j) => (
              <Button key={l} size="sm" aria-pressed={i === j} onClick={() => setI(j)}>
                {l}
              </Button>
            ))}
          </span>
          <span className="ml-auto tabular whitespace-nowrap">{editor}</span>
        </div>
        <Strip doc={d} w={words(d)} typed={typed} pasted={pasted} />
      </Window>
    </div>
  );
}

export default ReplayHero;
