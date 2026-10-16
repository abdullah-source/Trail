// Screen time for homework: the student's own view of active time on school sites, computed on this
// computer from the extension's local work-log and the essays' writing sessions (src/lib/homework.ts).
// No teacher view, no limits, no sharing. "Your pace" (src/lib/pace.ts) reads the same record to say
// how this student works and what a new piece of work would take at their own rhythm.
//
// On the document: a page head with the range radios, stats with expanded numerals, then a note per
// part (class bars on typed-green pill tracks, the assignment ledger, the 7 x 24 heat map on the typed
// wash scale, habits, the recap) and a second section for "Your pace" with the planner
// (DESIGN-document.md §9, "Time / Patterns").
import { useMemo, useState, type CSSProperties } from 'react';
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
import { Button, Caption, Chip, EmptyState, ErrorNote, Info, Loading, Marginal, Note, ProgressBar, Radio, ScrollArea, SectionHead, StatGrid, StatTile, TABLE, TD, TH, TextField, cx, type ChipKind } from '../components/ui';
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

const KIND_CHIP: Record<string, ChipKind> = { writing: 'typed', assignment: 'neutral', quiz: 'neutral', discussion: 'neutral', module: 'neutral', page: 'neutral', course: 'neutral' };

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
  const rangeLabel = RANGES.find((r) => r.id === range)!.label;

  return (
    <div className="grid gap-16 min-w-0">
      <section className="grid gap-10 min-w-0" aria-labelledby="time-title">
        <SectionHead
          as="h1"
          kicker={rangeLabel}
          index="Nº 02"
          title={<span id="time-title">Time</span>}
          lede="Active minutes on the school sites and editors Trail already records, read from the extension on this computer. Nothing on this page leaves this device, and no teacher can see it."
          aside={<RangePicker range={range} onChange={(r) => setParams(r === 'week' ? {} : { range: r }, { replace: true })} />}
        />

        <StatGrid min={150} compact>
          <StatTile label={rangeLabel} value={durationText(summary.total_ms)} detail={deltaText} info={`Active time ${bounds.label}: minutes a school tab was in front and you were doing something, plus writing sessions in your essays. Idle minutes with the tab open are not counted. Compared with the same length of time before it.`} />
          <StatTile label="Days worked" value={`${worked} / ${summary.by_day.length}`} detail={streak ? `${streak}-day streak` : 'no streak yet'} info="A day counts when it has at least 15 minutes of active time. The streak is the run of such days ending today (or yesterday, if today is still quiet)." />
          <StatTile label="Typical stint" value={durationText(average)} detail={`${summary.stints} stint${summary.stints === 1 ? '' : 's'}`} info="The mean active time of one sitting on one item. A sitting ends when you leave the tab or the editor goes quiet." />
          <StatTile label="After 11pm" value={percentText(lateShare)} detail="of your active time" tone={lateShare !== null && lateShare > 0.33 ? 'paste' : undefined} info="Share of active minutes that fell between 11pm and 5am, your local time." />
        </StatGrid>

        <div className="grid lg:grid-cols-2 gap-x-10 gap-y-12 items-start">
        <Note as="section" label="By class">
          <Caption>Active time per class {bounds.label}, with how many items you touched. Press a class to filter the list below.</Caption>
          <ClassBars summary={summary} selected={course} onSelect={setCourse} />
        </Note>

        <Note as="section" label="When you work">
          <Caption>Active minutes by weekday and hour of the day, your local time, summed over {bounds.label}. Darker is more; hover a cell for the number.</Caption>
          <div className="grid gap-6 items-start">
            <HeatGrid heat={summary.heat} />
            <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(9rem,100%),1fr))] gap-4 text-sm m-0">
              <div>
                <dt className="marginal inline-flex items-center gap-1.5">
                  Busiest hour <Info text="The hour of the day with the most active minutes in this window." />
                </dt>
                <dd className="m-0 mt-1 tabular">{bestHour(summary.by_hour) === null ? '—' : hourText(bestHour(summary.by_hour)!)}</dd>
              </div>
              <div>
                <dt className="marginal inline-flex items-center gap-1.5">
                  Late night <Info text="Share of active minutes between 11pm and 5am." />
                </dt>
                <dd className="m-0 mt-1 tabular">{percentText(lateShare)}</dd>
              </div>
              <div>
                <dt className="marginal inline-flex items-center gap-1.5">
                  Longest stretch <Info text="The longest run of sittings with no gap over 10 minutes, measured from first start to last end, across every class." />
                </dt>
                <dd className="m-0 mt-1 tabular">{stretch ? `${durationText(stretch.ms)} on ${WEEKDAYS[(new Date(stretch.start).getDay() + 6) % 7]}` : '—'}</dd>
              </div>
            </dl>
          </div>
        </Note>
        </div>

        <Note as="section" label="By assignment">
          <Caption>{course ? `Items in ${summary.by_course.find((c) => c.course_key === course)?.course_label ?? 'this class'}. ` : 'Every item you worked on, most time first. '}Stints are separate sittings; an essay with a recorded document links to its replay.</Caption>
          <ItemTable items={visibleItems} now={view.now} />
        </Note>

        {cards.length > 0 && (
          <section className="grid gap-6">
            <SectionHead as="h2" kicker="Observations" title="Habits" lede="Plain observations from the numbers above. Each one says which rule produced it. No targets, no limits." className="[&_.h-section]:text-2xl" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12">
              {cards.map((c) => (
                <Note key={c.rule} label={c.rule}>
                  <p className="text-sm">{c.text}</p>
                  <Caption>{c.how}</Caption>
                </Note>
              ))}
            </div>
          </section>
        )}

        <Note as="section" label="Recap" className="max-w-3xl">
          <Caption>The same numbers as one paragraph, written by a fixed template. Copy it into a journal or a message to yourself.</Caption>
          <CopyParagraph text={text} label="Copy recap" />
        </Note>

        <Caption>
          Counted on this computer. No teacher view, no limit, no sharing. {stints.length} sitting{stints.length === 1 ? '' : 's'} {bounds.label}; where a recorded essay and its school-site stint overlap, the longer of the two is counted once, never both. Export or delete this log in{' '}
          <Link to="/app/settings" className="link">
            Settings
          </Link>
          .
        </Caption>
      </section>

      <PaceWindow profile={pace} now={view.now} />
    </div>
  );
}


function Empty({ installed }: { installed: boolean }) {
  return (
    <EmptyState
      title={installed ? 'Nothing recorded yet' : 'The extension is not talking to this page'}
      icon="session"
      body={
        <>
          <p>Once the extension has seen you work on a school site, this page shows how long, on what, and when. It is computed on this computer and never shared.</p>
          <p>What gets tracked: only the school sites and editors Trail already records (your LMS, Google Docs, Notion, Word Online), only while that tab is in front and you are doing something, and only on this computer. Course and assignment names stay in the extension's local database; they never reach Trail's server, and no teacher can see them.</p>
          <p>
            {installed ? (
              <>Open an assignment, quiz or document on one of those sites and come back; the first stint appears within a minute.</>
            ) : (
              <>
                <Link to="/install" className="link">
                  Install the extension
                </Link>{' '}
                in Chrome on this computer, then come back here.
              </>
            )}
          </p>
        </>
      }
    />
  );
}

function RangePicker({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  return (
    <fieldset className="flex flex-wrap gap-x-5 gap-y-2 border-0 p-0 m-0">
      <legend className="sr-only">Time range</legend>
      {RANGES.map((r) => (
        <Radio key={r.id} name="time-range" label={r.label} checked={range === r.id} onChange={() => onChange(r.id)} />
      ))}
    </fieldset>
  );
}

function ClassBars({ summary, selected, onSelect }: { summary: HomeworkSummary; selected: string | null; onSelect: (k: string | null) => void }) {
  const max = Math.max(1, ...summary.by_course.map((c) => c.active_ms));
  if (!summary.by_course.length) return <p className="text-sm text-ink-soft">No active time in this window.</p>;
  return (
    <ul className="grid gap-4 font-mono text-xs tabular list-none m-0 p-0" aria-label="Active time by class">
      {summary.by_course.map((c) => {
        const on = selected === c.course_key;
        return (
          <li key={c.course_key} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(6rem,11rem)_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
            <Button size="sm" variant={on ? 'primary' : 'secondary'} aria-pressed={on} onClick={() => onSelect(on ? null : c.course_key)} className="justify-start min-w-0 max-w-full" title={c.course_label}>
              <span className="truncate">{c.course_label}</span>
            </Button>
            <ProgressBar value={c.active_ms / max} tone={selected && !on ? 'ink' : 'typed'} label={`${c.course_label}: ${durationText(c.active_ms)}`} className="order-last col-span-2 sm:order-none sm:col-span-1" style={selected && !on ? { opacity: 0.35 } : undefined} />
            <span className="whitespace-nowrap text-ink-soft text-right">
              <span className="text-ink">{durationText(c.active_ms)}</span> · {c.items} item{c.items === 1 ? '' : 's'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ItemTable({ items, now }: { items: HomeworkSummary['by_item']; now: number }) {
  if (!items.length) return <p className="text-sm text-ink-soft">No items in this window.</p>;
  return (
    <ScrollArea label="Active time by assignment" maxHeight={360}>
      <table className={TABLE}>
        <thead>
          <tr>
            <th className={TH}>Item</th>
            <th className={cx(TH, 'hide-phone')}>Class</th>
            <th className={cx(TH, 'hide-phone')}>Kind</th>
            <th className={cx(TH, 'text-right')}>Active</th>
            <th className={cx(TH, 'hide-phone text-right')}>Stints</th>
            <th className={cx(TH, 'hide-phone')}>Last worked</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.item_key} className="border-t border-rule first:border-t-0">
              <td className={cx(TD, 'max-w-[14rem] sm:max-w-[18rem] font-sans text-sm')} title={i.item_label}>
                <span className="block overflow-hidden text-ellipsis">
                  {i.doc ? (
                    <Link to={`/app/essays/${encodeURIComponent(i.doc)}`} className="link" title="Open the essay replay">
                      {i.item_label}
                    </Link>
                  ) : (
                    <span className="text-ink">{i.item_label}</span>
                  )}
                </span>
                {/* phones: stints and last worked fold under the item */}
                <span className="min-[701px]:hidden block font-mono text-xs text-ink-soft mt-0.5">
                  {i.stints} stint{i.stints === 1 ? '' : 's'} · {relative(new Date(i.last).toISOString(), now)}
                </span>
              </td>
              <td className={cx(TD, 'hide-phone text-ink-soft')}>{i.course_label}</td>
              <td className={cx(TD, 'hide-phone')}>
                <Chip kind={KIND_CHIP[i.kind] || 'neutral'}>{i.kind}</Chip>
              </td>
              <td className={cx(TD, 'text-right')}>{durationText(i.active_ms)}</td>
              <td className={cx(TD, 'hide-phone text-right text-ink-soft')}>{i.stints}</td>
              <td className={cx(TD, 'hide-phone text-ink-soft')}>{relative(new Date(i.last).toISOString(), now)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}

/** 7 x 24 heat map: square cells up to 16 px (they shrink together on a phone), four steps of the typed wash scale. */
function HeatGrid({ heat }: { heat: number[][] }) {
  const max = Math.max(1, ...heat.flat());
  const level = (v: number) => (v === 0 ? 0 : Math.max(1, Math.ceil((v / max) * 3)));
  const fills = ['var(--well)', 'var(--typed-wash)', 'color-mix(in srgb, var(--typed) 50%, var(--sheet))', 'var(--typed)'];
  const cols: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 16px))', gap: 2 };
  const hours = [0, 6, 12, 18];
  return (
    <figure className="grid gap-1 min-w-0">
      <div className="grid gap-x-2 gap-y-0.5 items-center" style={{ gridTemplateColumns: '2.5rem minmax(0, 1fr)' }}>
        <span />
        <div style={cols} className="font-mono text-ink-soft" aria-hidden>
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className={cx('whitespace-nowrap', !hours.includes(h) && 'invisible')} style={{ fontSize: 11, lineHeight: '16px' }}>
              {hourText(h)}
            </span>
          ))}
        </div>
        {heat.map((row, wd) => (
          <div key={wd} className="contents">
            <span className="font-mono text-ink-soft" style={{ fontSize: 11 }}>
              {WEEKDAYS_SHORT[wd]}
            </span>
            <div style={cols} role="row">
              {row.map((v, h) => {
                const min = Math.round(v / 60_000);
                return <i key={h} role="cell" title={`${WEEKDAYS[wd]} ${hourText(h)}: ${min ? `${min} min` : 'nothing'}`} aria-label={`${WEEKDAYS[wd]} ${hourText(h)}: ${min} minutes`} className="block rounded-[2px]" style={{ aspectRatio: '1', background: fills[level(v)], boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--rule) 70%, transparent)' }} />;
              })}
            </div>
          </div>
        ))}
      </div>
      <figcaption className="font-mono text-xs text-ink-soft mt-1">Each cell is one weekday-hour; the darkest cell holds {durationText(max)} of active time.</figcaption>
    </figure>
  );
}

function CopyParagraph({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <div className="grid gap-3">
      <article className="bg-well border border-rule rounded-sm p-4 sm:p-5 essay">
        <p>{text}</p>
      </article>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          icon="copy"
          onClick={async () => {
            setState((await copyText(text)) ? 'copied' : 'failed');
            setTimeout(() => setState('idle'), 2500);
          }}
        >
          {label}
        </Button>
        {state !== 'idle' && <Caption role="status">{state === 'copied' ? 'Copied.' : 'Could not copy; select the text instead.'}</Caption>}
      </div>
    </div>
  );
}

// ---- your pace -----------------------------------------------------------------------------------

const DEFAULT_WORDS = 1500;

function PaceWindow({ profile: p, now }: { profile: PaceProfile; now: number }) {
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
  const startLate = plan?.f.startBy ? parseIso(plan.f.startBy) < new Date(now).setHours(0, 0, 0, 0) : false;

  return (
    <section className="grid gap-10 min-w-0" aria-labelledby="pace-title">
      <SectionHead
        as="h2"
        kicker={p.enough ? `${p.counted} essay${p.counted === 1 ? '' : 's'}` : `${p.counted} of ${MIN_ESSAYS}`}
        title={<span id="pace-title">Your pace</span>}
        lede="How you write, read from every recorded essay: your speed while active, how long you sit, how many sittings a piece takes, and when you write best. A profile, not a target."
      />
      {p.enough && q && p.stint ? (
        <StatGrid min={150} compact>
          <StatTile label="Words a minute" value={oneDecimal(q.median)} detail={`${oneDecimal(q.p25)} to ${oneDecimal(q.p75)} on slower and faster essays`} info={`Final words divided by active minutes, essay by essay; this is your middle essay. Essays with at least ${MIN_WORDS} words and five active minutes count (${p.counted} so far). The range is your slower and faster quarters.`} />
          <StatTile label="Typical stint" value={minutesText(p.stint.medianMinutes)} detail={`half between ${minutesText(p.stint.p25)} and ${minutesText(p.stint.p75)}`} info="The median active time of one sitting, across every stint on this page (school sites and writing sessions merged). The middle half of your stints fall in the range below." />
          <StatTile label="Sittings per 1,000 words" value={p.sessionsPer1000Words === null ? '—' : oneDecimal(p.sessionsPer1000Words)} detail={p.calendarDaysPer1000Words ? `over about ${oneDecimal(p.calendarDaysPer1000Words.median)} days` : undefined} info="How many separate writing sessions your essays took per 1,000 final words, and how many calendar days passed from the first session to the last; the middle essay each time." />
          <StatTile label="Best window" value={win ? windowShort(win) : '—'} detail={win ? `${oneDecimal(win.wordsPerMinute)} words a minute${win2 ? `; then ${windowText(win2)}` : ''}` : 'not enough writing in any one stretch yet'} info="The one-to-three-hour stretch of the day where you type the most words per active minute, with at least 30 minutes of writing in it (words are typed characters divided by five). The second-best stretch follows." />
        </StatGrid>
      ) : (
        <Note label="Not enough essays yet" className="max-w-3xl">
          <p className="text-sm">Record {MIN_ESSAYS === 4 ? 'four' : MIN_ESSAYS} essays and Trail can forecast your pace. Nothing is sent anywhere.</p>
          <div className="flex items-center gap-3 font-mono text-xs">
            <ProgressBar value={p.counted / MIN_ESSAYS} label="Essays recorded toward a pace profile" tone="typed" />
            <span className="tabular">
              {p.counted} of {MIN_ESSAYS}
            </span>
          </div>
          <Caption>
            Essays with at least {MIN_WORDS} words and five active minutes count. The forecast is built from your own record on this computer: your speed while writing, how long you sit, and when; no one else's numbers, and no AI writing anything for you.
          </Caption>
        </Note>
      )}

      {p.enough && (
        <Note as="section" label="Plan a piece of work">
          <Caption>Type a word count and, if you like, a due date. The forecast assumes you work the way your record says you do; the sessions below are placed in your own best windows.</Caption>
          <form className="grid grid-cols-[repeat(auto-fit,minmax(min(11rem,100%),13rem))] gap-4" onSubmit={(e) => e.preventDefault()}>
            <TextField id="pace-words" label="Target words" type="number" inputMode="numeric" min={50} max={50000} step={50} value={words} onChange={(e) => setWords(e.target.value)} aria-invalid={!valid} hint={valid ? undefined : 'Between 50 and 50,000.'} />
            <TextField id="pace-due" label="Due date (optional)" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </form>

          {plan && (
            <>
              <StatGrid compact>
                <StatTile label="Active writing" value={minutesText(plan.f.activeMinutes.mid)} detail={`${minutesText(plan.f.activeMinutes.low)} to ${minutesText(plan.f.activeMinutes.high)}`} info="Your word count divided by your words per active minute: the middle figure at your median pace, the range at your faster and slower quarters." />
                <StatTile label="Stints" value={plan.f.stints.mid} detail={plan.f.stints.low === plan.f.stints.high ? `of about ${plan.sessions[0]?.minutes ?? Math.round(p.stint!.medianMinutes)} min` : `${plan.f.stints.low} to ${plan.f.stints.high}, about ${plan.sessions[0]?.minutes ?? Math.round(p.stint!.medianMinutes)} min each`} info="Those minutes divided by your median stint, rounded up." />
                <StatTile
                  label={plan.f.startBy ? 'Start by' : 'Calendar days'}
                  value={plan.f.startBy ? capitalize(dayText(parseIso(plan.f.startBy), now)) : `${plan.f.calendarDays.mid} day${plan.f.calendarDays.mid === 1 ? '' : 's'}`}
                  tone={startLate ? 'paste' : undefined}
                  detail={plan.f.startBy ? `${plan.f.calendarDays.mid} day${plan.f.calendarDays.mid === 1 ? '' : 's'} of work plus one of slack${plan.f.lateNightRisk ? '; late-night risk' : ''}` : 'at your usual spread'}
                  info={plan.f.startBy ? 'The due date minus the calendar days this would take you, minus one day of slack.' : 'How many days your essays usually span for this many words, and how many stints you fit into a day; whichever asks for more.'}
                />
              </StatGrid>

              <div className="grid gap-2">
                <Marginal as="h3">Suggested sessions</Marginal>
                <ScrollArea label="Suggested sessions" maxHeight={280} className="max-w-2xl">
                  <table className={TABLE}>
                    <thead>
                      <tr>
                        <th className={TH}>#</th>
                        <th className={TH}>When</th>
                        <th className={cx(TH, 'text-right')}>Length</th>
                        <th className={cx(TH, 'text-right')}>Words</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.sessions.map((s, i) => (
                        <tr key={s.start} className="border-t border-rule first:border-t-0">
                          <td className={cx(TD, 'text-ink-faint')}>{i + 1}</td>
                          <td className={TD}>
                            {fmtDate(s.start)}, {fmtTime(s.start)}
                            {s.late && (
                              <Chip kind="paste" className="ml-2">
                                late night
                              </Chip>
                            )}
                          </td>
                          <td className={cx(TD, 'text-right')}>{s.minutes} min</td>
                          <td className={cx(TD, 'text-right text-ink-soft')}>about {numText(s.words)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
                <Caption>
                  {plan.sessions.length} session{plan.sessions.length === 1 ? '' : 's'} of your median stint with your usual break between them, in your best window{win2 ? 's' : ''}
                  {win ? ` (${windowText(win)}${win2 ? `, then ${windowText(win2)}` : ''})` : ' (7pm to 9pm, since your record has no stretch with enough writing yet)'}.{plan.overruns ? ' This runs past the due date: start sooner or sit longer.' : ''} Move them as you like; this is a shape, not a timetable.
                </Caption>
              </div>

              <div className="grid gap-2">
                <Marginal as="h3">Forecast</Marginal>
                <CopyParagraph text={plan.text} label="Copy forecast" />
              </div>

              <details className="text-sm max-w-2xl">
                <summary className="cursor-pointer font-mono text-xs text-ink-soft">How these numbers were worked out</summary>
                <ul className="mt-2 grid gap-1.5 text-ink-soft list-disc pl-5">
                  {plan.f.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </details>
            </>
          )}
          <Caption>A forecast from your own record, computed on this computer and never sent anywhere. It mimics how your past essays went; it does not write a word of the next one.</Caption>
        </Note>
      )}
    </section>
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
