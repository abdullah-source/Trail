// Screen time for homework: the student's own view of active time on school sites, computed on this
// computer from the extension's local work-log and the essays' writing sessions (src/lib/homework.ts).
// No teacher view, no limits, no sharing. "Your pace" (src/lib/pace.ts) reads the same record to say
// how this student works and what a new piece of work would take at their own rhythm.
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
  parseIso,
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
import { MIN_ESSAYS, MIN_WORDS, dayText, forecast, minutesText, numText, paceText, parseDue, profile, scheduleLike, windowText, type PaceEssay, type PaceProfile, type PaceWindow } from '../lib/pace';
import { useAsync, usePageTitle } from '../components/useAsync';
import { Button, Chip, EmptyState, ErrorNote, Field, Info, Loading, Marginal, SectionHead, Sheet, StatTile, cx, inputCls } from '../components/ui';
import { fmtDate, fmtTime, relative } from '../components/format';
import { copyText } from './shared';

type Loaded = { installed: boolean; rows: WorklogRow[]; essays: EssayRecord[]; pace: PaceEssay[] };

async function loadAll(): Promise<Loaded> {
  const st = await data.extensionStatus();
  if (!st.installed) return { installed: false, rows: [], essays: [], pace: [] };
  const [rows, list] = await Promise.all([data.worklog().catch(() => [] as WorklogRow[]), data.essays().catch(() => [])]);
  const essays: EssayRecord[] = [];
  const pace: PaceEssay[] = [];
  for (const e of list) {
    try {
      const evs = await data.essayEvents(e.id);
      if (!evs.length) continue;
      const sessions = sessionsSummary(evs);
      essays.push({ doc: e.id, title: e.title, editor: e.editor, sessions });
      pace.push({ doc: e.id, title: e.title, words: e.words, typed_chars: e.typed, pasted_chars: e.pasted, deleted_chars: e.deleted, sessions });
    } catch {
      /* skip an essay the extension could not read */
    }
  }
  return { installed: true, rows, essays, pace };
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
      pace: profile(all.value.pace, merged, now),
    };
  }, [all, range]);

  if (all.status === 'loading') return <Loading label="Reading your time on school sites" />;
  if (all.status === 'error') return <ErrorNote error={all.error} retry={all.reload} />;
  if (!all.value.installed || !view || !view.merged.length) return <Empty installed={all.value.installed} />;

  const { bounds, summary, prev, average, lateShare, stretch, streak, cards, text, stints, pace } = view;
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
        <CopyParagraph text={text} label="Copy recap" />
      </section>

      <PaceSection profile={pace} now={view.now} />

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

function CopyParagraph({ text, label }: { text: string; label: string }) {
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
          {label}
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

// ---- your pace -----------------------------------------------------------------------------------

const DEFAULT_WORDS = 1500;

function PaceSection({ profile: p, now }: { profile: PaceProfile; now: number }) {
  const [words, setWords] = useState(String(DEFAULT_WORDS));
  const [due, setDue] = useState('');
  const target = Math.round(Number(words));
  const valid = words.trim() !== '' && Number.isFinite(target) && target >= 50 && target <= 50_000;
  const plan = useMemo(() => {
    if (!p.enough || !valid) return null;
    const f = forecast(p, { words: target, dueAt: due || null, now });
    if (!f) return null;
    const sessions = scheduleLike(p, f);
    const last = sessions[sessions.length - 1];
    const dueMs = due ? parseDue(due) : null;
    const overruns = last && dueMs !== null && parseIso(last.start) + last.minutes * 60_000 > dueMs;
    return { f, sessions, text: paceText(p, f), overruns };
  }, [p, target, valid, due, now]);

  const q = p.wordsPerActiveMinute;
  const win = p.bestWindows[0];
  const win2 = p.bestWindows[1];

  return (
    <>
      <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
        <div className="grid gap-1 content-start">
          <Marginal>Your pace</Marginal>
          <span className="text-xs text-ink-soft">How you write, read from every recorded essay: your speed while active, how long you sit, how many sittings a piece takes, and when you write best. A profile, not a target.</span>
        </div>
        {p.enough && q && p.stint ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-6 max-w-3xl">
            <StatTile label="Words a minute" value={oneDecimal(q.median)} detail={`${oneDecimal(q.p25)} to ${oneDecimal(q.p75)} on slower and faster essays`} info={`Final words divided by active minutes, essay by essay; this is your middle essay. Essays with at least ${MIN_WORDS} words and five active minutes count (${p.counted} so far). The range is your slower and faster quarters.`} />
            <StatTile label="Typical stint" value={minutesText(p.stint.medianMinutes)} detail={`half between ${minutesText(p.stint.p25)} and ${minutesText(p.stint.p75)}`} info="The median active time of one sitting, across every stint on this page (school sites and writing sessions merged). The middle half of your stints fall in the range below." />
            <StatTile label="Sittings per 1,000 words" value={p.sessionsPer1000Words === null ? '—' : oneDecimal(p.sessionsPer1000Words)} detail={p.calendarDaysPer1000Words ? `over about ${oneDecimal(p.calendarDaysPer1000Words.median)} days` : undefined} info="How many separate writing sessions your essays took per 1,000 final words, and how many calendar days passed from the first session to the last; the middle essay each time." />
            <StatTile label="Best window" value={win ? windowShort(win) : '—'} detail={win ? `${oneDecimal(win.wordsPerMinute)} words a minute${win2 ? `; then ${windowText(win2)}` : ''}` : 'not enough writing in any one stretch yet'} info="The one-to-three-hour stretch of the day where you type the most words per active minute, with at least 30 minutes of writing in it (words are typed characters divided by five). The second-best stretch follows." />
          </div>
        ) : (
          <div className="border border-dashed border-rule-strong rounded-lg px-6 py-8 grid gap-2 max-w-xl">
            <p className="text-lg">Record {MIN_ESSAYS === 4 ? 'four' : MIN_ESSAYS} essays and Trail can forecast your pace. Nothing is sent anywhere.</p>
            <p className="text-sm text-ink-soft">
              {p.counted} of {MIN_ESSAYS} essays with at least {MIN_WORDS} words and five active minutes so far. The forecast is built from your own record on this computer: your speed while writing, how long you sit, and when; no one else's numbers, and no AI writing anything for you.
            </p>
          </div>
        )}
      </section>

      {p.enough && (
        <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
          <div className="grid gap-1 content-start">
            <Marginal>Plan a piece of work</Marginal>
            <span className="text-xs text-ink-soft">Type a word count and, if you like, a due date. The forecast assumes you work the way your record says you do; the sessions below are placed in your own best windows.</span>
          </div>
          <div className="grid gap-6 max-w-3xl">
            <form className="grid sm:grid-cols-[10rem_12rem] gap-4" onSubmit={(e) => e.preventDefault()}>
              <Field label="Target words" id="pace-words" hint={valid ? undefined : 'Between 50 and 50,000.'}>
                <input id="pace-words" className={inputCls} type="number" inputMode="numeric" min={50} max={50000} step={50} value={words} onChange={(e) => setWords(e.target.value)} aria-invalid={!valid} />
              </Field>
              <Field label="Due date (optional)" id="pace-due">
                <input id="pace-due" className={inputCls} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </Field>
            </form>

            {plan && (
              <>
                <dl className="grid sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                  <div>
                    <dt className="marginal inline-flex items-center gap-1.5">
                      Active writing <Info text="Your word count divided by your words per active minute: the middle figure at your median pace, the range at your faster and slower quarters." />
                    </dt>
                    <dd className="mt-1 display text-2xl leading-none tabular">{minutesText(plan.f.activeMinutes.mid)}</dd>
                    <dd className="mt-1 text-ink-soft">
                      {minutesText(plan.f.activeMinutes.low)} to {minutesText(plan.f.activeMinutes.high)}
                    </dd>
                  </div>
                  <div>
                    <dt className="marginal inline-flex items-center gap-1.5">
                      Stints <Info text="Those minutes divided by your median stint, rounded up." />
                    </dt>
                    <dd className="mt-1 display text-2xl leading-none tabular">{plan.f.stints.mid}</dd>
                    <dd className="mt-1 text-ink-soft">
                      {plan.f.stints.low === plan.f.stints.high ? `of about ${plan.sessions[0]?.minutes ?? Math.round(p.stint!.medianMinutes)} min` : `${plan.f.stints.low} to ${plan.f.stints.high}, about ${plan.sessions[0]?.minutes ?? Math.round(p.stint!.medianMinutes)} min each`}
                    </dd>
                  </div>
                  <div>
                    <dt className="marginal inline-flex items-center gap-1.5">
                      {plan.f.startBy ? 'Start by' : 'Calendar days'} <Info text={plan.f.startBy ? 'The due date minus the calendar days this would take you, minus one day of slack.' : 'How many days your essays usually span for this many words, and how many stints you fit into a day; whichever asks for more.'} />
                    </dt>
                    <dd className={cx('mt-1 display text-2xl leading-none tabular', plan.f.startBy && parseIso(plan.f.startBy) < new Date(now).setHours(0, 0, 0, 0) && 'text-paste')}>{plan.f.startBy ? capitalize(dayText(parseIso(plan.f.startBy), now)) : `${plan.f.calendarDays.mid} day${plan.f.calendarDays.mid === 1 ? '' : 's'}`}</dd>
                    <dd className="mt-1 text-ink-soft">{plan.f.startBy ? `${plan.f.calendarDays.mid} day${plan.f.calendarDays.mid === 1 ? '' : 's'} of work plus one of slack${plan.f.lateNightRisk ? '; late-night risk' : ''}` : 'at your usual spread'}</dd>
                  </div>
                </dl>

                <div className="grid gap-2">
                  <h3 className="marginal">Suggested sessions</h3>
                  <ol className="grid divide-y divide-rule border-t border-b border-rule text-sm tabular max-w-xl" aria-label="Suggested sessions">
                    {plan.sessions.map((s, i) => (
                      <li key={s.start} className="grid grid-cols-[1.5rem_1fr_auto] gap-x-3 items-baseline py-2">
                        <span className="text-ink-soft font-mono text-xs">{i + 1}</span>
                        <span>
                          {fmtDate(s.start)}, {fmtTime(s.start)}
                          {s.late && (
                            <Chip kind="paste" className="ml-2">
                              late night
                            </Chip>
                          )}
                        </span>
                        <span className="text-ink-soft whitespace-nowrap">
                          {s.minutes} min · about {numText(s.words)} words
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="text-xs text-ink-soft">
                    {plan.sessions.length} session{plan.sessions.length === 1 ? '' : 's'} of your median stint with your usual break between them, in your best window{win2 ? 's' : ''}
                    {win ? ` (${windowText(win)}${win2 ? `, then ${windowText(win2)}` : ''})` : ' (7pm to 9pm, since your record has no stretch with enough writing yet)'}.{plan.overruns ? ' This runs past the due date: start sooner or sit longer.' : ''} Move them as you like; this is a shape, not a timetable.
                  </p>
                </div>

                <CopyParagraph text={plan.text} label="Copy forecast" />

                <details className="text-sm max-w-2xl">
                  <summary className="cursor-pointer text-ink-soft hover:text-ink">How these numbers were worked out</summary>
                  <ul className="mt-2 grid gap-1.5 text-ink-soft list-disc pl-5">
                    {plan.f.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </details>
              </>
            )}
            <p className="text-xs text-ink-soft max-w-prose">A forecast from your own record, computed on this computer and never sent anywhere. It mimics how your past essays went; it does not write a word of the next one.</p>
          </div>
        </section>
      )}
    </>
  );
}

const oneDecimal = (x: number) => (Math.round(x * 10) / 10).toString();
/** "8–11pm" for a tile; windowText() keeps the longer "8pm to 11pm" for sentences. */
function windowShort(w: PaceWindow): string {
  const a = hourText(w.start);
  const b = hourText((w.start + w.hours) % 24);
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -2)}–${b}` : `${a}–${b}`;
}
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
