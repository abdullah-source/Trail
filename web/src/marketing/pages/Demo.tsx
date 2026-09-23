// /demo: real essays from public datasets with simulated writing sessions, shown through the
// same EssayView the app uses, next to the ground truth the simulation was built from.
import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, ButtonLink, Card, CHROME_STORE_URL, Eyebrow, Heading, Info, Section, cx, useTitle } from '../../design/components';
import { FadeUp, usePrefersReducedMotion } from '../../design/motion';
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
    <>
      <Section flush wide code="00:00" label="Choose">
        <FadeUp>
          <Heading as="h1" eyebrow="Live demo" title="Watch a real essay get written." lede="Real essays, five ways of writing. Pick one and see the whole record: the replay, where each line came from, every paste with its source, and the AI-use statement drafted from it." />
          <p className="mt-4 text-sm text-ink-soft max-w-prose border-l-2 border-margin/60 pl-3">
            Real essays from public datasets; the writing sessions are simulated so you can see what a record looks like. Install the extension to record your own.
          </p>
        </FadeUp>

        <div className="mt-10">
          {list.status === 'loading' && <Loading label="Loading the demo essays" />}
          {list.status === 'error' && <p className="text-sm text-paste">{list.error.message}</p>}
          {list.status === 'ready' && entries.length === 0 && (
            <Card className="max-w-xl grid gap-3">
              <span className="marginal">Demo data not published yet</span>
              <p className="text-ink-soft text-sm">The demo essays are not on this server yet. Install the extension and write a paragraph; your own record shows up in the app in under five minutes.</p>
              <div>
                <ButtonLink to={CHROME_STORE_URL} external>
                  Install Trail
                </ButtonLink>
              </div>
            </Card>
          )}
          {entries.length > 0 && (
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list" aria-label="Demo essays">
              {entries.map((e) => (
                <li key={e.id}>
                  <EssayCard entry={e} selected={selected?.id === e.id} onChoose={() => choose(e.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {selected && <SelectedEssay key={selected.id} entry={selected} />}
    </>
  );
}

function EssayCard({ entry, selected, onChoose }: { entry: DemoEntry; selected: boolean; onChoose: () => void }) {
  const kind = demoKind(entry.kind);
  return (
    <button
      type="button"
      onClick={onChoose}
      aria-pressed={selected}
      className={cx('w-full h-full text-left bg-sheet border rounded-lg p-5 grid gap-3 content-start transition-colors duration-150 hover:border-ink', selected ? 'border-ink' : 'border-rule')}
    >
      <div className="flex items-center justify-between gap-3">
        <Badge kind={KIND_BADGE[kind] || 'neutral'}>{kindLabel(entry.kind)}</Badge>
        {selected && <span className="marginal text-accent">Showing</span>}
      </div>
      <span className="display text-xl leading-tight">{entry.title}</span>
      {entry.blurb && <span className="text-sm text-ink-soft">{entry.blurb}</span>}
      <span className="font-mono text-xs text-ink-soft tabular mt-auto">
        {entry.words ? `${num(entry.words)} words · ` : ''}
        {entry.sessions} session{entry.sessions === 1 ? '' : 's'}
        {entry.source ? <span className="block mt-1 text-ink-faint truncate" title={entry.source}>from {entry.source}</span> : null}
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
  return (
    <Section wide code="00:08" label="Record">
      <div ref={top} className="scroll-mt-20" />
      {events.status === 'loading' && <Loading label={`Loading “${entry.title}”`} />}
      {events.status === 'error' && <p className="text-sm text-paste">{events.error.message}</p>}
      {events.status === 'ready' && (
        <EssayView
          events={events.value}
          title={entry.title}
          editorLabel={kindLabel(entry.kind)}
          autoplay
          loop
          actions={
            <div className="flex flex-wrap gap-2">
              <ButtonLink to={`/verify?demo=${encodeURIComponent(entry.id)}`}>Verify this record</ButtonLink>
              <ButtonLink to={CHROME_STORE_URL} external variant="ghost">
                Install Trail
              </ButtonLink>
            </div>
          }
          banner={
            <p className="text-sm text-ink-soft max-w-2xl border-l-2 border-margin/60 pl-3">
              This essay's text is real; the sessions, pauses and pastes were simulated to match the way of writing on the card. The strip below shows what the simulation did and what Trail found.
            </p>
          }
          afterStats={<GroundTruth entry={entry} events={events.value} />}
          empty={<p className="text-sm text-ink-soft">This demo file has no events.</p>}
        />
      )}
    </Section>
  );
}

const norm = (h: string) => h.toLowerCase().replace(/^www\./, '');

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
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[30rem]">
          <thead>
            <tr className="text-left marginal">
              <th className="font-normal py-2.5 px-4">Measure</th>
              <th className="font-normal py-2.5 px-4">Ground truth</th>
              <th className="font-normal py-2.5 px-4">Trail found</th>
              <th className="font-normal py-2.5 px-4 text-right">Match</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-rule align-top">
                <td className="py-2.5 px-4">
                  <span className="inline-flex items-center gap-1.5">
                    {r.label}
                    <Info text={r.info} />
                  </span>
                </td>
                <td className="py-2.5 px-4 text-ink-soft tabular break-words">{r.truth}</td>
                <td className="py-2.5 px-4 tabular break-words">{r.found}</td>
                <td className={cx('py-2.5 px-4 text-right font-mono text-xs', r.match === null ? 'text-ink-faint' : r.match ? 'text-typed' : 'text-paste')}>{r.match === null ? 'n/a' : r.match ? 'yes' : 'no'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
