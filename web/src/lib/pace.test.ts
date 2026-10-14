import { describe, expect, it } from 'vitest';
import type { SessionSummary, WorklogRow } from './types';
import { LATE_HOURS, MINUTE, dayKey, mergeStints, parseIso, startOfDay } from './homework';
import {
  FALLBACK_WINDOW_START,
  MIN_ESSAYS,
  bestWindows,
  dayText,
  forecast,
  minutesText,
  paceText,
  parseDue,
  profile,
  quantile,
  scheduleLike,
  sessionMinutesByLocalHour,
  spreadHours,
  type PaceEssay,
  type PaceProfile,
} from './pace';

// Local-time helpers so the tests pass in any zone. October 2026: the 5th is a Monday, the 14th a Wednesday.
const at = (day: number, h = 0, m = 0) => new Date(2026, 9, day, h, m, 0, 0).getTime();
const iso = (ms: number) => new Date(ms).toISOString();
const NOW = at(14, 15); // Wednesday 14 Oct 2026, 3pm

let seq = 0;
function session(start: number, end: number, activeMin: number, typed = Math.round(activeMin * 50)): SessionSummary {
  return { session: `s${++seq}`, start: iso(start), end: iso(end), editor: 'docs', host: 'docs.google.com', active_minutes: activeMin, typed_chars: typed, pasted_chars: 0, deleted_chars: Math.round(typed / 10), events: 10 };
}
function essay(doc: string, words: number, sessions: SessionSummary[], extra: Partial<PaceEssay> = {}): PaceEssay {
  const typed = sessions.reduce((s, x) => s + x.typed_chars, 0);
  return { doc, title: doc, words, typed_chars: typed, pasted_chars: 0, deleted_chars: Math.round(typed / 10), sessions, ...extra };
}
function row(start: number, end: number, p: Partial<WorklogRow> = {}): WorklogRow {
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
    active_ms: end - start,
    day: dayKey(start),
    heartbeats: 1,
    ...p,
  };
}

// Six essays (five that count), eleven writing sessions, ten school-site stints: 21 stints after merging.
// Paces by essay: 8, 10, 12, 14, 16 final words per active minute, so the quartiles are 10 / 12 / 14.
const ESSAYS: PaceEssay[] = [
  essay('A', 1200, [session(at(1, 21), at(1, 22, 15), 75), session(at(2, 21), at(2, 22, 15), 75)]), // 8 wpm
  essay('B', 1200, [session(at(3, 21), at(3, 22), 60), session(at(4, 21), at(4, 22), 60)]), // 10 wpm
  essay('C', 1200, [session(at(5, 21), at(5, 21, 50), 50), session(at(6, 21), at(6, 21, 50), 50)]), // 12 wpm
  essay('D', 1400, [session(at(7, 20), at(7, 20, 50), 50), session(at(8, 20), at(8, 20, 50), 50)]), // 14 wpm
  essay('E', 1600, [session(at(9, 22), at(9, 22, 50), 50), session(at(10, 22), at(10, 22, 50), 50)]), // 16 wpm
  essay('short', 80, [session(at(11, 17), at(11, 17, 10), 10)]), // too short to count
];
const ROWS: WorklogRow[] = [
  row(at(1, 16), at(1, 16, 30)),
  row(at(1, 22, 30), at(1, 23)), // 15 minutes after essay A's session ends
  row(at(2, 23), at(3, 0)), // late night, one hour
  row(at(3, 19, 30), at(3, 20, 40)), // 20 minutes before essay B's session
  row(at(5, 18), at(5, 18, 30)), // 2h30 before essay C's session
  row(at(6, 10), at(6, 10, 45)),
  row(at(8, 15), at(8, 15, 20)),
  row(at(9, 9), at(9, 9, 40)),
  row(at(12, 20), at(12, 21)),
  row(at(13, 14), at(13, 14, 30)),
];
const STINTS = mergeStints(ROWS, ESSAYS.map((e) => ({ doc: e.doc, title: e.title, editor: 'docs', sessions: e.sessions })));

describe('maths', () => {
  it('quantile interpolates linearly', () => {
    expect(quantile([8, 10, 12, 14, 16], 0.5)).toBe(12);
    expect(quantile([8, 10, 12, 14, 16], 0.25)).toBe(10);
    expect(quantile([8, 10, 12, 14, 16], 0.75)).toBe(14);
    expect(quantile([1, 2], 0.5)).toBe(1.5);
    expect(quantile([7], 0.9)).toBe(7);
  });

  it('spreads a quantity over the local hours a span covers, by wall time', () => {
    const parts: Record<number, number> = {};
    spreadHours(at(1, 21, 30), at(1, 22, 30), 60, (h, part) => (parts[h] = (parts[h] || 0) + part));
    expect(parts[21]).toBeCloseTo(30);
    expect(parts[22]).toBeCloseTo(30);
    const hist = sessionMinutesByLocalHour([session(at(1, 21, 30), at(1, 22, 30), 60), session(at(2, 21), at(2, 22), 60)]);
    expect(hist[21]).toBeCloseTo(90);
    expect(hist[22]).toBeCloseTo(30);
    expect(hist.reduce((a, b) => a + b, 0)).toBeCloseTo(120);
  });
});

describe('profile', () => {
  const p = profile(ESSAYS, STINTS, NOW);

  it('has the fixture size it claims', () => {
    expect(ESSAYS.length).toBeGreaterThanOrEqual(5);
    expect(STINTS.length).toBeGreaterThanOrEqual(20);
    expect(STINTS).toHaveLength(21);
  });

  it('counts essays with enough words and minutes, and is enough at four', () => {
    expect(p.essays).toBe(6);
    expect(p.counted).toBe(5);
    expect(p.enough).toBe(true);
    const few = profile(ESSAYS.slice(0, 3), [], NOW);
    expect(few.counted).toBe(3);
    expect(few.enough).toBe(false);
    expect(few.wordsPerActiveMinute).not.toBeNull();
    const none = profile([], [], NOW);
    expect(none.enough).toBe(false);
    expect(none.wordsPerActiveMinute).toBeNull();
    expect(none.stint).toBeNull();
    expect(none.byHour).toHaveLength(24);
  });

  it('takes words per active minute quartiles across counted essays', () => {
    expect(p.wordsPerActiveMinute).toEqual({ median: 12, p25: 10, p75: 14 });
  });

  it('buckets writing minutes and words by local hour, with a pace only where there is enough writing', () => {
    // essay A's sessions run 9pm to 10:15pm: 60 of 75 minutes fall in the 9pm hour, 15 in the 10pm hour
    const minutes21 = 60 * 2 + 60 * 2 + 50 * 2;
    expect(p.byHour[21].activeMinutes).toBeCloseTo(minutes21);
    expect(p.byHour[22].activeMinutes).toBeCloseTo(15 * 2 + 50 * 2);
    expect(p.byHour[20].activeMinutes).toBeCloseTo(100);
    expect(p.byHour[21].wordsPerMinute).toBeCloseTo(10); // typed chars are 50 a minute: 10 "words"
    expect(p.byHour[3].activeMinutes).toBe(0);
    expect(p.byHour[3].wordsPerMinute).toBeNull();
    const tiny = profile([essay('T', 200, [session(at(1, 9), at(1, 9, 5), 5, 1000)])], [], NOW);
    expect(tiny.byHour[9].activeMinutes).toBe(5);
    expect(tiny.byHour[9].wordsPerMinute).toBeNull(); // under 10 minutes: no pace for that hour
  });

  it('finds the best windows: top contiguous hours by pace with enough minutes, widened when neighbours keep up', () => {
    const minutes = new Array(24).fill(0);
    const words = new Array(24).fill(0);
    minutes[21] = 60;
    words[21] = 600; // 10 wpm
    minutes[22] = 60;
    words[22] = 540; // 9 wpm
    minutes[20] = 40;
    words[20] = 200; // 5 wpm
    minutes[9] = 45;
    words[9] = 360; // 8 wpm, an unrelated morning
    minutes[2] = 5; // too thin to join anything
    words[2] = 100;
    const w = bestWindows(minutes, words);
    expect(w).toHaveLength(2);
    expect(w[0]).toMatchObject({ start: 21, hours: 2, minutes: 120, late: false });
    expect(w[0].wordsPerMinute).toBeCloseTo(9.5);
    expect(w[1]).toMatchObject({ start: 9, hours: 1, minutes: 45 });
    expect(bestWindows(new Array(24).fill(0), new Array(24).fill(0))).toEqual([]);
    // a window across midnight is marked late
    const m2 = new Array(24).fill(0);
    const w2 = new Array(24).fill(0);
    m2[23] = 40;
    w2[23] = 400;
    m2[0] = 40;
    w2[0] = 400;
    const late = bestWindows(m2, w2);
    expect(late[0]).toMatchObject({ start: 23, hours: 2, late: true });
    // the fixture writes at the same pace at 8, 9 and 10pm, so the widest run wins
    expect(p.bestWindows[0]).toMatchObject({ start: 20, hours: 3 });
    expect(p.bestWindows).toHaveLength(1); // the 5pm sliver is under 30 minutes
  });

  it('measures stints, breaks, stints per day and the late-night share from the merged stints', () => {
    // 21 stints: minutes 75,75,60,60,50,50,50,50,50,50,10 (sessions) and 30,30,60,70,30,45,20,40,60,30 (rows)
    expect(p.stint).not.toBeNull();
    expect(p.stint!.medianMinutes).toBe(50);
    expect(p.stint!.p25).toBe(30);
    expect(p.stint!.p75).toBe(60);
    // same-day breaks under six hours: 270 and 15 (day 1), 45 (day 2), 20 (day 3), 150 (day 5), 280 (day 8)
    expect(p.gapBetweenStints!.medianMinutes).toBe(97.5);
    // 13 worked days: six with one stint, seven with two
    expect(p.stintsPerWorkedDay!.median).toBe(2);
    const total = STINTS.reduce((s, x) => s + x.active_ms, 0);
    expect(p.lateNightShare).toBeCloseTo((60 * MINUTE) / total, 6);
  });

  it('reports sessions and calendar days per 1,000 words, revision and paste shares', () => {
    expect(p.sessionsPer1000Words).toBeCloseTo(2000 / 1200, 6);
    expect(p.calendarDaysPer1000Words!.median).toBeCloseTo(2000 / 1200, 6);
    expect(p.revisionShare).toBeCloseTo(0.1, 2);
    expect(p.pasteShare).toBe(0);
    const pasty = profile([essay('P', 500, [session(at(1, 9), at(1, 10), 60)], { pasted_chars: 3000, typed_chars: 1000 })], [], NOW);
    expect(pasty.pasteShare).toBeCloseTo(0.75);
  });

  it('falls back to the sessions when no stints are given', () => {
    const q = profile(ESSAYS, [], NOW);
    expect(q.stint!.medianMinutes).toBe(50);
    expect(q.gapBetweenStints).toBeNull();
    expect(q.lateNightShare).toBe(0);
  });
});

// A hand-written profile so the forecast arithmetic can be pinned exactly.
const BASE: PaceProfile = {
  essays: 5,
  counted: 5,
  wordsPerActiveMinute: { median: 12, p25: 10, p75: 14 },
  byHour: [],
  bestWindows: [{ start: 21, hours: 2, minutes: 300, wordsPerMinute: 11, late: false }],
  stint: { medianMinutes: 30, p25: 20, p75: 45 },
  gapBetweenStints: { medianMinutes: 15 },
  stintsPerWorkedDay: { median: 2 },
  sessionsPer1000Words: 3,
  calendarDaysPer1000Words: { median: 2 },
  revisionShare: 0.1,
  pasteShare: 0,
  lateNightShare: 0.1,
  enough: true,
};

describe('forecast', () => {
  it('turns words into minutes, stints, days and a start-by date by the stated rules', () => {
    const f = forecast(BASE, { words: 1500, dueAt: '2026-10-24', now: NOW })!;
    expect(f).not.toBeNull();
    expect(f.words).toBe(1500);
    expect(f.activeMinutes.mid).toBeCloseTo(125);
    expect(f.activeMinutes.low).toBeCloseTo(1500 / 14);
    expect(f.activeMinutes.high).toBeCloseTo(150);
    expect(f.stints).toEqual({ low: 4, mid: 5, high: 5 });
    expect(f.calendarDays.mid).toBe(3); // max(round(2 * 1.5) = 3, ceil(5 / 2) = 3)
    expect(parseIso(f.startBy!)).toBe(at(20)); // Saturday the 24th minus 3 days minus one of slack: Tuesday the 20th
    expect(f.lateNightRisk).toBe(false);
    expect(f.notes.some((n) => n.startsWith('Active minutes:'))).toBe(true);
    expect(f.notes.some((n) => n.startsWith('Stints:'))).toBe(true);
    expect(f.notes.some((n) => n.startsWith('Calendar days:'))).toBe(true);
    expect(f.notes.some((n) => n.startsWith('Start by:'))).toBe(true);
    expect(f.notes.some((n) => n.startsWith('Late night:'))).toBe(false);
  });

  it('uses the record for calendar days when it asks for more than the stints do', () => {
    const f = forecast({ ...BASE, calendarDaysPer1000Words: { median: 6 } }, { words: 1500, now: NOW })!;
    expect(f.calendarDays.mid).toBe(9);
    expect(f.startBy).toBeNull();
    expect(f.notes.find((n) => n.startsWith('Calendar days:'))).toContain('6 days per 1,000 words');
  });

  it('flags late-night risk only with a due date and a share over 30%', () => {
    const late = { ...BASE, lateNightShare: 0.45 };
    expect(forecast(late, { words: 800, dueAt: '2026-10-24', now: NOW })!.lateNightRisk).toBe(true);
    expect(forecast(late, { words: 800, now: NOW })!.lateNightRisk).toBe(false);
    expect(forecast(late, { words: 800, dueAt: '2026-10-24', now: NOW })!.notes.some((n) => n.startsWith('Late night: 45%'))).toBe(true);
  });

  it('says when the start-by date has passed, and mentions a heavy paste share', () => {
    const f = forecast({ ...BASE, pasteShare: 0.4 }, { words: 3000, dueAt: '2026-10-16', now: NOW })!;
    expect(parseIso(f.startBy!)).toBeLessThan(startOfDay(NOW));
    expect(f.notes.filter((n) => n.startsWith('Start by:'))).toHaveLength(2);
    expect(f.notes.some((n) => n.startsWith('Pasted text: about 40%'))).toBe(true);
  });

  it('returns null until the profile is enough', () => {
    expect(forecast({ ...BASE, enough: false }, { words: 1000, now: NOW })).toBeNull();
    expect(forecast({ ...BASE, wordsPerActiveMinute: null }, { words: 1000, now: NOW })).toBeNull();
  });

  it('parses a date-only due date as the end of that local day', () => {
    expect(parseDue('2026-10-24')).toBe(at(24, 23, 59));
    expect(parseDue(iso(at(24, 9)))).toBe(at(24, 9));
  });
});

describe('scheduleLike', () => {
  const f = forecast(BASE, { words: 1500, dueAt: '2026-10-24', now: NOW })!;

  it('places the forecast stints in the best window on consecutive days from the start-by day', () => {
    const s = scheduleLike(BASE, f);
    expect(s).toHaveLength(5);
    const starts = s.map((x) => parseIso(x.start));
    expect(starts[0]).toBe(at(20, 21));
    expect(starts[1]).toBe(at(20, 21, 40)); // 25 min stint + 15 min break
    expect(starts[2]).toBe(at(21, 21));
    expect(starts[3]).toBe(at(21, 21, 40));
    expect(starts[4]).toBe(at(22, 21));
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThan(starts[i - 1]);
    expect(s.every((x) => x.minutes === 25)).toBe(true);
    expect(s.every((x) => x.window === '9pm to 11pm')).toBe(true);
    expect(s.every((x) => [21, 22].includes(new Date(parseIso(x.start)).getHours()))).toBe(true);
    expect(s.every((x) => parseIso(x.start) + x.minutes * MINUTE <= parseDue('2026-10-24'))).toBe(true);
    expect(s.reduce((a, x) => a + x.words, 0)).toBe(1500);
    expect(s.every((x) => x.late === false)).toBe(true);
  });

  it('starts today when there is no due date and the window is still ahead, else tomorrow', () => {
    const open = forecast(BASE, { words: 1500, now: NOW })!;
    expect(parseIso(scheduleLike(BASE, open)[0].start)).toBe(at(14, 21));
    const lateNow = at(14, 20, 30);
    const open2 = forecast(BASE, { words: 1500, now: lateNow })!;
    expect(parseIso(scheduleLike(BASE, open2)[0].start)).toBe(at(15, 21));
  });

  it('packs the sessions into the days left when the due date is close', () => {
    const soon = forecast(BASE, { words: 1500, dueAt: '2026-10-15', now: NOW })!;
    const s = scheduleLike(BASE, soon);
    expect(s).toHaveLength(5);
    const days = new Set(s.map((x) => dayKey(parseIso(x.start))));
    expect(days.size).toBe(2);
    expect(s.every((x) => parseIso(x.start) + x.minutes * MINUTE <= parseDue('2026-10-15'))).toBe(true);
  });

  it('allows at most one late-night session when late nights are under 30% of the record', () => {
    const nightOwlWindowOnly: PaceProfile = { ...BASE, bestWindows: [{ start: 23, hours: 2, minutes: 200, wordsPerMinute: 12, late: true }], lateNightShare: 0.2 };
    const f2 = forecast(nightOwlWindowOnly, { words: 3000, now: NOW })!;
    const s = scheduleLike(nightOwlWindowOnly, f2);
    expect(s).toHaveLength(f2.stints.mid);
    expect(s.filter((x) => x.late)).toHaveLength(1);
    const rest = s.filter((x) => !x.late);
    expect(rest.every((x) => new Date(parseIso(x.start)).getHours() >= FALLBACK_WINDOW_START && !LATE_HOURS.has(new Date(parseIso(x.start)).getHours()))).toBe(true);
    // with a non-late window available, no session goes late at all
    const mixed: PaceProfile = { ...nightOwlWindowOnly, bestWindows: [...nightOwlWindowOnly.bestWindows, { start: 20, hours: 1, minutes: 60, wordsPerMinute: 8, late: false }] };
    expect(scheduleLike(mixed, forecast(mixed, { words: 3000, now: NOW })!).every((x) => !x.late)).toBe(true);
  });

  it('keeps late-night sessions when that is the student\'s own rhythm', () => {
    const owl: PaceProfile = { ...BASE, bestWindows: [{ start: 23, hours: 2, minutes: 400, wordsPerMinute: 12, late: true }], lateNightShare: 0.6 };
    const f3 = forecast(owl, { words: 3000, now: NOW })!;
    const s = scheduleLike(owl, f3);
    expect(s).toHaveLength(f3.stints.mid);
    expect(s.filter((x) => x.late).length).toBeGreaterThan(1);
  });

  it('uses the fallback window when the record has none', () => {
    const bare: PaceProfile = { ...BASE, bestWindows: [] };
    const s = scheduleLike(bare, forecast(bare, { words: 1000, now: NOW })!);
    expect(s.length).toBeGreaterThan(0);
    expect(new Date(parseIso(s[0].start)).getHours()).toBe(FALLBACK_WINDOW_START);
  });
});

describe('words', () => {
  it('formats minutes and days plainly', () => {
    expect(minutesText(200)).toBe('3 h 20 min');
    expect(minutesText(45)).toBe('45 min');
    expect(minutesText(120)).toBe('2 h');
    expect(minutesText(0.3)).toBe('under a minute');
    expect(dayText(at(14, 9), NOW)).toBe('today');
    expect(dayText(at(15), NOW)).toBe('tomorrow');
    expect(dayText(at(20), NOW)).toBe('Tuesday');
    expect(dayText(at(21), NOW)).toBe('Wednesday 21 October');
  });

  it('writes one plain paragraph that names the numbers and the start date', () => {
    const f = forecast(BASE, { words: 1500, dueAt: '2026-10-24', now: NOW })!;
    const t = paceText(BASE, f);
    expect(t).toBe('1,500 words will take you about 2 h 5 min of active writing (between 1 h 47 min and 2 h 30 min on your faster and slower days) across 5 stints, usually 9pm to 11pm; to finish with a day to spare, start by Tuesday.');
    const owl = { ...BASE, lateNightShare: 0.5 };
    expect(paceText(owl, forecast(owl, { words: 1500, dueAt: '2026-10-24', now: NOW })!)).toContain('to finish without a late night, start by Tuesday.');
    expect(paceText(BASE, forecast(BASE, { words: 1500, now: NOW })!)).toMatch(/across 5 stints, usually 9pm to 11pm, spread over about 3 days\.$/);
    expect(paceText(BASE, forecast(BASE, { words: 3000, dueAt: '2026-10-16', now: NOW })!)).toContain('has passed, so starting today means 9 stints in 3 days.');
    expect(paceText(BASE, forecast(BASE, { words: 600, dueAt: '2026-10-14', now: NOW })!)).toContain('it is due today, so this is a one-day plan.');
    expect(paceText({ ...BASE, counted: 2, enough: false }, null)).toBe(`Record ${MIN_ESSAYS - 2} more essays of at least 150 words and Trail can forecast your pace. Nothing is sent anywhere.`);
    expect(paceText({ ...BASE, counted: 0, enough: false }, null)).toContain('Record four essays');
    expect(t).not.toMatch(/should|must|!/);
  });
});
