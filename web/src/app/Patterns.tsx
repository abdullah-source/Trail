// Patterns is a control panel: a chrome-bodied window with four stat tiles across the top and a
// panel per chart (DESIGN-desktop.md §4). Colour (the typed-green bars) sits on a paper well.
import { Link } from 'react-router-dom';
import { analyse, patterns } from '../lib/analysis';
import { sessionMinutesByLocalHour } from '../lib/pace';
import { data } from '../lib/data';
import type { Analysis } from '../lib/types';
import { useAsync, usePageTitle } from '../components/useAsync';
import { Caption, EmptyState, ErrorNote, Loading, Panel, ProgressBar, ScrollArea, StatGrid, StatTile, Window, cx } from '../components/ui';
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

const TH = 'marginal font-normal text-left px-2 py-1.5 whitespace-nowrap';
const TD = 'px-2 py-1.5 whitespace-nowrap';

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
        icon="magnifier"
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
    <Window as="section" titleAs="h1" title="Patterns" icon="magnifier" right={`${p.documents} essay${p.documents === 1 ? '' : 's'}`} chrome open bodyClassName="grid gap-4">
      <Caption>
        How you write, across everything: {p.documents} essay{p.documents === 1 ? '' : 's'}, {p.sessions} session{p.sessions === 1 ? '' : 's'}, {num(p.total_words)} words. Computed on this computer from your own record.
      </Caption>

      <StatGrid>
        <StatTile label="Typical session" value={fmtMinutes(p.median_session_minutes)} detail="median active time" info="The middle value of your sessions' active minutes, across every essay. Active means at least one keystroke every two minutes." />
        <StatTile label="Pace" value={p.words_per_minute ? num(p.words_per_minute) : '—'} detail="words a minute while active" info="Words added divided by active minutes, across every essay." />
        <StatTile label="Typed share" value={pct(p.typed_share)} detail="of your final text is typed" tone="typed" info="Characters typed one at a time that survive in the final text, divided by the final length, summed over every essay." />
        <StatTile label="Revision" value={pct(p.correction_ratio)} detail="of typed characters later deleted" info="Characters you typed and later removed, divided by all characters typed. Higher means more rewriting." />
      </StatGrid>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Panel legend="When you write">
          <Caption className="mb-2">Active minutes by hour of the day, your local time, summed over every session; a session that crosses the hour is split between both. The tallest bar is marked.</Caption>
          <HourChart hours={localHours} />
        </Panel>

        <Panel legend="Session length">
          <Caption className="mb-2">How many sessions fell into each length band, by active minutes.</Caption>
          <Histogram values={sessionMinutes} />
        </Panel>

        <Panel legend="Revision habits" className="lg:col-span-2">
          <Caption className="mb-2">Per essay: how much typed text was later deleted, and how much of the final text was typed.</Caption>
          <ScrollArea label="Revision per essay" maxHeight={320} className="bg-sheet">
            <table className="w-full font-mono text-xs tabular border-collapse">
              <thead>
                <tr>
                  <th className={TH}>Essay</th>
                  <th className={cx(TH, 'text-right')}>Revised</th>
                  <th className={cx(TH, 'text-right')}>Typed</th>
                </tr>
              </thead>
              <tbody>
                {analyses.map((a, i) => (
                  <tr key={a.document.doc || i} className="border-t border-rule">
                    <td className={cx(TD, 'max-w-[24rem] overflow-hidden text-ellipsis')} title={all.value.titles[i]}>
                      {all.value.titles[i]}
                    </td>
                    <td className={cx(TD, 'text-right text-ink-soft')}>{pct(a.cadence.correction_ratio)}</td>
                    <td className={cx(TD, 'text-right text-typed')}>{pct(a.document.typed_share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </Panel>
      </div>
    </Window>
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
    <figure className="grid gap-1">
      <div className="bevel-in bg-sheet p-2">
        <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full h-auto block" shapeRendering="crispEdges" role="img" aria-label={`Active minutes by hour. Most writing around ${hourLabel(best)}.`}>
          {hours.map((v, h) => {
            const bh = Math.round((v / max) * H);
            return <rect key={h} x={pad + h * bw + 1} y={H - bh} width={bw - 2} height={bh} fill={h === best ? 'var(--paste)' : 'var(--typed)'} opacity={v ? 1 : 0.15} />;
          })}
          {[0, 6, 12, 18].map((h) => (
            <text key={h} x={pad + h * bw + 2} y={H + 14} fill="var(--ink-soft)" fontSize="11" fontFamily="var(--font-mono)">
              {hourLabel(h)}
            </text>
          ))}
          <line x1={pad} y1={H + 0.5} x2={W - pad} y2={H + 0.5} stroke="var(--rule)" />
        </svg>
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
    <ul className="grid gap-2 font-mono text-xs tabular list-none m-0 p-0" aria-label="Session length distribution">
      {labels.map((l, i) => (
        <li key={l} className="grid grid-cols-[4rem_1fr_2rem] items-center gap-3">
          <span className="text-ink-soft">{l}</span>
          <ProgressBar value={counts[i] / max} tone="typed" label={`${l}: ${counts[i]} session${counts[i] === 1 ? '' : 's'}`} />
          <span className="text-right">{counts[i]}</span>
        </li>
      ))}
    </ul>
  );
}
