import { useEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { TrailEvent } from '../lib/types';
import { ms } from '../lib/analysis';
import { useReplay, type Schedule } from './useReplay';
import { Chip, Marginal, cx } from './ui';
import { fmtMinutes, num } from './format';

export type ReplayPlayerProps = {
  events: TrailEvent[];
  title?: string | null;
  autoplay?: boolean;
  loop?: boolean;
  speed?: number;
  hero?: boolean; // compact chrome, fixed height, adaptive speed
  className?: string;
};

const SPEEDS = [1, 4, 16];
const MILESTONE_LABELS = ['25%', '50%', '75%', '100%'];

/** Typed vs pasted characters added per slice of virtual time, for the strip above the scrubber. */
function useTimelineBuckets(s: Schedule, buckets = 72) {
  return useMemo(() => {
    const out = Array.from({ length: buckets }, () => ({ typed: 0, pasted: 0 }));
    if (!s.duration) return out;
    s.events.forEach((e, i) => {
      if (e.kind !== 'insert' && e.kind !== 'paste') return;
      const b = Math.min(buckets - 1, Math.floor((s.times[i + 1] / s.duration) * buckets));
      const n = String(e.data.text).length;
      if (e.kind === 'insert') out[b].typed += n;
      else out[b].pasted += n;
    });
    return out;
  }, [s, buckets]);
}

export function ReplayPlayer({ events, title, autoplay, loop, speed, hero, className }: ReplayPlayerProps) {
  const reduced = useReducedMotion() ?? false;
  const still = reduced;
  const adaptive = useMemo(() => {
    if (!hero) return speed ?? 4;
    // aim for a ~40 second loop regardless of the essay's length
    const first = events[0],
      last = events[events.length - 1];
    if (!first || !last) return 8;
    return 8; // overridden after schedule is known (see below)
  }, [hero, speed, events]);
  const r = useReplay(events, { autoplay: autoplay && !still, loop, speed: adaptive, still });
  const { frame, schedule, playing, toggle, seek, setSpeed } = r;

  useEffect(() => {
    if (hero && schedule.duration) setSpeed(Math.max(2, Math.min(24, Math.round(schedule.duration / 40_000))));
  }, [hero, schedule, setSpeed]);

  const buckets = useTimelineBuckets(schedule);
  const maxBucket = Math.max(1, ...buckets.map((b) => b.typed + b.pasted));
  const sheetRef = useRef<HTMLDivElement>(null);

  // keep the caret in view while playing
  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !playing) return;
    const caret = el.querySelector<HTMLElement>('[data-caret]');
    if (!caret) return;
    const top = caret.offsetTop;
    const want = top - el.clientHeight * 0.66;
    if (Math.abs(el.scrollTop - want) > 24) el.scrollTop = Math.max(0, want);
  }, [frame.position, playing]);

  const total = schedule.events.length;
  const mIdx = r.milestoneIndex;
  const pctThrough = total ? Math.round((frame.position / total) * 100) : 0;
  const scrubText = `${num(frame.words)} words, ${pctThrough}% through`;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div className={cx('grid gap-3', className)} onKeyDown={still ? undefined : onKey}>
      {/* the sheet */}
      <div className="relative">
        <div
          ref={sheetRef}
          className={cx(
            'bg-sheet border border-rule rounded-lg shadow-sheet ruled overflow-y-auto overscroll-contain relative',
            hero ? 'h-[300px] sm:h-[360px] lg:h-[420px]' : 'max-h-[70vh] min-h-[280px]',
          )}
          aria-live={still ? undefined : 'off'}
        >
          <div className="absolute left-8 sm:left-12 top-0 bottom-0 w-px bg-paste/40 pointer-events-none" aria-hidden />
          <div className={cx('essay px-11 sm:px-16 py-6 text-[17px] sm:text-[18px] leading-[1.6em] min-h-full', 'lg:pr-40')}>
            {title && <Marginal className="block mb-4 text-ink-faint normal-case tracking-normal">{title}</Marginal>}
            {frame.lines.length === 0 || (frame.lines.length === 1 && frame.lines[0].runs.length === 0) ? (
              <p className="text-ink-faint italic">
                {frame.position === 0 ? 'A blank page.' : ''}
                {!still && <span className="caret" data-caret aria-hidden />}
              </p>
            ) : (
              frame.lines.map((ln) => (
                <p key={ln.key} className="relative min-h-[1.6em] whitespace-pre-wrap break-words">
                  {ln.runs.map((run, i) => {
                    const before = ln.caret !== null ? ln.runs.slice(0, i).reduce((a, x) => a + x.text.length, 0) : 0;
                    const within = ln.caret !== null && ln.caret > before && ln.caret <= before + run.text.length;
                    const cls = run.cls === 'paste' ? 'prov-paste' : run.cls === 'unobserved' ? 'prov-unobserved' : 'prov-typed';
                    if (within && !still) {
                      const k = ln.caret! - before;
                      return (
                        <span key={i} className={cls}>
                          {run.text.slice(0, k)}
                          <span className="caret" data-caret aria-hidden />
                          {run.text.slice(k)}
                        </span>
                      );
                    }
                    return (
                      <span key={i} className={cls}>
                        {run.text}
                      </span>
                    );
                  })}
                  {ln.caret === 0 && !still && <span className="caret" data-caret aria-hidden />}
                  {ln.pasteHere && (
                    <span className="lg:absolute lg:left-full lg:top-[0.3em] lg:ml-4 ml-2 align-middle inline-block">
                      <Chip kind={ln.pasteHere.kind}>
                        pasted · {ln.pasteHere.host || (ln.pasteHere.kind === 'self' ? 'this doc' : 'unknown')}
                      </Chip>
                    </span>
                  )}
                </p>
              ))
            )}
          </div>
        </div>
        {frame.gapNote && !still && (
          <div className="absolute top-3 right-3 bg-paper border border-rule rounded px-2 py-1 font-mono text-[11px] text-ink-soft" role="status">
            ⋯ {frame.gapNote}
          </div>
        )}
      </div>

      {/* timeline + transport */}
      <div className="grid gap-2">
        <div className="flex items-end gap-px h-8" aria-hidden>
          {buckets.map((b, i) => {
            const played = total ? i / buckets.length <= frame.position / total : false;
            const h = ((b.typed + b.pasted) / maxBucket) * 100;
            const pasteShare = b.typed + b.pasted ? b.pasted / (b.typed + b.pasted) : 0;
            return (
              <span
                key={i}
                className={cx('flex-1 rounded-t-[1px] transition-opacity duration-150', pasteShare > 0.5 ? 'bg-paste' : 'bg-typed', played ? 'opacity-90' : 'opacity-25')}
                style={{ height: `${Math.max(h, b.typed + b.pasted ? 6 : 0)}%` }}
              />
            );
          })}
        </div>

        {still ? (
          <StillControls index={mIdx} onStep={(i) => seek(schedule.milestones[i])} words={frame.words} />
        ) : (
          <div className="grid gap-1">
            <div className="relative">
              <input
                type="range"
                className="range"
                min={0}
                max={total}
                step={1}
                value={frame.position}
                aria-label="Replay position"
                aria-valuetext={scrubText}
                onChange={(e) => {
                  if (playing) r.stop();
                  seek(Number(e.target.value));
                }}
              />
              <div className="absolute inset-x-0 top-[11px] h-0 pointer-events-none" aria-hidden>
                {schedule.milestones.map((m, i) => (
                  <span key={i} className="absolute w-px h-2.5 -translate-y-1/2 bg-ink-faint" style={{ left: `${total ? (m / total) * 100 : 0}%` }} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={toggle}
                aria-label={playing ? 'Pause replay' : 'Play replay'}
                className="w-9 h-9 rounded-full border border-rule-strong hover:border-ink flex items-center justify-center transition-colors duration-150"
              >
                {playing ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                    <rect x="1" y="1" width="4" height="10" fill="currentColor" />
                    <rect x="7" y="1" width="4" height="10" fill="currentColor" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                    <path d="M2 1 L11 6 L2 11 Z" fill="currentColor" />
                  </svg>
                )}
              </button>
              <div role="group" aria-label="Speed" className="inline-flex border border-rule rounded-md p-0.5">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    aria-pressed={r.speed === s}
                    onClick={() => setSpeed(s)}
                    className={cx('h-7 px-2 rounded font-mono text-xs tabular', r.speed === s ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink')}
                  >
                    {s}×
                  </button>
                ))}
              </div>
              <div className="hidden sm:flex gap-1" role="group" aria-label="Draft milestones">
                {schedule.milestones.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (playing) r.stop();
                      seek(m);
                    }}
                    className={cx('h-7 px-2 rounded font-mono text-xs tabular border border-transparent hover:border-rule-strong', frame.position === m && 'border-rule-strong')}
                  >
                    {MILESTONE_LABELS[i]}
                  </button>
                ))}
              </div>
              <span className="ml-auto font-mono text-xs text-ink-soft tabular" aria-live="off">
                {num(frame.words)} words · {fmtMinutes(frame.elapsedMs / 60000)} in
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StillControls({ index, onStep, words }: { index: number; onStep: (i: number) => void; words: number }) {
  return (
    <div className="flex items-center gap-3 flex-wrap" role="group" aria-label="Draft milestones">
      <button
        className="h-9 px-3 rounded-md border border-rule-strong hover:border-ink text-sm disabled:opacity-40"
        disabled={index <= 0}
        onClick={() => onStep(index - 1)}
      >
        ← Earlier
      </button>
      <span className="font-mono text-xs text-ink-soft">
        Draft at {MILESTONE_LABELS[index]} · {num(words)} words
      </span>
      <button
        className="h-9 px-3 rounded-md border border-rule-strong hover:border-ink text-sm disabled:opacity-40"
        disabled={index >= 3}
        onClick={() => onStep(index + 1)}
      >
        Later →
      </button>
      <span className="text-xs text-ink-faint basis-full">Reduced motion is on, so the replay shows four drafts instead of animating.</span>
    </div>
  );
}

export const wallClockMinutes = (events: TrailEvent[]) => (events.length > 1 ? (ms(events[events.length - 1].ts) - ms(events[0].ts)) / 60000 : 0);
