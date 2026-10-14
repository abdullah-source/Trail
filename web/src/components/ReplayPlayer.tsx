// The replay engine's face: the essay sheet in a sunken scroll well, the activity strip, and two
// chrome transport rows (step/play/step + scrubber; speed radios + draft milestones). Everything that
// moves here is the record itself (DESIGN-desktop.md §6): the text, the caret, the scrubber.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { TrailEvent } from '../lib/types';
import { ms } from '../lib/analysis';
import { useReplay, type Schedule } from './useReplay';
import { Button, Chip, IconButton, Marginal, Radio, cx } from './ui';
import { fmtMinutes, num } from './format';

export type ReplayPlayerProps = {
  events: TrailEvent[];
  title?: string | null;
  autoplay?: boolean;
  loop?: boolean;
  speed?: number;
  hero?: boolean; // fixed height, adaptive speed (the marketing hero)
  className?: string;
  /** Called whenever the replay clock changes, e.g. "00:48 / 02:55" for a window's title bar. */
  onClock?: (clock: string) => void;
};

const SPEEDS = [1, 4, 16];
const MILESTONE_LABELS = ['25%', '50%', '75%', '100%'];

/** prefers-reduced-motion, live, without pulling framer-motion into the app chunk. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** mm:ss, or h:mm:ss past the hour, from milliseconds of replay time. */
export function clockText(msValue: number): string {
  const s = Math.max(0, Math.round(msValue / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const two = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(s % 60)}` : `${two(m)}:${two(s % 60)}`;
}

/** Typed vs pasted characters added per slice of replay time, for the strip above the transport. */
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

export function ReplayPlayer({ events, title, autoplay, loop, speed, hero, className, onClock }: ReplayPlayerProps) {
  const still = useReducedMotion();
  const id = useId();
  const r = useReplay(events, { autoplay: autoplay && !still, loop, speed: hero ? 8 : speed ?? 4, still });
  const { frame, schedule, playing, toggle, seek, setSpeed } = r;

  // the hero aims for a ~40 second loop whatever the essay's length
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
    const want = caret.offsetTop - el.clientHeight * 0.66;
    if (Math.abs(el.scrollTop - want) > 24) el.scrollTop = Math.max(0, want);
  }, [frame.position, playing]);

  // the title-bar clock: replay time at this position over the whole replay, updated once per second at most
  const clock = `${clockText(schedule.times[frame.position] ?? 0)} / ${clockText(schedule.duration)}`;
  const onClockRef = useRef(onClock);
  onClockRef.current = onClock;
  useEffect(() => {
    onClockRef.current?.(clock);
  }, [clock]);

  const total = schedule.events.length;
  const pctThrough = total ? Math.round((frame.position / total) * 100) : 0;
  const scrubText = `${num(frame.words)} words, ${pctThrough}% through`;
  const stepBack = () => {
    const prev = [...schedule.milestones].reverse().find((m) => m < frame.position);
    if (playing) r.stop();
    seek(prev ?? 0);
  };
  const stepForward = () => {
    const next = schedule.milestones.find((m) => m > frame.position);
    if (playing) r.stop();
    seek(next ?? total);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('button, input, label')) return;
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div className={cx('grid', className)} onKeyDown={still ? undefined : onKey}>
      {/* the sheet and the activity strip share one sunken well */}
      <div className="relative bevel-in bg-sheet border-x-0 border-t-0">
        <div ref={sheetRef} tabIndex={0} aria-label="Essay sheet" className={cx('scroll overscroll-contain', hero ? 'h-[300px] sm:h-[360px] lg:h-[420px]' : 'max-h-[70vh] min-h-[280px]')} aria-live={still ? undefined : 'off'}>
          <div className="essay px-4 py-4 min-h-full">
            {title && <Marginal className="block mb-4">{title}</Marginal>}
            {frame.lines.length === 0 || (frame.lines.length === 1 && frame.lines[0].runs.length === 0) ? (
              <p className="text-ink-faint">
                {frame.position === 0 ? 'A blank page.' : ''}
                {!still && <span className="caret" data-caret aria-hidden />}
              </p>
            ) : (
              frame.lines.map((ln) => (
                <p key={ln.key} className="min-h-[1.6em] whitespace-pre-wrap break-words">
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
                    <>
                      {' '}
                      <Chip kind={ln.pasteHere.kind === 'ai' ? 'ai' : 'paste'} className="align-middle">
                        pasted · {ln.pasteHere.host || (ln.pasteHere.kind === 'self' ? 'this doc' : 'unknown')}
                      </Chip>
                    </>
                  )}
                </p>
              ))
            )}
          </div>
        </div>
        {frame.gapNote && !still && (
          <span className="absolute top-2 right-2 label-plate" role="status">
            … {frame.gapNote}
          </span>
        )}
        {/* activity: typed (green) and pasted (amber) characters per slice of replay time */}
        <div className="flex items-end gap-px h-6 px-2 pt-1 border-t border-rule" aria-hidden>
          {buckets.map((b, i) => {
            const played = total ? i / buckets.length <= frame.position / total : false;
            const h = ((b.typed + b.pasted) / maxBucket) * 100;
            const pasteShare = b.typed + b.pasted ? b.pasted / (b.typed + b.pasted) : 0;
            return <span key={i} className={cx('flex-1', pasteShare > 0.5 ? 'bg-paste' : 'bg-typed')} style={{ height: `${Math.max(h, b.typed + b.pasted ? 8 : 0)}%`, opacity: played ? 1 : 0.3 }} />;
          })}
        </div>
      </div>

      {still ? (
        <StillControls index={r.milestoneIndex} onStep={(i) => seek(schedule.milestones[i])} words={frame.words} />
      ) : (
        <>
          <div className="transport">
            <IconButton icon="back" label="Previous draft" onClick={stepBack} disabled={frame.position === 0} />
            <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pause replay' : 'Play replay'} aria-pressed={playing} onClick={toggle} />
            <IconButton icon="forward" label="Next draft" onClick={stepForward} disabled={frame.position >= total} />
            <div className="relative flex-1 min-w-[80px]">
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
              <div className="absolute inset-x-0 top-1/2 h-0 pointer-events-none" aria-hidden>
                {schedule.milestones.map((m, i) => (
                  <span key={i} className="absolute w-px h-2 -translate-y-1/2 bg-margin" style={{ left: `${total ? (m / total) * 100 : 0}%` }} />
                ))}
              </div>
            </div>
            <span className="tabular whitespace-nowrap" aria-live="off">
              {num(frame.words)} words · {fmtMinutes(frame.elapsedMs / 60000)} in
            </span>
          </div>
          <div className="transport flex-wrap">
            <span role="radiogroup" aria-label="Speed" className="inline-flex flex-wrap gap-x-4 gap-y-2">
              {SPEEDS.map((s) => (
                <Radio key={s} name={`${id}-speed`} label={`${s}×`} checked={r.speed === s} onChange={() => setSpeed(s)} />
              ))}
            </span>
            <span role="group" aria-label="Draft milestones" className="inline-flex gap-1 ml-auto">
              {schedule.milestones.map((m, i) => (
                <Button
                  key={i}
                  size="sm"
                  aria-pressed={frame.position === m}
                  onClick={() => {
                    if (playing) r.stop();
                    seek(m);
                  }}
                >
                  {MILESTONE_LABELS[i]}
                </Button>
              ))}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function StillControls({ index, onStep, words }: { index: number; onStep: (i: number) => void; words: number }) {
  return (
    <div className="transport flex-wrap" role="group" aria-label="Draft milestones">
      <Button size="sm" disabled={index <= 0} onClick={() => onStep(index - 1)} icon="back">
        Earlier
      </Button>
      <span className="tabular">
        Draft at {MILESTONE_LABELS[index]} · {num(words)} words
      </span>
      <Button size="sm" disabled={index >= 3} onClick={() => onStep(index + 1)} icon="forward">
        Later
      </Button>
      <span className="text-ink-soft basis-full">Reduced motion is on, so the replay shows four drafts instead of animating.</span>
    </div>
  );
}

export const wallClockMinutes = (events: TrailEvent[]) => (events.length > 1 ? (ms(events[events.length - 1].ts) - ms(events[0].ts)) / 60000 : 0);
