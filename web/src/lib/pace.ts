// "Your pace": a local, pattern-based profile of how THIS student works, and a forecast that mimics
// their own rhythm for a new piece of work. Pure functions over the essays' writing sessions and the
// merged work-log stints (src/lib/homework.ts). Everything runs in the browser, in local time; nothing
// here writes a word for the student and nothing leaves the device. Tested in pace.test.ts.
import type { SessionSummary } from './types';
import { DAY, HOUR, LATE_HOURS, MINUTE, WEEKDAYS, addDays, dayKey, hourText, mergeStints, parseIso, startOfDay, weekday, type Stint } from './homework';

// ---- rules (named once, quoted by the notes) --------------------------------------------------

/** An essay counts toward the pace once it has this many final words... */
export const MIN_WORDS = 150;
/** ...and this many active minutes (a shorter record gives a meaningless words-per-minute figure). */
export const MIN_ESSAY_MINUTES = 5;
/** The profile is "enough" to forecast from after this many counted essays. */
export const MIN_ESSAYS = 4;
/** An hour of the day needs this much writing before it gets a words-per-minute figure. */
export const MIN_HOUR_MINUTES = 10;
/** A best window needs this much writing in total. */
export const MIN_WINDOW_MINUTES = 30;
/** Best windows are 1 to 3 contiguous hours. */
export const MAX_WINDOW_HOURS = 3;
/** Above this share of late-night work, late nights are treated as the student's own rhythm. */
export const LATE_SHARE_LIMIT = 0.3;
/** Gaps between stints longer than this are a different sitting, not a break. */
export const MAX_GAP_MS = 6 * HOUR;
/** Words typed are estimated from characters, the same rule as the Patterns page's pace. */
export const CHARS_PER_WORD = 5;
/** When the record offers no usable window, sessions go here (7pm to 9pm). */
export const FALLBACK_WINDOW_START = 19;

// ---- types -----------------------------------------------------------------------------------

/** An essay as the pace profile needs it: the extension's totals plus the recorder's sessions. */
export type PaceEssay = {
  doc: string;
  title: string | null;
  /** final word count */
  words: number;
  typed_chars: number;
  pasted_chars: number;
  deleted_chars: number;
  sessions: SessionSummary[];
};

export type Quartiles = { median: number; p25: number; p75: number };

export type HourEntry = { hour: number; activeMinutes: number; wordsPerMinute: number | null };

/** A contiguous range of local hours: `start` and `hours` long, wrapping past midnight when needed. */
export type PaceWindow = { start: number; hours: number; minutes: number; wordsPerMinute: number; late: boolean };

export type PaceProfile = {
  /** essays with at least one active session */
  essays: number;
  /** essays that count toward the pace (MIN_WORDS words and MIN_ESSAY_MINUTES active minutes) */
  counted: number;
  /** final words per active minute, quartiles across counted essays */
  wordsPerActiveMinute: Quartiles | null;
  /** 24 entries, local hours, from the essays' writing sessions */
  byHour: HourEntry[];
  /** top 2 contiguous hour ranges by words per minute, with enough minutes */
  bestWindows: PaceWindow[];
  /** active minutes of one stint, quartiles across stints */
  stint: { medianMinutes: number; p25: number; p75: number } | null;
  /** break between two stints on the same day */
  gapBetweenStints: { medianMinutes: number } | null;
  /** stints on a day with any work, median */
  stintsPerWorkedDay: { median: number } | null;
  /** writing sessions per 1,000 final words, median across counted essays */
  sessionsPer1000Words: number | null;
  /** first-to-last-session span per 1,000 final words, median across counted essays */
  calendarDaysPer1000Words: { median: number } | null;
  /** deleted characters / typed characters */
  revisionShare: number | null;
  /** pasted characters / (typed + pasted) */
  pasteShare: number | null;
  /** share of active time between 11pm and 5am */
  lateNightShare: number | null;
  enough: boolean;
};

export type Band = { low: number; mid: number; high: number };

export type ForecastInput = { words: number; dueAt?: string | null; now?: number };

export type Forecast = {
  words: number;
  dueAt: string | null;
  now: number;
  /** low = at your faster quarter, mid = your median, high = at your slower quarter */
  activeMinutes: Band;
  stints: Band;
  calendarDays: { mid: number };
  /** local midnight of the day to start by, or null without a due date */
  startBy: string | null;
  lateNightRisk: boolean;
  /** plain sentences, each naming the rule that produced a number */
  notes: string[];
};

export type PlannedSession = { start: string; minutes: number; words: number; window: string; late: boolean };

// ---- small maths -----------------------------------------------------------------------------

/** Linear-interpolated quantile of an ascending list (the numpy default). */
export function quantile(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function quartiles(xs: number[]): Quartiles | null {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  return { median: quantile(s, 0.5), p25: quantile(s, 0.25), p75: quantile(s, 0.75) };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Spread `amount` over the local hours between start and end (epoch ms), in proportion to wall time. */
export function spreadHours(start: number, end: number, amount: number, cb: (hour: number, part: number) => void): void {
  if (!(amount > 0)) return;
  if (end <= start) {
    cb(new Date(start).getHours(), amount);
    return;
  }
  const span = end - start;
  let t = start;
  while (t < end) {
    const d = new Date(t);
    d.setMinutes(0, 0, 0);
    const next = Math.min(end, d.getTime() + HOUR);
    cb(d.getHours(), (amount * (next - t)) / span);
    t = next;
  }
}

/** Active minutes per local hour over every session, each session spread over the hours it spans. */
export function sessionMinutesByLocalHour(sessions: SessionSummary[]): number[] {
  const hours = new Array<number>(24).fill(0);
  for (const s of sessions) {
    const a = parseIso(s.start);
    const b = Math.max(a, parseIso(s.end));
    spreadHours(a, b, s.active_minutes, (h, part) => (hours[h] += part));
  }
  return hours;
}

// ---- profile ---------------------------------------------------------------------------------

type EssayStat = { words: number; minutes: number; sessions: number; days: number; wpm: number };

function essayStat(e: PaceEssay, now: number): EssayStat | null {
  const sessions = e.sessions.filter((s) => s.active_minutes > 0 && parseIso(s.start) <= now + DAY);
  if (!sessions.length) return null;
  const minutes = sum(sessions.map((s) => s.active_minutes));
  if (!(minutes > 0)) return null;
  const first = Math.min(...sessions.map((s) => parseIso(s.start)));
  const last = Math.max(...sessions.map((s) => Math.max(parseIso(s.start), parseIso(s.end))));
  const days = Math.round((startOfDay(last) - startOfDay(first)) / DAY) + 1;
  return { words: e.words, minutes, sessions: sessions.length, days, wpm: e.words / minutes };
}

function overlaps(a: PaceWindow, b: PaceWindow): boolean {
  const hs = new Set<number>();
  for (let i = 0; i < a.hours; i++) hs.add((a.start + i) % 24);
  for (let i = 0; i < b.hours; i++) if (hs.has((b.start + i) % 24)) return true;
  return false;
}

/**
 * Best windows: every run of 1 to MAX_WINDOW_HOURS local hours with at least MIN_WINDOW_MINUTES of
 * writing (and MIN_HOUR_MINUTES in each hour, so a quiet hour cannot ride along), ranked by words per
 * minute. The top run is widened to the overlapping run with the most minutes whose pace is within 15%
 * of it, so "9pm to 11pm" wins over a lone "9pm" when 10pm is nearly as good. Two non-overlapping picks.
 */
export function bestWindows(minutesByHour: number[], wordsByHour: number[]): PaceWindow[] {
  const cands: PaceWindow[] = [];
  for (let start = 0; start < 24; start++) {
    for (let hours = 1; hours <= MAX_WINDOW_HOURS; hours++) {
      let minutes = 0;
      let words = 0;
      let late = false;
      let thin = false;
      for (let i = 0; i < hours; i++) {
        const h = (start + i) % 24;
        if (minutesByHour[h] < MIN_HOUR_MINUTES) thin = true;
        minutes += minutesByHour[h];
        words += wordsByHour[h];
        if (LATE_HOURS.has(h)) late = true;
      }
      if (thin || minutes < MIN_WINDOW_MINUTES) continue;
      cands.push({ start, hours, minutes, wordsPerMinute: words / minutes, late });
    }
  }
  cands.sort((a, b) => b.wordsPerMinute - a.wordsPerMinute || b.minutes - a.minutes || a.hours - b.hours);
  const out: PaceWindow[] = [];
  let pool = cands;
  while (out.length < 2 && pool.length) {
    const top = pool[0];
    const near = pool.filter((c) => overlaps(c, top) && c.wordsPerMinute >= top.wordsPerMinute * 0.85);
    near.sort((a, b) => b.minutes - a.minutes || b.wordsPerMinute - a.wordsPerMinute);
    const pick = near[0];
    out.push(pick);
    pool = pool.filter((c) => !overlaps(c, pick));
  }
  return out;
}

export function profile(essays: PaceEssay[], stints: Stint[], now = Date.now()): PaceProfile {
  const stats = essays.map((e) => essayStat(e, now)).filter((s): s is EssayStat => s !== null);
  const counted = stats.filter((s) => s.words >= MIN_WORDS && s.minutes >= MIN_ESSAY_MINUTES);

  // when you write, and how fast at each hour: from the writing sessions
  const minutesByHour = new Array<number>(24).fill(0);
  const wordsByHour = new Array<number>(24).fill(0);
  for (const e of essays) {
    for (const s of e.sessions) {
      if (!(s.active_minutes > 0)) continue;
      const a = parseIso(s.start);
      if (a > now + DAY) continue;
      const b = Math.max(a, parseIso(s.end));
      spreadHours(a, b, s.active_minutes, (h, part) => (minutesByHour[h] += part));
      spreadHours(a, b, s.typed_chars / CHARS_PER_WORD, (h, part) => (wordsByHour[h] += part));
    }
  }
  const byHour: HourEntry[] = minutesByHour.map((m, hour) => ({ hour, activeMinutes: m, wordsPerMinute: m >= MIN_HOUR_MINUTES ? wordsByHour[hour] / m : null }));

  // how you sit down to work: from every stint (work-log and sessions merged), or the sessions alone
  const source = stints.length ? stints : mergeStints([], essays.map((e) => ({ doc: e.doc, title: e.title, editor: '', sessions: e.sessions })));
  const base = source.filter((s) => s.active_ms > 0 && s.start <= now + DAY).sort((a, b) => a.start - b.start || a.end - b.end);
  const sq = quartiles(base.map((s) => s.active_ms / MINUTE));
  const gaps: number[] = [];
  const perDay = new Map<string, number>();
  let lastEnd = -Infinity;
  let late = 0;
  let total = 0;
  for (const s of base) {
    const gap = s.start - lastEnd;
    if (lastEnd > -Infinity && gap > 0 && gap <= MAX_GAP_MS && dayKey(lastEnd) === dayKey(s.start)) gaps.push(gap / MINUTE);
    lastEnd = Math.max(lastEnd, s.end);
    const k = dayKey(s.start);
    perDay.set(k, (perDay.get(k) || 0) + 1);
    spreadHours(s.start, s.end, s.active_ms, (h, part) => {
      total += part;
      if (LATE_HOURS.has(h)) late += part;
    });
  }
  const gq = quartiles(gaps);
  const dq = quartiles([...perDay.values()]);

  const typed = sum(essays.map((e) => e.typed_chars));
  const deleted = sum(essays.map((e) => e.deleted_chars));
  const pasted = sum(essays.map((e) => e.pasted_chars));
  const sessionsPer1000 = quartiles(counted.map((s) => (s.sessions / s.words) * 1000));
  const daysPer1000 = quartiles(counted.map((s) => (s.days / s.words) * 1000));

  return {
    essays: stats.length,
    counted: counted.length,
    wordsPerActiveMinute: quartiles(counted.map((s) => s.wpm)),
    byHour,
    bestWindows: bestWindows(minutesByHour, wordsByHour),
    stint: sq ? { medianMinutes: sq.median, p25: sq.p25, p75: sq.p75 } : null,
    gapBetweenStints: gq ? { medianMinutes: gq.median } : null,
    stintsPerWorkedDay: dq ? { median: dq.median } : null,
    sessionsPer1000Words: sessionsPer1000 ? sessionsPer1000.median : null,
    calendarDaysPer1000Words: daysPer1000 ? { median: daysPer1000.median } : null,
    revisionShare: typed > 0 ? deleted / typed : null,
    pasteShare: typed + pasted > 0 ? pasted / (typed + pasted) : null,
    lateNightShare: total > 0 ? late / total : null,
    enough: counted.length >= MIN_ESSAYS,
  };
}

// ---- forecast --------------------------------------------------------------------------------

/** A due date as the form gives it: "YYYY-MM-DD" means the end of that local day; anything else is an ISO instant. */
export function parseDue(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 0, 0).getTime();
  return parseIso(s);
}

const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Rules, in order, each quoted in `notes`:
 *  1. active minutes = words / words-per-active-minute (p75 → low, median → mid, p25 → high);
 *  2. stints = active minutes / median stint, rounded up, at least 1;
 *  3. calendar days = the larger of (days per 1,000 words × words) and (stints / stints per worked day), at least 1;
 *  4. start by = the due date's day minus the calendar days minus one day of slack;
 *  5. late-night risk = a due date is set and more than 30% of past work fell between 11pm and 5am.
 */
export function forecast(p: PaceProfile, { words, dueAt = null, now = Date.now() }: ForecastInput): Forecast | null {
  if (!p.enough || !p.wordsPerActiveMinute || !p.stint) return null;
  const w = Math.max(1, Math.round(words));
  const q = p.wordsPerActiveMinute;
  const minutesAt = (wpm: number) => w / Math.max(wpm, 0.1);
  const activeMinutes: Band = { low: minutesAt(q.p75), mid: minutesAt(q.median), high: minutesAt(q.p25) };
  const stintLen = Math.max(5, p.stint.medianMinutes);
  const count = (m: number) => Math.max(1, Math.ceil(m / stintLen));
  const stints: Band = { low: count(activeMinutes.low), mid: count(activeMinutes.mid), high: count(activeMinutes.high) };
  const perDay = Math.max(1, Math.round(p.stintsPerWorkedDay?.median ?? 1));
  const fromRecord = p.calendarDaysPer1000Words ? Math.round((p.calendarDaysPer1000Words.median * w) / 1000) : 0;
  const fromStints = Math.ceil(stints.mid / perDay);
  const days = Math.max(1, fromRecord, fromStints);
  const due = dueAt ? parseDue(dueAt) : null;
  const startBy = due !== null && Number.isFinite(due) ? addDays(startOfDay(due), -(days + 1)) : null;
  const lateShare = p.lateNightShare ?? 0;
  const lateNightRisk = due !== null && lateShare > LATE_SHARE_LIMIT;

  const notes: string[] = [];
  notes.push(`Active minutes: ${numText(w)} words ÷ your pace of ${oneDecimal(q.median)} words an active minute, the middle of your ${p.counted} essays; the range uses your slower and faster quarters (${oneDecimal(q.p25)} and ${oneDecimal(q.p75)}).`);
  notes.push(`Stints: those minutes ÷ your median stint of ${Math.round(stintLen)} min, rounded up.`);
  if (fromStints >= fromRecord) notes.push(`Calendar days: you usually fit ${perDay} stint${perDay === 1 ? '' : 's'} into a day, so ${stints.mid} stint${stints.mid === 1 ? '' : 's'} need${stints.mid === 1 ? 's' : ''} ${days} day${days === 1 ? '' : 's'}.`);
  else notes.push(`Calendar days: your essays took about ${oneDecimal(p.calendarDaysPer1000Words!.median)} days per 1,000 words from first session to last, so ${days} day${days === 1 ? '' : 's'}.`);
  if (startBy !== null) {
    notes.push(`Start by: the due date minus ${days} calendar day${days === 1 ? '' : 's'} and one day of slack.`);
    if (startBy < startOfDay(now)) notes.push(`Start by: that date has passed, so the plan starts today.`);
  }
  if (lateNightRisk) notes.push(`Late night: ${Math.round(lateShare * 100)}% of your past work fell between 11pm and 5am. Starting by the date above leaves room to finish earlier in the evening if you want to.`);
  if ((p.pasteShare ?? 0) > 0.2) notes.push(`Pasted text: about ${Math.round(p.pasteShare! * 100)}% of your past text was pasted in, and the forecast assumes the same mix.`);

  return { words: w, dueAt, now, activeMinutes, stints, calendarDays: { mid: days }, startBy: startBy === null ? null : iso(startBy), lateNightRisk, notes };
}

// ---- schedule --------------------------------------------------------------------------------

function atHour(dayStart: number, hour: number): number {
  const d = new Date(dayStart);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

/**
 * Suggested sessions shaped like the record: forecast.stints.mid sittings of about the median stint,
 * spread evenly over forecast.calendarDays.mid consecutive days (from the start-by day, or today, or
 * tomorrow once today's window has passed), placed in the student's best windows with their median
 * break between sittings. Late-night windows (11pm to 5am) are used freely when the student's
 * late-night share is 30% or more; below that, at most one session may fall late, and only when the
 * record has no other window, with the rest in the 7pm to 9pm fallback. When the due date leaves fewer
 * days than wanted the sessions are packed into the days left; every session is always placed.
 */
export function scheduleLike(p: PaceProfile, f: Forecast, opts: { now?: number; dueAt?: string | null } = {}): PlannedSession[] {
  const now = opts.now ?? f.now;
  const dueAt = opts.dueAt === undefined ? f.dueAt : opts.dueAt;
  const n = f.stints.mid;
  const minutesEach = Math.max(5, Math.round(f.activeMinutes.mid / n / 5) * 5);
  const gap = Math.max(5, Math.round(p.gapBetweenStints?.medianMinutes ?? 15));
  const allowLate = (p.lateNightShare ?? 0) >= LATE_SHARE_LIMIT;
  const fallback: PaceWindow = { start: FALLBACK_WINDOW_START, hours: 2, minutes: 0, wordsPerMinute: 0, late: false };
  let windows: PaceWindow[];
  let lateBudget: number;
  if (allowLate) {
    windows = p.bestWindows.length ? p.bestWindows : [fallback];
    lateBudget = Infinity;
  } else {
    const nonLate = p.bestWindows.filter((w) => !w.late);
    if (nonLate.length) {
      windows = nonLate;
      lateBudget = 0;
    } else if (p.bestWindows.length) {
      windows = [p.bestWindows[0], fallback];
      lateBudget = 1;
    } else {
      windows = [fallback];
      lateBudget = 0;
    }
  }

  const today = startOfDay(now);
  let firstDay = today;
  if (f.startBy) firstDay = Math.max(today, startOfDay(parseIso(f.startBy)));
  if (firstDay === today && atHour(today, windows[0].start) < now + HOUR) firstDay = addDays(today, 1);
  let days = f.calendarDays.mid;
  const due = dueAt ? parseDue(dueAt) : null;
  if (due !== null && Number.isFinite(due)) {
    const left = Math.round((startOfDay(due) - firstDay) / DAY) + 1;
    days = Math.max(1, Math.min(days, left));
  }

  const step = (minutesEach + gap) * MINUTE;
  const out: PlannedSession[] = [];
  let remaining = n;
  for (let d = 0; remaining > 0 && d < 366; d++) {
    const dayStart = addDays(firstDay, d);
    const want = Math.ceil(remaining / Math.max(1, days - d));
    let placed = 0;
    for (const w of windows) {
      if (placed >= want) break;
      const ws = atHour(dayStart, w.start);
      const we = ws + w.hours * HOUR;
      for (let t = ws; placed < want && (t === ws || t + minutesEach * MINUTE <= we); t += step) {
        if (t < now + HOUR) continue; // never suggest a sitting that has already passed
        const late = LATE_HOURS.has(new Date(t).getHours());
        if (late && lateBudget <= 0) continue;
        if (late) lateBudget -= 1;
        out.push({ start: iso(t), minutes: minutesEach, words: 0, window: windowText(w), late });
        placed += 1;
      }
    }
    remaining -= placed;
  }
  out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

  const totalMinutes = sum(out.map((s) => s.minutes));
  let given = 0;
  out.forEach((s, i) => {
    s.words = i === out.length - 1 ? f.words - given : Math.round((f.words * s.minutes) / totalMinutes);
    given += s.words;
  });
  return out;
}

// ---- words -----------------------------------------------------------------------------------

const nf = new Intl.NumberFormat('en-US');
export const numText = (n: number): string => nf.format(Math.round(n));
const oneDecimal = (x: number): string => (Math.round(x * 10) / 10).toString();

/** "3 h 20 min", "45 min", "under a minute". */
export function minutesText(min: number | null | undefined): string {
  if (min === null || min === undefined || !Number.isFinite(min)) return '—';
  const m = Math.round(min);
  if (m < 1) return min > 0 ? 'under a minute' : '0 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** "9pm to 11pm". */
export function windowText(w: PaceWindow): string {
  return `${hourText(w.start)} to ${hourText((w.start + w.hours) % 24)}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "today", "tomorrow", "Tuesday" (within the week), else "Tuesday 21 October". */
export function dayText(ms: number, now = Date.now()): string {
  const diff = Math.round((startOfDay(ms) - startOfDay(now)) / DAY);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  const d = new Date(ms);
  if (diff > 1 && diff <= 6) return WEEKDAYS[weekday(ms)];
  return `${WEEKDAYS[weekday(ms)]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** The one-paragraph plain-English version of a forecast; the Copy button copies exactly this. */
export function paceText(p: PaceProfile, f: Forecast | null): string {
  if (!f) {
    const left = Math.max(0, MIN_ESSAYS - p.counted);
    return `Record ${left === MIN_ESSAYS ? 'four' : `${left} more`} essay${left === 1 ? '' : 's'} of at least ${MIN_WORDS} words and Trail can forecast your pace. Nothing is sent anywhere.`;
  }
  const n = f.stints.mid;
  const range = Math.round(f.activeMinutes.low) === Math.round(f.activeMinutes.high) ? '' : ` (between ${minutesText(f.activeMinutes.low)} and ${minutesText(f.activeMinutes.high)} on your faster and slower days)`;
  const win = p.bestWindows[0] ? `, usually ${windowText(p.bestWindows[0])}` : '';
  const head = `${numText(f.words)} words will take you about ${minutesText(f.activeMinutes.mid)} of active writing${range} across ${n} stint${n === 1 ? '' : 's'}${win}`;
  const days = f.calendarDays.mid;
  if (f.startBy === null) return `${head}, spread over about ${days} day${days === 1 ? '' : 's'}.`;
  const startBy = parseIso(f.startBy);
  const today = startOfDay(f.now);
  if (startBy >= today) {
    const why = f.lateNightRisk ? 'without a late night' : 'with a day to spare';
    return `${head}; to finish ${why}, start by ${dayText(startBy, f.now)}.`;
  }
  const due = parseDue(f.dueAt!);
  const left = Math.max(0, Math.round((startOfDay(due) - today) / DAY)) + 1;
  if (left <= 1) return `${head}; it is due today, so this is a one-day plan.`;
  return `${head}; the start date that would leave a day of slack (${dayText(startBy, f.now)}) has passed, so starting today means ${n} stint${n === 1 ? '' : 's'} in ${left} days.`;
}
