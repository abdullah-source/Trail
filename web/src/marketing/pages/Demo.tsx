// /demo: real essays from public datasets with simulated writing sessions, shown through the
// same EssayView the app uses, next to the ground truth the simulation was built from.
import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, ButtonLink, CHROME_STORE_URL, Desk, Eyebrow, Heading, Info, Section, cx, useTitle } from '../../design/components';
import { Bevel, Icon, Panel, ScrollArea } from '../../design/desktop';
import { usePrefersReducedMotion } from '../../design/motion';
import { useAsync } from '../../components/useAsync';
import { Loading } from '../../components/ui';
import { analyse } from '../../lib/analysis';
import { demoKind, kindLabel, loadDemoEvents, loadDemoManifest, loadServerDemos, mergeDemos, sourceHosts, DemoUnavailable, type DemoEntry } from '../../lib/demo';
import type { TrailEvent } from '../../lib/types';
import { EssayView } from '../../app/EssayView';
import { num, pct } from '../../components/format';

const KIND_BADGE: Record<string, 'typed' | 'ai' | 'pasted' | 'mixed' | 'unobserved'> = { typed: 'typed', 'ai-paste': 'ai', chunked: 'mixed', autotyped: 'unobserved', 'web-quotes': 'pasted' };

export default function Demo() {
  useTitle('Live demo');
  const [params, setParams] = useSearchParams();
  const list = useAsync(async () => {
    const [manifest, server] = await Promise.all([loadDemoManifest().catch((e) => (e instanceof DemoUnavailable ? [] : Promise.reject(e))), loadServerDemos()]);
    return mergeDemos(manifest, server);
  }, []);
  const entries = list.status === 'ready' ? list.value : [];
  const wanted = params.get('essay');
  const selected = entries.find((e) => e.id === wanted) ?? null;
  const choose = (id: string) => setParams({ essay: id }, { replace: false });

  return (
    <Desk>
      <Section label="Live demo" icon="folder" code="00:00" wide titleAs="div" open>
        <Heading as="h1" eyebrow="Live demo" title="Watch a real essay get written." lede="Real essays, five ways of writing. Pick one and see the whole record: the replay, where each line came from, every paste with its source, and the AI-use statement drafted from it." />
        <Bevel sunken className="mt-4 px-3 py-2 text-sm text-ink-soft max-w-prose">
          Real essays from public datasets; the writing sessions are simulated so you can see what a record looks like. Install the extension to record your own.
        </Bevel>

        <div className="mt-6">
          {list.status === 'loading' && <Loading label="Loading the demo essays" />}
          {list.status === 'error' && <p className="text-sm text-paste">{list.error.message}</p>}
          {list.status === 'ready' && entries.length === 0 && (
            <Panel legend="Demo data not published yet" className="max-w-xl grid gap-3">
              <p className="text-sm">The demo essays are not on this server yet. Install the extension and write a paragraph; your own record shows up in the app in under five minutes.</p>
              <div>
                <ButtonLink to={CHROME_STORE_URL} external variant="primary">
                  Install Trail
                </ButtonLink>
              </div>
            </Panel>
          )}
          {entries.length > 0 && (
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list" aria-label="Demo essays">
              {entries.map((e) => (
                <li key={e.id} className="grid" style={selected?.id === e.id ? { outline: '2px solid var(--ink)', outlineOffset: 2 } : undefined}>
                  <EssayCard entry={e} selected={selected?.id === e.id} onChoose={() => choose(e.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {selected && <SelectedEssay key={selected.id} entry={selected} />}
    </Desk>
  );
}

/** One essay to choose: a document icon on a control-panel plate. Pressed when showing. */
function EssayCard({ entry, selected, onChoose }: { entry: DemoEntry; selected: boolean; onChoose: () => void }) {
  const kind = demoKind(entry.kind);
  return (
    <button type="button" onClick={onChoose} aria-pressed={selected} className="panel on-chrome w-full h-full text-left grid gap-2 content-start cursor-pointer hover:bg-chrome-deep">
      <span className="flex items-center justify-between gap-3">
        <Badge kind={KIND_BADGE[kind] || 'neutral'}>{kindLabel(entry.kind)}</Badge>
        {selected && <Badge kind="accent">Showing</Badge>}
      </span>
      <span className="flex items-start gap-3">
        <Icon name="document" size={32} />
        <span className="display text-lg leading-tight">{entry.title}</span>
      </span>
      {entry.blurb && <span className="text-sm text-ink-soft">{entry.blurb}</span>}
      <span className="font-mono text-xs text-ink-soft tabular mt-auto">
        {entry.words ? `${num(entry.words)} words · ` : ''}
        {entry.sessions} session{entry.sessions === 1 ? '' : 's'}
        {entry.source ? (
          <span className="block mt-1 truncate" title={entry.source}>
            from {entry.source}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function SelectedEssay({ entry }: { entry: DemoEntry }) {
  const events = useAsync(() => loadDemoEvents(entry.id), [entry.id]);
  const reduced = usePrefersReducedMotion();
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => {
    top.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }, [entry.id, reduced]);
  // EssayView draws its own player window and panels, so it sits straight on the desk: a
  // window around it would be chrome on chrome (DESIGN-desktop.md §9).
  return (
    <div className="min-w-0 min-[701px]:col-span-2 win-open" aria-label={`Record of “${entry.title}”`} role="region">
      <div ref={top} className="scroll-mt-20" />
      {events.status === 'loading' && <Loading label={`Loading “${entry.title}”`} />}
      {events.status === 'error' && <p className="label-plate text-sm">{events.error.message}</p>}
      {events.status === 'ready' && (
        <EssayView
          events={events.value}
          title={entry.title}
          editorLabel={kindLabel(entry.kind)}
          autoplay
          loop
          actions={
            <div className="flex flex-wrap gap-2">
              <ButtonLink to={`/verify?demo=${encodeURIComponent(entry.id)}`} variant="primary">
                Verify this record
              </ButtonLink>
              <ButtonLink to={CHROME_STORE_URL} external>
                Install Trail
              </ButtonLink>
            </div>
          }
          banner={
            <Bevel sunken className="px-3 py-2 text-sm text-ink-soft max-w-2xl">
              This essay's text is real; the sessions, pauses and pastes were simulated to match the way of writing on the card. The strip below shows what the simulation did and what Trail found.
            </Bevel>
          }
          afterStats={<GroundTruth entry={entry} events={events.value} />}
          empty={<p className="label-plate text-sm">This demo file has no events.</p>}
        />
      )}
    </div>
  );
}

const norm = (h: string) => h.toLowerCase().replace(/^www\./, '');

const th = 'marginal font-normal text-left py-2 px-3 border-b border-rule whitespace-nowrap';
const td = 'py-2 px-3 border-b border-rule align-top';

/** What the simulation did vs what Trail computed from the record alone. */
function GroundTruth({ entry, events }: { entry: DemoEntry; events: TrailEvent[] }) {
  const a = useMemo(() => analyse(events), [events]);
  const t = entry.truth || {};
  const x = entry.expect || {};
  const kind = demoKind(entry.kind);
  const truthTyped = t.typed_share ?? x.typed_share ?? null;
  const truthPasted = t.pasted_chars ?? x.pasted_chars ?? null;
  const truthSources = sourceHosts(t.paste_sources)?.map(norm) ?? null;
  const truthScripted = t.scripted ?? x.regularity_flagged ?? (kind === 'autotyped' ? true : null);
  const foundSources = [...new Set(a.pastes.items.map((p) => (p.source_host ? norm(p.source_host) : p.from_self ? 'this document' : 'unknown')))];
  const rows: { label: string; truth: string; found: string; match: boolean | null; info: string }[] = [
    {
      label: 'Typed share',
      truth: truthTyped === null ? '—' : pct(truthTyped),
      found: pct(a.document.typed_share),
      match: truthTyped === null || a.document.typed_share === null ? null : Math.abs(truthTyped - a.document.typed_share) <= 0.05,
      info: 'Share of the final text that was typed. Ground truth is what the simulation did; Trail computes its number from the events alone. Within five points counts as a match.',
    },
    {
      label: 'Pasted characters',
      truth: truthPasted === null ? '—' : num(truthPasted),
      found: num(a.pastes.pasted_chars),
      match: truthPasted === null ? null : Math.abs(truthPasted - a.pastes.pasted_chars) <= Math.max(20, truthPasted * 0.1),
      info: 'Characters that arrived by paste, whether or not they survived to the final text. Within ten percent counts as a match.',
    },
    {
      label: 'Paste sources',
      truth: truthSources === null ? '—' : truthSources.length ? truthSources.join(', ') : 'none',
      found: foundSources.length ? foundSources.join(', ') : 'none',
      match: truthSources === null ? null : truthSources.length === foundSources.length && truthSources.every((s) => foundSources.includes(s)),
      info: 'The sites the pastes were copied from. The extension records the host name of the tab a copy came from; Trail lists each one it sees on a paste.',
    },
    {
      label: 'Scripted typing',
      truth: truthScripted === null ? '—' : truthScripted ? 'yes' : 'no',
      found: a.regularity.flagged ? 'looks scripted' : 'looks human',
      match: truthScripted === null ? null : truthScripted === a.regularity.flagged,
      info: 'Whether the keystrokes came from a script rather than a person. Trail looks at how evenly the keys were pressed and how the pauses fall; it reports, it does not judge.',
    },
  ];
  return (
    <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
      <div className="grid gap-1 content-start">
        <Eyebrow tick={false}>Ground truth</Eyebrow>
        <span className="text-xs text-ink-soft">What the simulation did, next to what Trail found.</span>
      </div>
      <ScrollArea label="Ground truth">
        <table className="w-full text-sm border-collapse min-w-[30rem]">
          <thead>
            <tr>
              <th className={th}>Measure</th>
              <th className={th}>Ground truth</th>
              <th className={th}>Trail found</th>
              <th className={cx(th, 'text-right')}>Match</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className={td}>
                  <span className="inline-flex items-center gap-1.5">
                    {r.label}
                    <Info text={r.info} />
                  </span>
                </td>
                <td className={cx(td, 'text-ink-soft tabular break-words')}>{r.truth}</td>
                <td className={cx(td, 'tabular break-words')}>{r.found}</td>
                <td className={cx(td, 'text-right font-mono text-xs', r.match === null ? 'text-ink-faint' : r.match ? 'text-typed' : 'text-paste')}>{r.match === null ? 'n/a' : r.match ? 'yes' : 'no'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </section>
  );
}
