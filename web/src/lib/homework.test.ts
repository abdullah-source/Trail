import { describe, expect, it } from 'vitest';
import type { SessionSummary, WorklogRow } from './types';
import {
  BREAK_MS,
  MINUTE,
  averageStintMs,
  bestHour,
  clipStints,
  dayKey,
  habits,
  lateNightShare,
  longestStretch,
  mergeStints,
  rangeBounds,
  recap,
  streakDays,
  summarize,
  summarizeRows,
  weekday,
} from './homework';

// Local-time helpers so the tests pass in any zone. 2026-10-05 is a Monday.
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m, 0, 0).getTime();
const iso = (ms: number) => new Date(ms).toISOString();
let seq = 0;
function row(p: Partial<WorklogRow> & { start: number; end: number; active?: number }): WorklogRow {
  const { start, end, active, ...rest } = p;
  return {
    id: `r${++seq}`,
    host: 'canvas.university.edu',
    editor: 'canvas',
    kind: 'assignment',
    course_key: 'bio',
    course_label: 'BIO 101',
    item_key: 'bio/lab3',
    item_label: 'Lab report 3',
    doc: null,
    start: iso(start),
    end: iso(end),
    active_ms: active ?? end - start,
    day: dayKey(start),
    heartbeats: 1,
    ...rest,
  };
}
function session(start: number, end: number, activeMin: number): SessionSummary {
  return { session: `s${++seq}`, start: iso(start), end: iso(end), editor: 'docs', host: 'docs.google.com', active_minutes: activeMin, typed_chars: 100, pasted_chars: 0, deleted_chars: 0, events: 10 };
}
const NOW = at(7, 15); // Wednesday 7 Oct 2026, 3pm

describe('merge rule (doc rows and writing sessions)', () => {
  it('takes the max of presence and session active time for overlapping windows, never the sum', () => {
    const rows = [row({ doc: 'D', kind: 'writing', course_key: 'engl', course_label: 'ENGL 101', item_key: 'engl/essay1', item_label: 'Essay 1', start: at(6, 20), end: at(6, 21), active: 50 * MINUTE })];
    const essays = [{ doc: 'D', title: 'Essay 1', editor: 'docs', sessions: [session(at(6, 20, 10), at(6, 20, 55), 38)] }];
    const stints = mergeStints(rows, essays);
    expect(stints).toHaveLength(1);
    expect(stints[0].active_ms).toBe(50 * MINUTE);
    expect(stints[0].source).toBe('both');
    // the session is the bigger one this time
    const stints2 = mergeStints([{ ...rows[0], active_ms: 20 * MINUTE }], essays);
    expect(stints2[0].active_ms).toBe(38 * MINUTE);
    // window spans both
    expect(stints2[0].start).toBe(at(6, 20));
    expect(stints2[0].end).toBe(at(6, 21));
  });

  it('keeps non-overlapping stints of the same doc separate and sums them', () => {
    const rows = [row({ doc: 'D', kind: 'writing', start: at(5, 19), end: at(5, 19, 30), active: 30 * MINUTE })];
    const essays = [{ doc: 'D', title: 'Essay', editor: 'docs', sessions: [session(at(6, 19), at(6, 19, 20), 20)] }];
    const stints = mergeStints(rows, essays);
    expect(stints).toHaveLength(2);
    expect(stints.reduce((s, x) => s + x.active_ms, 0)).toBe(50 * MINUTE);
    // the session-only stint inherits class and item from the nearest row for the doc
    const fromSession = stints.find((s) => s.source === 'session')!;
    expect(fromSession.course_label).toBe('BIO 101');
    expect(fromSession.item_label).toBe('Lab report 3');
  });

  it('chains overlaps into one cluster (row, session, row)', () => {
    const rows = [
      row({ doc: 'D', start: at(6, 20), end: at(6, 20, 30), active: 30 * MINUTE }),
      row({ doc: 'D', start: at(6, 20, 50), end: at(6, 21, 20), active: 30 * MINUTE }),
    ];
    const essays = [{ doc: 'D', title: 'E', editor: 'docs', sessions: [session(at(6, 20, 20), at(6, 21), 25)] }];
    const stints = mergeStints(rows, essays);
    expect(stints).toHaveLength(1);
    expect(stints[0].active_ms).toBe(60 * MINUTE); // max(60 presence, 25 session)
  });

  it('passes rows without a doc straight through and labels session-only docs with no rows', () => {
    const rows = [row({ start: at(6, 9), end: at(6, 9, 20) })];
    const essays = [{ doc: 'X', title: 'Reading response', editor: 'word', sessions: [session(at(6, 10), at(6, 10, 15), 12)] }];
    const stints = mergeStints(rows, essays);
    expect(stints).toHaveLength(2);
    const s = stints.find((x) => x.doc === 'X')!;
    expect(s.item_label).toBe('Reading response');
    expect(s.kind).toBe('writing');
    expect(s.course_label).toBe('Not in a class');
    expect(s.active_ms).toBe(12 * MINUTE);
  });

  it('never lets active time exceed the wall-clock span of a row', () => {
    const stints = mergeStints([row({ start: at(6, 9), end: at(6, 9, 10), active: 99 * MINUTE })]);
    expect(stints[0].active_ms).toBe(10 * MINUTE);
  });
});

describe('ranges and clipping', () => {
  it('this week starts on Monday and last week is the 7 days before', () => {
    const b = rangeBounds('week', NOW);
    expect(dayKey(b.since)).toBe('2026-10-05');
    expect(dayKey(b.until)).toBe('2026-10-12');
    expect(dayKey(b.prevSince)).toBe('2026-09-28');
    const lw = rangeBounds('last-week', NOW);
    expect(dayKey(lw.since)).toBe('2026-09-28');
    expect(dayKey(lw.until)).toBe('2026-10-05');
    const m = rangeBounds('30d', NOW);
    expect(dayKey(m.until)).toBe('2026-10-08');
    expect(dayKey(m.since)).toBe('2026-09-08');
    expect(weekday(b.since)).toBe(0);
  });

  it('clips a stint crossing the window edge and scales its active time', () => {
    const stints = mergeStints([row({ start: at(4, 23, 30), end: at(5, 0, 30), active: 60 * MINUTE })]);
    const b = rangeBounds('week', NOW);
    const clipped = clipStints(stints, b.since, b.until);
    expect(clipped).toHaveLength(1);
    expect(clipped[0].start).toBe(b.since);
    expect(clipped[0].active_ms).toBe(30 * MINUTE);
    expect(clipStints(stints, b.until, b.until + 1000)).toHaveLength(0);
  });
});

describe('aggregation', () => {
  const rows = [
    row({ start: at(5, 20), end: at(5, 21), active: 60 * MINUTE }), // Mon 8-9pm bio lab3
    row({ start: at(5, 21, 30), end: at(5, 22), active: 20 * MINUTE, item_key: 'bio/quiz4', item_label: 'Quiz 4', kind: 'quiz' }),
    row({ start: at(6, 23, 0), end: at(7, 0, 30), active: 90 * MINUTE, course_key: 'hist', course_label: 'HIST 210', item_key: 'hist/essay', item_label: 'Essay', kind: 'writing', doc: 'H' }), // Tue 11pm - Wed 0:30
    row({ start: at(7, 10), end: at(7, 10, 10), active: 10 * MINUTE, course_key: 'hist', course_label: 'HIST 210', item_key: 'hist/disc', item_label: 'Discussion', kind: 'discussion' }),
  ];
  const b = rangeBounds('week', NOW);
  const stints = clipStints(mergeStints(rows), b.since, b.until);
  const s = summarize(stints, b.since, b.until);

  it('totals, classes, items and days', () => {
    expect(s.total_ms).toBe(180 * MINUTE);
    expect(s.by_course.map((c) => [c.course_label, c.active_ms / MINUTE, c.items])).toEqual([
      ['HIST 210', 100, 2],
      ['BIO 101', 80, 2],
    ]);
    expect(s.by_item[0]).toMatchObject({ item_label: 'Essay', active_ms: 90 * MINUTE, stints: 1, doc: 'H', kind: 'writing', last: at(7, 0, 30) });
    expect(s.by_day).toHaveLength(7);
    expect(s.by_day.map((d) => d.active_ms / MINUTE)).toEqual([80, 60, 40, 0, 0, 0, 0]);
  });

  it('spreads active time over hours and the weekday grid', () => {
    expect(s.by_hour[20]).toBe(60 * MINUTE);
    expect(s.by_hour[21]).toBe(20 * MINUTE);
    expect(s.by_hour[23]).toBe(60 * MINUTE);
    expect(s.by_hour[0]).toBe(30 * MINUTE);
    expect(s.heat[1][23]).toBe(60 * MINUTE); // Tuesday 11pm
    expect(s.heat[2][0]).toBe(30 * MINUTE); // Wednesday midnight
    expect(s.by_hour.reduce((a, x) => a + x, 0)).toBe(180 * MINUTE);
  });

  it('late-night share, best hour, average', () => {
    expect(lateNightShare(s.by_hour)).toBeCloseTo(90 / 180);
    expect(bestHour(s.by_hour)).toBe(20);
    expect(lateNightShare(new Array(24).fill(0))).toBeNull();
    expect(bestHour(new Array(24).fill(0))).toBeNull();
    expect(averageStintMs(stints)).toBe(45 * MINUTE);
    expect(averageStintMs([])).toBeNull();
  });

  it('summarizeRows matches the bridge summary shape', () => {
    const r = summarizeRows(rows, b.since, b.until);
    expect(r.total_ms).toBe(180 * MINUTE);
    expect(r.by_item[0].last).toBe(iso(at(7, 0, 30)));
    expect(r.by_course[0]).toEqual({ course_key: 'hist', course_label: 'HIST 210', active_ms: 100 * MINUTE, items: 2 });
  });
});

describe('streak', () => {
  it('counts consecutive worked days back from today, forgiving a quiet today', () => {
    const rows = [
      row({ start: at(4, 18), end: at(4, 18, 20) }), // Sun 20 min
      row({ start: at(5, 18), end: at(5, 18, 30) }), // Mon 30 min
      row({ start: at(6, 18), end: at(6, 18, 16) }), // Tue 16 min
    ];
    const stints = mergeStints(rows);
    expect(streakDays(stints, NOW)).toBe(3); // Wed has nothing yet: not broken
    expect(streakDays([...stints, ...mergeStints([row({ start: at(7, 9), end: at(7, 9, 20) })])], NOW)).toBe(4);
    // a 10-minute day breaks it
    expect(streakDays(mergeStints([row({ start: at(6, 18), end: at(6, 18, 10) }), row({ start: at(5, 18), end: at(5, 19) })]), NOW)).toBe(0);
    expect(streakDays([], NOW)).toBe(0);
  });
});

describe('longest stretch', () => {
  it('joins stints separated by at most a 10-minute break, across classes', () => {
    const stints = mergeStints([
      row({ start: at(8, 19), end: at(8, 19, 40) }),
      row({ start: at(8, 19, 48), end: at(8, 20, 34), course_key: 'hist', course_label: 'HIST 210', item_key: 'h' }), // 8 min gap: joins → 94 min
      row({ start: at(8, 21), end: at(8, 21, 30) }), // 26 min gap: new stretch
    ]);
    const st = longestStretch(stints)!;
    expect(st.ms).toBe(94 * MINUTE);
    expect(st.stints).toBe(2);
    expect(weekday(st.start)).toBe(3); // Thursday
    expect(longestStretch(stints, 5 * MINUTE)!.ms).toBe(46 * MINUTE);
    expect(longestStretch([])).toBeNull();
    expect(BREAK_MS).toBe(10 * MINUTE);
  });
});

describe('habits and recap', () => {
  const rows = [
    row({ start: at(6, 23, 0), end: at(7, 0, 30), active: 90 * MINUTE, course_key: 'hist', course_label: 'HIST 210', item_key: 'hist/essay', item_label: 'Essay', kind: 'writing', doc: 'H' }), // Tue late
    row({ start: at(5, 20), end: at(5, 20, 30) }),
    row({ start: at(7, 9), end: at(7, 9, 20) }),
  ];
  const b = rangeBounds('week', NOW);
  const stints = clipStints(mergeStints(rows), b.since, b.until);
  const s = summarize(stints, b.since, b.until);

  it('produces three plain cards, each naming its rule', () => {
    const h = habits(s, stints, b, NOW);
    expect(h).toHaveLength(3);
    expect(h[0]).toMatchObject({ rule: 'late-night-day', text: 'Most of your Tuesday work happened after 11pm.' });
    expect(h[1]).toMatchObject({ rule: 'longest-stretch', text: 'Your longest unbroken stretch was 1h 30m on Tuesday.' });
    expect(h[2]).toMatchObject({ rule: 'days-worked', text: 'You worked 3 of the 3 days so far this week.' });
    for (const x of h) expect(x.how).toMatch(/^Rule: /);
    expect(habits(summarize([], b.since, b.until), [], b, NOW)).toEqual([]);
  });

  it('writes a deterministic recap from the numbers', () => {
    const text = recap({ summary: s, prevTotal: 100 * MINUTE, bounds: b, streak: 3, average: averageStintMs(stints), lateShare: lateNightShare(s.by_hour), stretch: longestStretch(stints), now: NOW });
    expect(text).toBe(
      'This week you spent 2h 20m actively working on school sites, 40 min more than last week. Most of it went to HIST 210 (1h 30m across 1 item). You worked 3 of 3 days and your current streak is 3 days. The typical stint was 47 min, and 64% of your time fell after 11pm. Your longest unbroken stretch was 1h 30m on Tuesday.',
    );
    expect(recap({ summary: summarize([], b.since, b.until), prevTotal: 0, bounds: b, streak: 0, average: null, lateShare: null, stretch: null, now: NOW })).toBe('This week no active time on school sites was recorded on this computer.');
    const lw = recap({ summary: s, prevTotal: 0, bounds: rangeBounds('last-week', NOW), streak: 0, average: null, lateShare: null, stretch: null, now: NOW });
    expect(lw.startsWith('Last week you spent 2h 20m actively working on school sites; nothing was recorded the week before.')).toBe(true);
  });
});
