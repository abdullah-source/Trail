// Small formatting helpers. Everything numeric renders with tabular numerals (class "tabular").

const nf = new Intl.NumberFormat('en-US');

export const num = (n: number | null | undefined, digits = 0): string =>
  n === null || n === undefined || Number.isNaN(n) ? '—' : digits ? n.toFixed(digits) : nf.format(Math.round(n));

export const pct = (x: number | null | undefined, digits = 0): string =>
  x === null || x === undefined ? '—' : `${(x * 100).toFixed(digits)}%`;

export function parseTs(ts: string): Date {
  // Python emits microseconds; Date accepts up to millis, so trim.
  return new Date(ts.replace(/(\.\d{3})\d+Z$/, '$1Z'));
}

export const fmtDate = (ts: string | null | undefined): string =>
  ts ? parseTs(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

export const fmtDateLong = (ts: string | null | undefined): string =>
  ts ? parseTs(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

export const fmtTime = (ts: string | null | undefined): string =>
  ts ? parseTs(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—';

export const fmtDateTime = (ts: string | null | undefined): string => (ts ? `${fmtDate(ts)}, ${fmtTime(ts)}` : '—');

export function fmtMinutes(min: number | null | undefined): string {
  if (min === null || min === undefined) return '—';
  if (min < 1) return `${Math.round(min * 60)}s`;
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fmtGap(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s later`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min later`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return rm ? `${h}h ${rm}m later` : `${h}h later`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} later`;
}

export function relative(ts: string | null | undefined, now = Date.now()): string {
  if (!ts) return '—';
  const diff = now - parseTs(ts).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 14) return `${d} day${d === 1 ? '' : 's'} ago`;
  return fmtDate(ts);
}

export const hourLabel = (h: number): string => {
  const x = h % 12 === 0 ? 12 : h % 12;
  return `${x}${h < 12 ? 'am' : 'pm'}`;
};

export const daysUntil = (ts: string | null | undefined, now = Date.now()): number | null =>
  ts ? Math.max(0, Math.ceil((parseTs(ts).getTime() - now) / 86400000)) : null;

export const editorName = (e: string | null | undefined): string =>
  ({ docs: 'Google Docs', notion: 'Notion', word: 'Word Online', generic: 'LMS editor', canvas: 'Canvas', moodle: 'Moodle' } as Record<string, string>)[e || ''] || e || 'Editor';

export const sourceKindLabel = (k: string): string =>
  ({ ai: 'AI assistant', self: 'this document', web: 'web page', search: 'search', unknown: 'unknown', internal: 'this document' } as Record<string, string>)[k] || k;
