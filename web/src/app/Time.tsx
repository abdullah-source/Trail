// Screen time for homework: the student's own view of active time on school sites, computed on this
// computer from the extension's local work-log and the essays' writing sessions (src/lib/homework.ts).
// No teacher view, no limits, no sharing.
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { data } from '../lib/data';
import { sessionsSummary } from '../lib/analysis';
import type { WorklogRow } from '../lib/types';
import {
  RANGES,
  WEEKDAYS,
  WEEKDAYS_SHORT,
  averageStintMs,
  bestHour,
  clipStints,
  daysWorked,
  durationText,
  habits,
  hourText,
  lateNightShare,
  longestStretch,
  mergeStints,
  parseRange,
  percentText,
  rangeBounds,
  recap,
  streakDays,
  summarize,
  type EssayRecord,
  type HomeworkSummary,
  type Range,
} from '../lib/homework';
import { useAsync, usePageTitle } from '../components/useAsync';
import { Button, Chip, EmptyState, ErrorNote, Info, Loading, Marginal, SectionHead, Sheet, StatTile, cx } from '../components/ui';
import { relative } from '../components/format';
import { copyText } from './shared';

type Loaded = { installed: boolean; rows: WorklogRow[]; essays: EssayRecord[] };

async function loadAll(): Promise<Loaded> {
  const st = await data.extensionStatus();
  if (!st.installed) return { installed: false, rows: [], essays: [] };
  const [rows, list] = await Promise.all([data.worklog().catch(() => [] as WorklogRow[]), data.essays().catch(() => [])]);
  const essays: EssayRecord[] = [];
  for (const e of list) {
    try {
      const evs = await data.essayEvents(e.id);
      if (evs.length) essays.push({ doc: e.id, title: e.title, editor: e.editor, sessions: sessionsSummary(evs) });
    } catch {
      /* skip an essay the extension could not read */
    }
  }
  return { installed: true, rows, essays };
}

const KIND_CHIP: Record<string, string> = { writing: 'typed', assignment: 'web', quiz: 'web', discussion: 'web', module: 'web', page: 'web', course: 'web' };

export default function Time() {
  usePageTitle('Time');
  const all = useAsync(loadAll, []);
  const [params, setParams] = useSearchParams();
  const range = parseRange(params.get('range'));
  const [course, setCourse] = useState<string | null>(null);

  const view = useMemo(() => {
    if (all.status !== 'ready') return null;
    const now = Date.now();
    const bounds = rangeBounds(range, now);
    const merged = mergeStints(all.value.rows, all.value.essays);
    const stints = clipStints(merged, bounds.since, bounds.until);
    const summary = summarize(stints, bounds.since, bounds.until);
    const prev = summarize(clipStints(merged, bounds.prevSince, bounds.prevUntil), bounds.prevSince, bounds.prevUntil);
    const average = averageStintMs(stints);
    const lateShare = lateNightShare(summary.by_hour);
    const stretch = longestStretch(stints);
    const streak = streakDays(merged, now);
    return {
      now,
      bounds,
      merged,
      stints,
      summary,
      prev,
      average,
      lateShare,
      stretch,
      streak,
      cards: habits(summary, stints, bounds, now),
      text: recap({ summary, prevTotal: prev.total_ms, bounds, streak, average, lateShare, stretch, now }),
    };
  }, [all, range]);

  if (all.status === 'loading') return <Loading label="Reading your time on school sites" />;
  if (all.status === 'error') return <ErrorNote error={all.error} retry={all.reload} />;
  if (!all.value.installed || !view || !view.merged.length) return <Empty installed={all.value.installed} />;

  const { bounds, summary, prev, average, lateShare, stretch, streak, cards, text, stints } = view;
  const delta = summary.total_ms - prev.total_ms;
  const deltaText = prev.total_ms === 0 && summary.total_ms === 0 ? 'nothing either time' : Math.abs(delta) < 60_000 ? `same as ${bounds.prevLabel}` : `${delta > 0 ? '+' : '−'}${durationText(Math.abs(delta))} vs ${bounds.prevLabel}`;
  const visibleItems = course ? summary.by_item.filter((i) => i.course_key === course) : summary.by_item;
  const worked = daysWorked(summary);

  return (
    <div className="grid gap-10">
      <SectionHead kicker="Screen time for homework" title="Your time on school sites, for you only." lede="Active minutes on the school sites and editors Trail already records, read from the extension on this computer. Nothing on this page leaves this device, and no teacher can see it." />

      <RangePicker range={range} onChange={(r) => setParams(r === 'week' ? {} : { range: r }, { replace: true })} />

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-6">
        <StatTile label={RANGES.find((r) => r.id === range)!.label} value={durationText(summary.total_ms)} detail={deltaText} info={`Active time ${bounds.label}: minutes a school tab was in front and you were doing something, plus writing sessions in your essays. Idle minutes with the tab open are not counted. Compared with the same length of time before it.`} />
        <StatTile label="Days worked" value={`${worked} / ${summary.by_day.length}`} detail={streak ? `${streak}-day streak` : 'no streak yet'} info="A day counts when it has at least 15 minutes of active time. The streak is the run of such days ending today (or yesterday, if today is still quiet)." />
        <StatTile label="Typical stint" value={durationText(average)} detail={`${summary.stints} stint${summary.stints === 1 ? '' : 's'}`} info="The mean active time of one sitting on one item. A sitting ends when you leave the tab or the editor goes quiet." />
        <StatTile label="After 11pm" value={percentText(lateShare)} detail="of your active time" tone={lateShare !== null && lateShare > 0.33 ? 'paste' : undefined} info="Share of active minutes that fell between 11pm and 5am, your local time." />
      </section>

      <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
        <div className="grid gap-1 content-start">
          <Marginal>By class</Marginal>
          <span className="text-xs text-ink-soft">Active time per class {bounds.label}, with how many items you touched. Click a class to filter the list below.</span>
        </div>
        <ClassBars summary={summary} selected={course} onSelect={setCourse} />
      </section>

      <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
        <div className="grid gap-1 content-start">
          <Marginal>By assignment</Marginal>
          <span className="text-xs text-ink-soft">{course ? `Items in ${summary.by_course.find((c) => c.course_key === course)?.course_label ?? 'this class'}. ` : 'Every item you worked on, most time first. '}Stints are separate sittings; an essay with a recorded document links to its replay.</span>
        </div>
        <ItemTable items={visibleItems} now={view.now} />
      </section>

      <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
        <div className="grid gap-1 content-start">
          <Marginal>When you work</Marginal>
          <span className="text-xs text-ink-soft">Active minutes by weekday and hour of the day, your local time, summed over {bounds.label}. Darker is more; hover a cell for the number.</span>
        </div>
        <div className="grid gap-5 max-w-2xl">
          <HeatGrid heat={summary.heat} />
          <dl className="grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="marginal inline-flex items-center gap-1.5">
                Busiest hour <Info text="The hour of the day with the most active minutes in this window." />
              </dt>
              <dd className="mt-1 tabular">{bestHour(summary.by_hour) === null ? '—' : hourText(bestHour(summary.by_hour)!)}</dd>
            </div>
            <div>
              <dt className="marginal inline-flex items-center gap-1.5">
                Late night <Info text="Share of active minutes between 11pm and 5am." />
              </dt>
              <dd className="mt-1 tabular">{percentText(lateShare)}</dd>
            </div>
            <div>
              <dt className="marginal inline-flex items-center gap-1.5">
                Longest stretch <Info text="The longest run of sittings with no gap over 10 minutes, measured from first start to last end, across every class." />
              </dt>
              <dd className="mt-1 tabular">{stretch ? `${durationText(stretch.ms)} on ${WEEKDAYS[(new Date(stretch.start).getDay() + 6) % 7]}` : '—'}</dd>
            </div>
          </dl>
        </div>
      </section>

      {cards.length > 0 && (
        <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
          <div className="grid gap-1 content-start">
            <Marginal>Habits</Marginal>
            <span className="text-xs text-ink-soft">Plain observations from the numbers above. Each one says which rule produced it. No targets, no limits.</span>
          </div>
          <ul className="grid sm:grid-cols-3 gap-4 max-w-3xl">
            {cards.map((c) => (
              <li key={c.rule} className="bg-sheet border border-rule rounded-lg shadow-sheet p-4 grid gap-2 content-start">
                <p className="text-base leading-snug">{c.text}</p>
                <p className="text-xs text-ink-soft">{c.how}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
        <div className="grid gap-1 content-start">
          <Marginal>Recap</Marginal>
          <span className="text-xs text-ink-soft">The same numbers as one paragraph, written by a fixed template. Copy it into a journal or a message to yourself.</span>
        </div>
        <Recap text={text} />
      </section>

      <p className="text-xs text-ink-soft max-w-prose">
        {stints.length} sitting{stints.length === 1 ? '' : 's'} {bounds.label}. Where a recorded essay and its school-site stint overlap, the longer of the two is counted once, never both. Export or delete this log in <Link to="/app/settings" className="link">Settings</Link>.
      </p>
    </div>
  );
}

function Empty({ installed }: { installed: boolean }) {
  return (
    <div className="grid gap-8">
      <SectionHead kicker="Screen time for homework" title="Your time on school sites, for you only." lede="Once the extension has seen you work on a school site, this page shows how long, on what, and when. It is computed on this computer and never shared." />
      <EmptyState
        title={installed ? 'Nothing recorded yet' : 'The extension is not talking to this page'}
        glyph="◷"
        body={
          <div className="grid gap-2">
            <p>What gets tracked: only the school sites and editors Trail already records (your LMS, Google Docs, Notion, Word Online), only while that tab is in front and you are doing something, and only on this computer. Course and assignment names stay in the extension's local database; they never reach Trail's server, and no teacher can see them.</p>
            <p>
              {installed ? (
                <>Open an assignment, quiz or document on one of those sites and come back; the first stint appears within a minute.</>
              ) : (
                <>
                  <Link to="/install" className="link">Install the extension</Link> in Chrome on this computer, then come back here.
                </>
              )}
            </p>
          </div>
        }
      />
    </div>
  );
}

function RangePicker({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  return (
    <div role="radiogroup" aria-label="Time range" className="inline-flex rounded-md border border-rule-strong overflow-hidden text-sm w-fit">
      {RANGES.map((r) => (
        <button key={r.id} type="button" role="radio" aria-checked={range === r.id} onClick={() => onChange(r.id)} className={cx('px-3 h-9 transition-colors duration-150 border-r border-rule-strong last:border-r-0', range === r.id ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink hover:bg-sheet')}>
          {r.label}
        </button>
      ))}
    </div>
  );
}

function ClassBars({ summary, selected, onSelect }: { summary: HomeworkSummary; selected: string | null; onSelect: (k: string | null) => void }) {
  const max = Math.max(1, ...summary.by_course.map((c) => c.active_ms));
  if (!summary.by_course.length) return <p className="text-sm text-ink-soft">No active time in this window.</p>;
  return (
    <ul className="grid gap-2 max-w-2xl text-sm tabular" aria-label="Active time by class">
      {summary.by_course.map((c) => {
        const on = selected === c.course_key;
        return (
          <li key={c.course_key}>
            <button type="button" aria-pressed={on} onClick={() => onSelect(on ? null : c.course_key)} className={cx('w-full grid grid-cols-[minmax(7rem,14rem)_1fr_auto] items-center gap-3 text-left rounded px-1 -mx-1 py-1 transition-colors duration-150 hover:bg-sheet', on && 'bg-sheet')}>
              <span className={cx('truncate', on ? 'text-ink font-semibold' : 'text-ink')} title={c.course_label}>
                {c.course_label}
              </span>
              <span className="h-3 bg-rule rounded-sm overflow-hidden">
                <span className={cx('block h-full', selected && !on ? 'bg-rule-strong' : 'bg-typed')} style={{ width: `${(c.active_ms / max) * 100}%` }} />
              </span>
              <span className="text-ink-soft whitespace-nowrap">
                <span className="text-ink">{durationText(c.active_ms)}</span> · {c.items} item{c.items === 1 ? '' : 's'}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ItemTable({ items, now }: { items: HomeworkSummary['by_item']; now: number }) {
  if (!items.length) return <p className="text-sm text-ink-soft">No items in this window.</p>;
  return (
    <div className="overflow-x-auto max-w-3xl">
      <table className="w-full text-sm tabular border-collapse">
        <thead>
          <tr className="text-left marginal">
            <th className="py-2 pr-4 font-normal">Item</th>
            <th className="py-2 pr-4 font-normal">Class</th>
            <th className="py-2 pr-4 font-normal">Kind</th>
            <th className="py-2 pr-4 font-normal text-right">Active</th>
            <th className="py-2 pr-4 font-normal text-right">Stints</th>
            <th className="py-2 font-normal whitespace-nowrap">Last worked</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.item_key} className="border-t border-rule align-baseline">
              <td className="py-2 pr-4 max-w-[18rem]">
                {i.doc ? (
                  <Link to={`/app/essays/${encodeURIComponent(i.doc)}`} className="link" title="Open the essay replay">
                    {i.item_label}
                  </Link>
                ) : (
                  <span className="text-ink">{i.item_label}</span>
                )}
              </td>
              <td className="py-2 pr-4 text-ink-soft whitespace-nowrap">{i.course_label}</td>
              <td className="py-2 pr-4">
                <Chip kind={KIND_CHIP[i.kind] || 'web'}>{i.kind}</Chip>
              </td>
              <td className="py-2 pr-4 text-right whitespace-nowrap">{durationText(i.active_ms)}</td>
              <td className="py-2 pr-4 text-right text-ink-soft">{i.stints}</td>
              <td className="py-2 text-ink-soft whitespace-nowrap">{relative(new Date(i.last).toISOString(), now)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeatGrid({ heat }: { heat: number[][] }) {
  const max = Math.max(1, ...heat.flat());
  const hours = [0, 6, 12, 18];
  return (
    <figure className="grid gap-1">
      <div className="grid grid-cols-[2.5rem_1fr] gap-x-2 items-center">
        <span />
        <div className="grid grid-cols-24 font-mono text-[10px] text-ink-soft">
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className={cx(!hours.includes(h) && 'invisible')}>
              {hourText(h)}
            </span>
          ))}
        </div>
        {heat.map((row, wd) => (
          <div key={wd} className="contents">
            <span className="font-mono text-[11px] text-ink-soft">{WEEKDAYS_SHORT[wd]}</span>
            <div className="grid grid-cols-24 gap-px" role="row">
              {row.map((v, h) => {
                const level = v / max;
                const min = Math.round(v / 60_000);
                return (
                  <span
                    key={h}
                    role="cell"
                    title={`${WEEKDAYS[wd]} ${hourText(h)}: ${min ? `${min} min` : 'nothing'}`}
                    aria-label={`${WEEKDAYS[wd]} ${hourText(h)}: ${min} minutes`}
                    className={cx('aspect-square rounded-[2px]', v ? 'bg-typed' : 'bg-rule/60')}
                    style={v ? { opacity: 0.25 + level * 0.75 } : undefined}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <figcaption className="text-xs text-ink-soft mt-1">Each cell is one weekday-hour; the darkest cell holds {durationText(max)} of active time.</figcaption>
    </figure>
  );
}

function Recap({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <div className="grid gap-3 max-w-2xl">
      <Sheet as="article" className="p-5 essay text-[16px]">
        <p>{text}</p>
      </Sheet>
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={async () => {
            setState((await copyText(text)) ? 'copied' : 'failed');
            setTimeout(() => setState('idle'), 2500);
          }}
        >
          Copy recap
        </Button>
        {state !== 'idle' && (
          <span role="status" className="text-sm text-ink-soft">
            {state === 'copied' ? 'Copied.' : 'Could not copy; select the text instead.'}
          </span>
        )}
      </div>
    </div>
  );
}
