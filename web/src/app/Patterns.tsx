import { Link } from 'react-router-dom';
import { analyse, patterns } from '../lib/analysis';
import { data } from '../lib/data';
import type { Analysis } from '../lib/types';
import { useAsync, usePageTitle } from '../components/useAsync';
import { EmptyState, ErrorNote, Loading, Marginal, SectionHead, StatTile } from '../components/ui';
import { fmtMinutes, hourLabel, num, pct } from '../components/format';

async function loadAll(): Promise<{ analyses: Analysis[]; titles: string[] }> {
  const essays = await data.essays();
  const analyses: Analysis[] = [];
  const titles: string[] = [];
  for (const e of essays) {
    try {
      const evs = await data.essayEvents(e.id);
      if (evs.length) {
        analyses.push(analyse(evs));
        titles.push(e.title || e.id);
      }
    } catch {
      /* skip an essay the extension could not read */
    }
  }
  return { analyses, titles };
}

export default function Patterns() {
  usePageTitle('Patterns');
  const all = useAsync(loadAll, []);
  if (all.status === 'loading') return <Loading label="Reading every essay" />;
  if (all.status === 'error') return <ErrorNote error={all.error} retry={all.reload} />;
  const { analyses } = all.value;
  if (!analyses.length)
    return (
      <EmptyState
        title="No patterns yet"
        body={
          <>
            Patterns appear after your first essay. <Link to="/app/welcome" className="link">Write a paragraph to start.</Link>
          </>
        }
      />
    );
  const p = patterns(analyses);
  const sessionMinutes = analyses.flatMap((a) => a.sessions.map((s) => s.active_minutes)).sort((x, y) => x - y);
  const localHours = localHourHistogram(analyses);

  return (
    <div className="grid gap-10">
      <SectionHead kicker="Your patterns" title="How you write, across everything." lede={`${p.documents} essay${p.documents === 1 ? '' : 's'}, ${p.sessions} session${p.sessions === 1 ? '' : 's'}, ${num(p.total_words)} words. Computed on this computer from your own record.`} />

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-6">
        <StatTile label="Typical session" value={fmtMinutes(p.median_session_minutes)} detail="median active time" info="The middle value of your sessions' active minutes, across every essay. Active means at least one keystroke every two minutes." />
        <StatTile label="Pace" value={p.words_per_minute ? num(p.words_per_minute) : '—'} detail="words a minute while active" info="Words added divided by active minutes, across every essay." />
        <StatTile label="Typed share" value={pct(p.typed_share)} detail="of your final text is typed" tone="typed" info="Characters typed one at a time that survive in the final text, divided by the final length, summed over every essay." />
        <StatTile label="Revision" value={pct(p.correction_ratio)} detail="of typed characters later deleted" info="Characters you typed and later removed, divided by all characters typed. Higher means more rewriting." />
      </section>

      <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
        <div className="grid gap-1 content-start">
          <Marginal>When you write</Marginal>
          <span className="text-xs text-ink-soft">Active minutes by hour of the day, your local time, summed over every session. The tallest bar is marked.</span>
        </div>
        <HourChart hours={localHours} />
      </section>

      <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
        <div className="grid gap-1 content-start">
          <Marginal>Session length</Marginal>
          <span className="text-xs text-ink-soft">How many sessions fell into each length band, by active minutes.</span>
        </div>
        <Histogram values={sessionMinutes} />
      </section>

      <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
        <div className="grid gap-1 content-start">
          <Marginal>Revision habits</Marginal>
          <span className="text-xs text-ink-soft">Per essay: how much typed text was later deleted, and how much of the final text was typed.</span>
        </div>
        <ul className="grid gap-2 text-sm max-w-2xl">
          {analyses.map((a, i) => (
            <li key={a.document.doc || i} className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-baseline border-b border-rule py-1.5 tabular">
              <span className="truncate">{all.value.titles[i]}</span>
              <span className="text-ink-soft">{pct(a.cadence.correction_ratio)} revised</span>
              <span className="text-typed">{pct(a.document.typed_share)} typed</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Active minutes per local hour (patterns() uses UTC hours for parity; the chart shows local time). */
function localHourHistogram(analyses: Analysis[]): number[] {
  const hours = new Array<number>(24).fill(0);
  for (const a of analyses)
    for (const s of a.sessions) {
      const d = new Date(s.start.replace(/(\.\d{3})\d+Z$/, '$1Z'));
      hours[d.getHours()] += s.active_minutes;
    }
  return hours;
}

function HourChart({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours);
  const W = 480,
    H = 120,
    pad = 4;
  const bw = (W - pad * 2) / 24;
  const best = hours.indexOf(max);
  return (
    <figure className="max-w-2xl">
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full h-auto" role="img" aria-label={`Active minutes by hour. Most writing around ${hourLabel(best)}.`}>
        {hours.map((v, h) => {
          const bh = (v / max) * H;
          return <rect key={h} x={pad + h * bw + 1} y={H - bh} width={bw - 2} height={bh} className={h === best ? 'fill-paste' : 'fill-typed'} opacity={v ? 0.9 : 0.15} />;
        })}
        {[0, 6, 12, 18].map((h) => (
          <text key={h} x={pad + h * bw + 2} y={H + 13} className="fill-ink-soft" fontSize="10" fontFamily="var(--font-mono)">
            {hourLabel(h)}
          </text>
        ))}
        <line x1={pad} y1={H + 0.5} x2={W - pad} y2={H + 0.5} className="stroke-rule" />
      </svg>
      <figcaption className="text-xs text-ink-soft mt-1">
        Most of your writing happens around <span className="text-ink">{hourLabel(best)}</span>.
      </figcaption>
    </figure>
  );
}

function Histogram({ values }: { values: number[] }) {
  const edges = [0, 5, 15, 30, 60, 120, Infinity];
  const labels = ['<5m', '5–15m', '15–30m', '30–60m', '1–2h', '2h+'];
  const counts = labels.map((_, i) => values.filter((v) => v >= edges[i] && v < edges[i + 1]).length);
  const max = Math.max(1, ...counts);
  return (
    <ul className="grid gap-1.5 max-w-2xl text-sm tabular" aria-label="Session length distribution">
      {labels.map((l, i) => (
        <li key={l} className="grid grid-cols-[4rem_1fr_2rem] items-center gap-3">
          <span className="font-mono text-xs text-ink-soft">{l}</span>
          <span className="h-3 bg-rule rounded-sm overflow-hidden">
            <span className="block h-full bg-typed" style={{ width: `${(counts[i] / max) * 100}%` }} />
          </span>
          <span className="text-ink-soft text-right">{counts[i]}</span>
        </li>
      ))}
    </ul>
  );
}
