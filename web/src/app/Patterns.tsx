// Patterns: four stats with expanded numerals across the top, then a note per chart
// (DESIGN-document.md §9, "Time / Patterns"). Bars are typed green on 6 px pill tracks; the busiest
// hour is set in ink, not in a provenance colour, because it says nothing about where text came from.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { analyse, patterns } from '../lib/analysis';
import { sessionMinutesByLocalHour } from '../lib/pace';
import { data } from '../lib/data';
import type { Analysis } from '../lib/types';
import { useAsync, usePageTitle } from '../components/useAsync';
import { Caption, EmptyState, ErrorNote, Info, Loading, Note, ProgressBar, ScrollArea, SectionHead, StatGrid, StatTile, TABLE, TD, TH, cx } from '../components/ui';
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
        icon="search"
        body={
          <p>
            Patterns appear after your first essay.{' '}
            <Link to="/app/welcome" className="link">
              Write a paragraph to start.
            </Link>
          </p>
        }
      />
    );
  const p = patterns(analyses);
  const sessionMinutes = analyses.flatMap((a) => a.sessions.map((s) => s.active_minutes)).sort((x, y) => x - y);
  // Everything drawn on this page is in the student's local time. patterns() keeps UTC hours only for
  // parity with the Python reference, so its best_hours / active_minutes_by_hour are not used here; the
  // chart spreads each session's active minutes over the local hours it spans, the same rule as Time.
  const localHours = sessionMinutesByLocalHour(analyses.flatMap((a) => a.sessions));

  return (
    <section className="grid gap-10 min-w-0" aria-labelledby="patterns-title">
      <SectionHead
        as="h1"
        kicker="Across every essay"
        index="Nº 03"
        title={<span id="patterns-title">Patterns</span>}
        lede={
          <>
            How you write, across everything: {p.documents} essay{p.documents === 1 ? '' : 's'}, {p.sessions} session{p.sessions === 1 ? '' : 's'}, {num(p.total_words)} words. Computed on this computer from your own record.
          </>
        }
      />

      <StatGrid min={150} compact>
        <StatTile label="Typical session" value={fmtMinutes(p.median_session_minutes)} detail="median active time" info="The middle value of your sessions' active minutes, across every essay. Active means at least one keystroke every two minutes." />
        <StatTile label="Pace" value={p.words_per_minute ? num(p.words_per_minute) : '—'} detail="words a minute while active" info="Words added divided by active minutes, across every essay." />
        <StatTile label="Typed share" value={pct(p.typed_share)} detail="of your final text is typed" tone="typed" bar={p.typed_share ?? undefined} info="Characters typed one at a time that survive in the final text, divided by the final length, summed over every essay." />
        <StatTile label="Revision" value={pct(p.correction_ratio)} detail="of typed characters later deleted" info="Characters you typed and later removed, divided by all characters typed. Higher means more rewriting." />
      </StatGrid>

      <div className="grid lg:grid-cols-2 gap-x-10 gap-y-12 items-start">
        <Note as="section" label={<Legend info="Active minutes by hour of the day in your local time, summed over every session.">When you write</Legend>}>
          <Caption>Active minutes by hour of the day, your local time, summed over every session; a session that crosses the hour is split between both. The tallest bar is marked.</Caption>
          <HourChart hours={localHours} />
        </Note>

        <Note as="section" label={<Legend info="Sessions grouped by their active minutes.">Session length</Legend>}>
          <Caption>How many sessions fell into each length band, by active minutes.</Caption>
          <Histogram values={sessionMinutes} />
        </Note>

        <Note as="section" label={<Legend info="Revised is typed characters later deleted over all typed characters; Typed is the typed share of the final text.">Revision habits</Legend>} className="lg:col-span-2">
          <Caption>Per essay: how much typed text was later deleted, and how much of the final text was typed.</Caption>
          <ScrollArea label="Revision per essay" maxHeight={440}>
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Essay</th>
                  <th className={cx(TH, 'text-right')}>Revised</th>
                  <th className={cx(TH, 'text-right')}>Typed</th>
                  <th className={cx(TH, 'hide-phone w-[30%]')}>
                    <span className="sr-only">Typed share bar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {analyses.map((a, i) => (
                  <tr key={a.document.doc || i} className="border-t border-rule first:border-t-0">
                    <td className={cx(TD, 'max-w-[8.5rem] sm:max-w-[24rem] overflow-hidden text-ellipsis font-sans text-sm')} title={all.value.titles[i]}>
                      {all.value.titles[i]}
                    </td>
                    <td className={cx(TD, 'text-right text-ink-soft')}>{pct(a.cadence.correction_ratio)}</td>
                    <td className={cx(TD, 'text-right text-typed')}>{pct(a.document.typed_share)}</td>
                    <td className={cx(TD, 'hide-phone')}>
                      <ProgressBar value={a.document.typed_share ?? 0} tone="typed" className="w-full" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </Note>
      </div>
    </section>
  );
}

function Legend({ children, info }: { children: ReactNode; info: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      {children} <Info text={info} />
    </span>
  );
}

function HourChart({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours);
  const W = 480,
    H = 96,
    pad = 4;
  const bw = (W - pad * 2) / 24;
  const best = hours.indexOf(max);
  return (
    <figure className="grid gap-2 m-0">
      <svg viewBox={`0 0 ${W} ${H + 2}`} className="w-full h-auto block" role="img" aria-label={`Active minutes by hour. Most writing around ${hourLabel(best)}.`}>
        {[0.5, 1].map((f) => (
          <line key={f} x1={pad} x2={W - pad} y1={H - f * H + 0.5} y2={H - f * H + 0.5} stroke="var(--rule)" strokeDasharray="2 4" />
        ))}
        {hours.map((v, h) => {
          const bh = Math.max(v ? 2 : 0, Math.round((v / max) * H));
          return <rect key={h} x={pad + h * bw + 2} y={H - bh} width={bw - 4} height={bh} rx={1.5} fill={h === best ? 'var(--ink)' : 'var(--typed)'} opacity={v ? 1 : 0} />;
        })}
        {hours.map((v, h) => (v ? null : <rect key={`z${h}`} x={pad + h * bw + 2} y={H - 2} width={bw - 4} height={2} rx={1} fill="var(--well)" />))}
        <line x1={pad} y1={H + 0.5} x2={W - pad} y2={H + 0.5} stroke="var(--rule-strong)" />
      </svg>
      {/* axis labels in HTML so they stay 11 px however narrow the chart gets */}
      <div className="relative h-4 font-mono text-[11px] text-ink-soft" aria-hidden>
        {[0, 6, 12, 18].map((h) => (
          <span key={h} className="absolute top-0" style={{ left: `${((pad + h * bw + 2) / W) * 100}%` }}>
            {hourLabel(h)}
          </span>
        ))}
      </div>
      <figcaption className="font-mono text-xs text-ink-soft">
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
    <ul className="grid gap-3 font-mono text-xs tabular list-none m-0 p-0" aria-label="Session length distribution">
      {labels.map((l, i) => (
        <li key={l} className="grid grid-cols-[4rem_minmax(0,1fr)_2rem] items-center gap-3">
          <span className="text-ink-soft">{l}</span>
          <ProgressBar value={counts[i] / max} tone="typed" label={`${l}: ${counts[i]} session${counts[i] === 1 ? '' : 's'}`} />
          <span className="text-right">{counts[i]}</span>
        </li>
      ))}
    </ul>
  );
}
