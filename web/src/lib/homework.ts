// "Screen time for homework": pure functions over the extension's local work-log (active stints on
// school sites) and the essays' writing sessions. Everything here runs in the browser, in the
// student's local time zone; nothing is sent anywhere. Tested in homework.test.ts.
import type { SessionSummary, WorklogRow } from './types';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Days with at least this much active time count as "worked" (streak, days worked). */
export const WORKED_DAY_MS = 15 * MINUTE;
/** A gap longer than this ends an "unbroken stretch". */
export const BREAK_MS = 10 * MINUTE;
/** Late night: 11pm up to (not including) 5am, local time. */
export const LATE_HOURS = new Set([23, 0, 1, 2, 3, 4]);

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ---- inputs ------------------------------------------------------------------------------------

/** An essay as the Time page needs it: its random doc id, its title, and the recorder's sessions. */
export type EssayRecord = { doc: string; title: string | null; editor: string; sessions: SessionSummary[] };

/** One stint of active work after merging the two sources. Times are epoch ms. */
export type Stint = {
  key: string;
  doc: string | null;
  course_key: string;
  course_label: string;
  item_key: string;
  item_label: string;
  kind: string;
  start: number;
  end: number;
  active_ms: number;
  /** presence = work-log row(s) only; session = writing session(s) only; both = overlapping, merged by the max rule */
  source: 'presence' | 'session' | 'both';
};

export const NO_COURSE_KEY = '';
export const NO_COURSE_LABEL = 'Not in a class';

/** Python emits microseconds; Date accepts up to millis. */
export function parseIso(ts: string): number {
  return new Date(ts.replace(/(\.\d{3})\d+Z$/, '$1Z')).getTime();
}

/** Local calendar day key, YYYY-MM-DD. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Monday = 0 … Sunday = 6, local time. */
export function weekday(ms: number): number {
  return (new Date(ms).getDay() + 6) % 7;
}

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(ms: number, days: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

// ---- merge rule --------------------------------------------------------------------------------

type Interval = { start: number; end: number; active: number; row: WorklogRow | null };

/**
 * Merge rule. For a recorded document, two local sources describe the same sitting: the work-log
 * row (the tab was active on the document) and the essay's writing session (keys were pressed).
 * Rows and sessions for the same doc whose windows overlap are grouped into one cluster, and the
 * cluster's active time is max(sum of presence active, sum of session active), never the sum, so
 * the same minute is never counted twice. Rows and sessions that overlap nothing from the other
 * source keep their own active time. Rows without a doc id (quizzes, modules, pages) pass through.
 */
export function mergeStints(rows: WorklogRow[], essays: EssayRecord[] = []): Stint[] {
  const out: Stint[] = [];
  const byDoc = new Map<string, Interval[]>();
  const rowsByDoc = new Map<string, WorklogRow[]>();

  for (const r of rows) {
    const start = parseIso(r.start);
    const end = Math.max(start, parseIso(r.end));
    if (!r.doc) {
      out.push({ key: r.id, doc: null, course_key: r.course_key, course_label: r.course_label, item_key: r.item_key, item_label: r.item_label, kind: r.kind, start, end, active_ms: clampActive(r.active_ms, start, end), source: 'presence' });
      continue;
    }
    push(byDoc, r.doc, { start, end, active: clampActive(r.active_ms, start, end), row: r });
    push(rowsByDoc, r.doc, r);
  }
  for (const e of essays) {
    for (const s of e.sessions) {
      const start = parseIso(s.start);
      const end = Math.max(start, parseIso(s.end));
      push(byDoc, e.doc, { start, end, active: Math.round(s.active_minutes * MINUTE), row: null });
    }
  }
  const essayByDoc = new Map(essays.map((e) => [e.doc, e]));

  for (const [doc, ivs] of byDoc) {
    ivs.sort((a, b) => a.start - b.start || a.end - b.end);
    let cluster: Interval[] = [];
    let clusterEnd = -Infinity;
    const flush = () => {
      if (!cluster.length) return;
      const presence = cluster.filter((i) => i.row);
      const sessions = cluster.filter((i) => !i.row);
      const presenceActive = presence.reduce((s, i) => s + i.active, 0);
      const sessionActive = sessions.reduce((s, i) => s + i.active, 0);
      const start = Math.min(...cluster.map((i) => i.start));
      const end = Math.max(...cluster.map((i) => i.end));
      const meta = presence[0]?.row ?? nearestRow(rowsByDoc.get(doc) || [], start);
      const essay = essayByDoc.get(doc);
      out.push({
        key: presence[0]?.row?.id ?? `session:${doc}:${start}`,
        doc,
        course_key: meta?.course_key ?? NO_COURSE_KEY,
        course_label: meta?.course_label ?? NO_COURSE_LABEL,
        item_key: meta?.item_key ?? `doc:${doc}`,
        item_label: meta?.item_label || essay?.title || 'Untitled document',
        kind: meta?.kind ?? 'writing',
        start,
        end,
        active_ms: Math.max(presenceActive, sessionActive),
        source: presence.length && sessions.length ? 'both' : presence.length ? 'presence' : 'session',
      });
      cluster = [];
      clusterEnd = -Infinity;
    };
    for (const iv of ivs) {
      if (cluster.length && iv.start > clusterEnd) flush();
      cluster.push(iv);
      clusterEnd = Math.max(clusterEnd, iv.end);
    }
    flush();
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}

/** Active time can never exceed the wall-clock span of its window (plus a one-second floor). */
function clampActive(active: number, start: number, end: number): number {
  const span = Math.max(1000, end - start);
  return Math.max(0, Math.min(Number(active) || 0, span));
}

/** The work-log row of the same doc nearest in time, so a session-only sitting inherits its class and assignment. */
function nearestRow(rows: WorklogRow[], at: number): WorklogRow | null {
  let best: WorklogRow | null = null;
  let bestD = Infinity;
  for (const r of rows) {
    const d = Math.abs(parseIso(r.start) - at);
    if (d < bestD) {
      best = r;
      bestD = d;
    }
  }
  return best;
}

// ---- ranges ------------------------------------------------------------------------------------

export type Range = 'week' | 'last-week' | '30d';
export const RANGES: { id: Range; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'last-week', label: 'Last week' },
  { id: '30d', label: 'Last 30 days' },
];

export type Bounds = { since: number; until: number; prevSince: number; prevUntil: number; days: number; label: string; prevLabel: string };

/** Window bounds in local time. Weeks start on Monday; `until` is exclusive. */
export function rangeBounds(range: Range, now = Date.now()): Bounds {
  const today = startOfDay(now);
  const monday = addDays(today, -weekday(today));
  if (range === 'week') return { since: monday, until: addDays(monday, 7), prevSince: addDays(monday, -7), prevUntil: monday, days: 7, label: 'this week', prevLabel: 'last week' };
  if (range === 'last-week') return { since: addDays(monday, -7), until: monday, prevSince: addDays(monday, -14), prevUntil: addDays(monday, -7), days: 7, label: 'last week', prevLabel: 'the week before' };
  const until = addDays(today, 1);
  const since = addDays(until, -30);
  return { since, until, prevSince: addDays(since, -30), prevUntil: since, days: 30, label: 'in the last 30 days', prevLabel: 'the 30 days before' };
}

export function parseRange(s: string | null | undefined): Range {
  return s === 'last-week' || s === '30d' ? s : 'week';
}

/** Stints overlapping [since, until), clipped to it; active time scales with the clipped share of the window. */
export function clipStints(stints: Stint[], since: number, until: number): Stint[] {
  const out: Stint[] = [];
  for (const s of stints) {
    if (s.end < since || s.start >= until) continue;
    if (s.start >= since && s.end < until) {
      out.push(s);
      continue;
    }
    const start = Math.max(s.start, since);
    const end = Math.min(s.end, until);
    const span = Math.max(1, s.end - s.start);
    out.push({ ...s, start, end, active_ms: Math.round((s.active_ms * (end - start)) / span) });
  }
  return out;
}

// ---- aggregation -------------------------------------------------------------------------------

export type CourseTotal = { course_key: string; course_label: string; active_ms: number; items: number; stints: number };
export type ItemTotal = { item_key: string; item_label: string; course_key: string; course_label: string; kind: string; active_ms: number; stints: number; last: number; doc: string | null };
export type DayTotal = { day: string; active_ms: number };

export type HomeworkSummary = {
  total_ms: number;
  stints: number;
  by_course: CourseTotal[];
  by_item: ItemTotal[];
  /** one entry per calendar day in the window, in order */
  by_day: DayTotal[];
  /** active ms by hour of day, local */
  by_hour: number[];
  /** [weekday Mon..Sun][hour] active ms, local */
  heat: number[][];
};

/** Spread a stint's active time over the local hours it spans, in proportion to wall time. */
export function spreadByHour(s: Stint, cb: (slotStart: number, ms: number) => void): void {
  const span = s.end - s.start;
  if (span <= 0 || s.active_ms <= 0) {
    if (s.active_ms > 0) cb(s.start, s.active_ms);
    return;
  }
  let t = s.start;
  while (t < s.end) {
    const d = new Date(t);
    d.setMinutes(0, 0, 0);
    const next = Math.min(s.end, d.getTime() + HOUR);
    cb(t, (s.active_ms * (next - t)) / span);
    t = next;
  }
}

export function summarize(stints: Stint[], since: number, until: number): HomeworkSummary {
  const by_hour = new Array<number>(24).fill(0);
  const heat = WEEKDAYS.map(() => new Array<number>(24).fill(0));
  const days = new Map<string, number>();
  for (let t = startOfDay(since); t < until; t = addDays(t, 1)) days.set(dayKey(t), 0);
  const courses = new Map<string, CourseTotal & { itemKeys: Set<string> }>();
  const items = new Map<string, ItemTotal>();
  let total = 0;
  for (const s of stints) {
    total += s.active_ms;
    spreadByHour(s, (slot, ms) => {
      const d = new Date(slot);
      by_hour[d.getHours()] += ms;
      heat[weekday(slot)][d.getHours()] += ms;
      const k = dayKey(slot);
      days.set(k, (days.get(k) || 0) + ms);
    });
    let c = courses.get(s.course_key);
    if (!c) {
      c = { course_key: s.course_key, course_label: s.course_label, active_ms: 0, items: 0, stints: 0, itemKeys: new Set() };
      courses.set(s.course_key, c);
    }
    c.active_ms += s.active_ms;
    c.stints += 1;
    c.itemKeys.add(s.item_key);
    let it = items.get(s.item_key);
    if (!it) {
      it = { item_key: s.item_key, item_label: s.item_label, course_key: s.course_key, course_label: s.course_label, kind: s.kind, active_ms: 0, stints: 0, last: s.end, doc: s.doc };
      items.set(s.item_key, it);
    }
    it.active_ms += s.active_ms;
    it.stints += 1;
    it.last = Math.max(it.last, s.end);
    if (!it.doc && s.doc) it.doc = s.doc;
  }
  const by_course = [...courses.values()].map(({ itemKeys, ...c }) => ({ ...c, items: itemKeys.size })).sort((a, b) => b.active_ms - a.active_ms || a.course_label.localeCompare(b.course_label));
  const by_item = [...items.values()].sort((a, b) => b.active_ms - a.active_ms || b.last - a.last);
  const by_day = [...days.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, active_ms]) => ({ day, active_ms: Math.round(active_ms) }));
  return { total_ms: total, stints: stints.length, by_course, by_item, by_day, by_hour: by_hour.map(Math.round), heat: heat.map((r) => r.map(Math.round)) };
}

/** Work-log rows only (no essays): what the extension's own `worklogSummary` would return. */
export function summarizeRows(rows: WorklogRow[], since: number, until: number) {
  const s = summarize(clipStints(mergeStints(rows), since, until), since, until);
  return {
    total_ms: s.total_ms,
    by_course: s.by_course.map(({ course_key, course_label, active_ms, items }) => ({ course_key, course_label, active_ms, items })),
    by_item: s.by_item.map((i) => ({ ...i, last: new Date(i.last).toISOString() })),
    by_day: s.by_day,
    by_hour: s.by_hour,
  };
}

// ---- derived numbers ---------------------------------------------------------------------------

/** Active ms per local day over every stint given (not clipped). */
export function activeByDay(stints: Stint[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of stints) spreadByHour(s, (slot, ms) => m.set(dayKey(slot), (m.get(dayKey(slot)) || 0) + ms));
  return m;
}

/** Consecutive days with at least WORKED_DAY_MS, counted back from today. A quiet today does not break the
 *  streak yet (the day is not over), so counting starts from yesterday in that case. */
export function streakDays(stints: Stint[], now = Date.now(), minMs = WORKED_DAY_MS): number {
  const byDay = activeByDay(stints);
  let t = startOfDay(now);
  if ((byDay.get(dayKey(t)) || 0) < minMs) t = addDays(t, -1);
  let n = 0;
  while ((byDay.get(dayKey(t)) || 0) >= minMs) {
    n += 1;
    t = addDays(t, -1);
  }
  return n;
}

export function daysWorked(summary: HomeworkSummary, minMs = WORKED_DAY_MS): number {
  return summary.by_day.filter((d) => d.active_ms >= minMs).length;
}

/** Mean active time of the stints with any activity. */
export function averageStintMs(stints: Stint[]): number | null {
  const xs = stints.filter((s) => s.active_ms > 0).map((s) => s.active_ms);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function medianStintMs(stints: Stint[]): number | null {
  const xs = stints
    .filter((s) => s.active_ms > 0)
    .map((s) => s.active_ms)
    .sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = xs.length >> 1;
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/** Share of active time between 11pm and 5am, local. Null without data. */
export function lateNightShare(by_hour: number[]): number | null {
  const total = by_hour.reduce((a, b) => a + b, 0);
  if (!total) return null;
  let late = 0;
  by_hour.forEach((v, h) => {
    if (LATE_HOURS.has(h)) late += v;
  });
  return late / total;
}

/** Hour of day with the most active time; null without data. */
export function bestHour(by_hour: number[]): number | null {
  let best = -1;
  let max = 0;
  by_hour.forEach((v, h) => {
    if (v > max) {
      max = v;
      best = h;
    }
  });
  return best < 0 ? null : best;
}

export type Stretch = { ms: number; start: number; end: number; stints: number };

/** Longest run of stints (any class) with no gap over `breakMs`, measured wall clock from first start to last end. */
export function longestStretch(stints: Stint[], breakMs = BREAK_MS): Stretch | null {
  const sorted = stints.filter((s) => s.active_ms > 0).sort((a, b) => a.start - b.start);
  if (!sorted.length) return null;
  let best: Stretch | null = null;
  let cur: Stretch = { ms: 0, start: sorted[0].start, end: sorted[0].end, stints: 1 };
  const close = () => {
    cur.ms = cur.end - cur.start;
    if (!best || cur.ms > best.ms) best = { ...cur };
  };
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i];
    if (s.start - cur.end <= breakMs) {
      cur.end = Math.max(cur.end, s.end);
      cur.stints += 1;
    } else {
      close();
      cur = { ms: 0, start: s.start, end: s.end, stints: 1 };
    }
  }
  close();
  return best;
}

// ---- words -------------------------------------------------------------------------------------

export function durationText(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  const min = Math.round(ms / MINUTE);
  if (min < 1) return ms > 0 ? 'under a minute' : '0 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function hourText(h: number): string {
  const x = h % 12 === 0 ? 12 : h % 12;
  return `${x}${h < 12 ? 'am' : 'pm'}`;
}

export function percentText(x: number | null): string {
  return x === null ? '—' : `${Math.round(x * 100)}%`;
}

export type Habit = { rule: string; text: string; how: string };

/**
 * Three plain observations, chosen by fixed rules in this order; each says which rule produced it.
 * Nothing here scolds: the words report what the record shows and stop.
 */
export function habits(summary: HomeworkSummary, stints: Stint[], bounds: Bounds, now = Date.now()): Habit[] {
  const out: Habit[] = [];
  if (!summary.total_ms) return out;

  // late-night-day: a weekday where more than half the work fell between 11pm and 5am, with at least 30 minutes.
  let lateDay: { wd: number; share: number; ms: number } | null = null;
  summary.heat.forEach((row, wd) => {
    const total = row.reduce((a, b) => a + b, 0);
    if (total < 30 * MINUTE) return;
    const late = row.reduce((a, v, h) => a + (LATE_HOURS.has(h) ? v : 0), 0);
    const share = late / total;
    if (share > 0.5 && (!lateDay || share > lateDay.share)) lateDay = { wd, share, ms: late };
  });
  if (lateDay) {
    const l = lateDay as { wd: number; share: number; ms: number };
    out.push({ rule: 'late-night-day', text: `Most of your ${WEEKDAYS[l.wd]} work happened after 11pm.`, how: `Rule: a weekday where more than half of at least 30 minutes of work fell between 11pm and 5am (${WEEKDAYS[l.wd]}: ${percentText(l.share)}).` });
  }

  // longest-stretch: the longest run without a 10-minute break, if it is at least 20 minutes.
  const stretch = longestStretch(stints);
  if (stretch && stretch.ms >= 20 * MINUTE) {
    out.push({ rule: 'longest-stretch', text: `Your longest unbroken stretch was ${durationText(stretch.ms)} on ${WEEKDAYS[weekday(stretch.start)]}.`, how: `Rule: stints with no gap longer than 10 minutes between them are one stretch; this is the longest, first start to last end.` });
  }

  // days-worked: days in the window (up to today) with at least 15 minutes.
  const todayKey = dayKey(now);
  const daysSoFar = summary.by_day.filter((d) => d.day <= todayKey);
  const worked = daysSoFar.filter((d) => d.active_ms >= WORKED_DAY_MS).length;
  if (daysSoFar.length) {
    const span = bounds.days === 7 ? (daysSoFar.length === 7 ? 'the last 7 days' : `the ${daysSoFar.length} day${daysSoFar.length === 1 ? '' : 's'} so far ${bounds.label}`) : `the last ${daysSoFar.length} days`;
    out.push({ rule: 'days-worked', text: `You worked ${worked} of ${span}.`, how: `Rule: a day counts when it has at least 15 minutes of active time.` });
  }

  // top-class: one class took more than half the time.
  const top = summary.by_course[0];
  if (out.length < 3 && top && summary.by_course.length > 1 && top.active_ms / summary.total_ms > 0.5) {
    out.push({ rule: 'top-class', text: `${top.course_label} took ${percentText(top.active_ms / summary.total_ms)} of your time ${bounds.label}.`, how: 'Rule: a class with more than half of all active time in the window.' });
  }

  // best-hour
  const bh = bestHour(summary.by_hour);
  if (out.length < 3 && bh !== null) {
    out.push({ rule: 'best-hour', text: `Your busiest hour was ${hourText(bh)}.`, how: 'Rule: the hour of the day with the most active minutes, in your local time.' });
  }

  // short-stints
  const med = medianStintMs(stints);
  if (out.length < 3 && med !== null && stints.length >= 5 && med < 10 * MINUTE) {
    out.push({ rule: 'short-stints', text: `Half of your ${stints.length} stints were shorter than ${durationText(med)}.`, how: 'Rule: the median active time of a stint, when there are at least five.' });
  }

  return out.slice(0, 3);
}

export type RecapInput = {
  summary: HomeworkSummary;
  prevTotal: number;
  bounds: Bounds;
  streak: number;
  average: number | null;
  lateShare: number | null;
  stretch: Stretch | null;
  now?: number;
};

/** One deterministic paragraph from the numbers; the "Copy recap" button copies exactly this. */
export function recap({ summary, prevTotal, bounds, streak, average, lateShare, stretch, now = Date.now() }: RecapInput): string {
  const where = bounds.label;
  const Where = where.charAt(0).toUpperCase() + where.slice(1);
  if (!summary.total_ms) return `${Where} no active time on school sites was recorded on this computer.`;
  const parts: string[] = [];
  const delta = summary.total_ms - prevTotal;
  let vs = '';
  if (prevTotal === 0) vs = `; nothing was recorded ${bounds.prevLabel}`;
  else if (Math.abs(delta) < MINUTE) vs = `, the same as ${bounds.prevLabel}`;
  else vs = `, ${durationText(Math.abs(delta))} ${delta > 0 ? 'more' : 'less'} than ${bounds.prevLabel}`;
  parts.push(`${Where} you spent ${durationText(summary.total_ms)} actively working on school sites${vs}.`);
  const top = summary.by_course[0];
  if (top) {
    const n = top.items;
    parts.push(`Most of it went to ${top.course_label} (${durationText(top.active_ms)} across ${n} item${n === 1 ? '' : 's'}).`);
  }
  const todayKey = dayKey(now);
  const daysSoFar = summary.by_day.filter((d) => d.day <= todayKey);
  const worked = daysSoFar.filter((d) => d.active_ms >= WORKED_DAY_MS).length;
  const streakText = streak >= 2 ? ` and your current streak is ${streak} days` : '';
  parts.push(`You worked ${worked} of ${daysSoFar.length} day${daysSoFar.length === 1 ? '' : 's'}${streakText}.`);
  if (average !== null) parts.push(`The typical stint was ${durationText(average)}${lateShare !== null && lateShare > 0 ? `, and ${percentText(lateShare)} of your time fell after 11pm` : ''}.`);
  if (stretch && stretch.ms >= 20 * MINUTE) parts.push(`Your longest unbroken stretch was ${durationText(stretch.ms)} on ${WEEKDAYS[weekday(stretch.start)]}.`);
  return parts.join(' ');
}
