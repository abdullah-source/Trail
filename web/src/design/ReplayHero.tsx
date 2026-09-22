import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE, usePrefersReducedMotion } from './motion';

/*
 * ReplayHero: an essay being written, as a time-lapse.
 * The script below is compiled once into "micro" events (one per keystroke,
 * one per paste, strike/cut for a rewrite, one per session gap). Playback is a
 * requestAnimationFrame clock; the document at step k is rebuilt from scratch
 * (a few hundred splices), which makes scrubbing, looping and pausing trivial.
 * One DOM node per run of same-origin text, never per character.
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
        <motion.span key={`p${h.pid}-${key}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45, ease: EASE }}>
          {first && (
            <motion.span
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, ease: EASE, delay: 0.1 }}
              className="inline-block align-baseline font-mono text-[10px] leading-none tracking-wide text-paste border border-paste/50 rounded-sm px-1 py-[2px] mr-1 select-none"
            >
              {src.get(h.pid)}
            </motion.span>
          )}
          <span className={h.s ? 'strike' : doc.edited.has(h.pid) ? 'prov-paste-edited' : 'prov-paste'}>{text}</span>
        </motion.span>,
      );
    } else runs.push(<span key={key} className={h.s ? 'strike' : undefined}>{text}</span>);
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
    const el = sheet.current, c = caretRef.current;
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

  const vt = k > 0 ? micro[k - 1].vt : 0;
  const w = words(doc);
  const typed = doc.chars.filter((c) => c.o === 'typed' && !c.s).length;
  const pasted = doc.chars.filter((c) => c.o === 'pasted' && !c.s).length;
  const pct = Math.round((k / total) * 100);

  const header = (
    <div className="flex items-center gap-3 px-4 sm:px-5 h-9 border-b border-rule text-[11px] font-mono text-ink-soft">
      <span className="inline-block w-2 h-2 rounded-full bg-margin" aria-hidden />
      <span className="truncate">{title}</span>
      <span className="ml-auto hidden sm:inline">{editor}</span>
    </div>
  );

  /* ---------- reduced motion: three drafts, step control, crossfade ---------- */
  if (reduced) {
    return <Stills micro={micro} src={src} header={header} className={className} />;
  }

  return (
    <figure
      className={`bg-sheet border border-rule rounded-lg shadow-sheet overflow-hidden ${className}`}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHeld(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHeld(false)}
      aria-label="Time-lapse of an essay being written, with typed text in ink and pasted text highlighted"
    >
      {header}
      <div ref={sheet} className="essay text-[17px] sm:text-[18px] px-5 sm:px-8 pt-5 pb-8 h-[320px] sm:h-[380px] overflow-hidden [&>p]:mb-[1em]" aria-live="off">
        <Page doc={doc} src={src} caret caretRef={caretRef} />
      </div>
      <div className="border-t border-rule px-4 sm:px-5 pt-2 pb-3 grid gap-1">
        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap font-mono text-[11px] text-ink-soft tabular">
          <span>{clock(vt)}</span>
          <AnimatePresence>
            {doc.gap && (
              <motion.span key="gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-margin">
                {doc.gap} min later
              </motion.span>
            )}
          </AnimatePresence>
          <span className="ml-auto">{w} words</span>
          <span className="text-typed">{typed} typed</span>
          <span className="text-paste">{pasted} pasted</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            aria-pressed={userPaused}
            aria-label={userPaused ? 'Play replay' : 'Pause replay'}
            className="shrink-0 w-8 h-8 rounded-md border border-rule-strong text-ink hover:bg-well flex items-center justify-center"
          >
            {userPaused ? (
              <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden><path d="M1 1l8 5-8 5z" fill="currentColor" /></svg>
            ) : (
              <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden><path d="M1 1h3v10H1zM6 1h3v10H6z" fill="currentColor" /></svg>
            )}
          </button>
          <div className="relative flex-1">
            <div className="absolute left-0 right-0 top-[13px] h-[2px] bg-rule-strong" aria-hidden>
              <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            {micro.map((m, i) =>
              m.k === 'paste' || m.k === 'gap' ? (
                <span
                  key={i}
                  aria-hidden
                  className={`absolute top-[10px] w-[3px] h-[8px] rounded-sm ${m.k === 'paste' ? 'bg-paste' : 'bg-margin'}`}
                  style={{ left: `calc(${(i / total) * 100}% - 1px)` }}
                />
              ) : null,
            )}
            <input
              type="range"
              className="range bare relative"
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
        </div>
      </div>
    </figure>
  );
}

function Stills({ micro, src, header, className }: { micro: Micro[]; src: Map<number, string>; header: ReactNode; className: string }) {
  const total = micro.length;
  const drafts = useMemo(() => [0.3, 0.64, 1].map((f) => build(micro, Math.round(f * total))), [micro, total]);
  const [i, setI] = useState(2);
  const d = drafts[i];
  const vt = micro[Math.round([0.3, 0.64, 1][i] * total) - 1].vt;
  return (
    <figure className={`bg-sheet border border-rule rounded-lg shadow-sheet overflow-hidden ${className}`} aria-label="Three drafts of an essay, typed text in ink and pasted text highlighted">
      {header}
      <div className="essay text-[17px] sm:text-[18px] px-5 sm:px-8 pt-5 pb-8 h-[320px] sm:h-[380px] overflow-auto [&>p]:mb-[1em]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <Page doc={d} src={src} caret={false} />
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="border-t border-rule px-4 sm:px-5 py-2 flex items-center gap-2 flex-wrap font-mono text-[11px] text-ink-soft tabular">
        <span role="group" aria-label="Choose a draft" className="flex gap-1">
          {['Draft 1', 'Draft 2', 'Final'].map((l, j) => (
            <button
              key={l}
              type="button"
              aria-pressed={i === j}
              onClick={() => setI(j)}
              className={`px-2 h-7 rounded-md border ${i === j ? 'border-ink bg-ink text-paper' : 'border-rule-strong hover:bg-well'}`}
            >
              {l}
            </button>
          ))}
        </span>
        <span className="ml-auto">{clock(vt)}</span>
        <span>{words(d)} words</span>
      </div>
    </figure>
  );
}

export default ReplayHero;
