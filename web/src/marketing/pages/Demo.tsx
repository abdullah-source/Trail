// /demo: real essays from public datasets with simulated writing sessions, shown through the
// same EssayView the app uses, next to the ground truth the simulation was built from.
import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, ButtonLink, CHROME_STORE_URL, Info, Section, cx, useTitle } from '../../design/components';
import { Icon, Note } from '../../design/document';
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
    <>
      <Section className="mk-first" titleAs="h1" index="Nº 01" eyebrow="Live demo" title="Watch a real essay get written." lede="Real essays, five ways of writing. Pick one and see the whole record: the replay, where each line came from, every paste with its source, and the AI-use statement drafted from it.">
        <p className="text-sm text-ink-soft max-w-prose -mt-4 pl-3 border-l-2 border-guilloche">Real essays from public datasets; the writing sessions are simulated so you can see what a record looks like. Install the extension to record your own.</p>

        <div>
          {list.status === 'loading' && <Loading label="Loading the demo essays" />}
          {list.status === 'error' && <p className="text-sm text-paste">{list.error.message}</p>}
          {list.status === 'ready' && entries.length === 0 && (
            <Note label="Demo data not published yet" className="max-w-xl">
              <p className="text-sm">The demo essays are not on this server yet. Install the extension and write a paragraph; your own record shows up in the app in under five minutes.</p>
              <div>
                <ButtonLink to={CHROME_STORE_URL} external variant="primary">
                  Install Trail
                </ButtonLink>
              </div>
            </Note>
          )}
          {entries.length > 0 && (
            <ul className="mk-grid-3 !gap-x-8 !gap-y-10" role="list" aria-label="Demo essays">
              {entries.map((e) => (
                <li key={e.id} className="grid">
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

/** One essay to choose: a lifted note that is a button. Pressed when showing. */
function EssayCard({ entry, selected, onChoose }: { entry: DemoEntry; selected: boolean; onChoose: () => void }) {
  const kind = demoKind(entry.kind);
  return (
    <button type="button" onClick={onChoose} aria-pressed={selected} className={cx('note w-full h-full text-left cursor-pointer content-start', selected && 'mk-chosen')} data-crop="" data-lift="">
      <span className="note-head">
        <Badge kind={KIND_BADGE[kind] || 'neutral'}>{kindLabel(entry.kind)}</Badge>
        {selected && <Badge kind="accent">Showing</Badge>}
      </span>
      <span className="flex items-start gap-3">
        <Icon name="document" size={24} className="text-guilloche-ink shrink-0 mt-0.5" />
        <span className="note-title">{entry.title}</span>
      </span>
      {entry.blurb && <span className="text-sm text-ink-soft">{entry.blurb}</span>}
      <span className="mono text-xs text-ink-soft tabular mt-auto">
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
  // EssayView draws its own certificate and notes, so it sits straight on the page.
  return (
    <div className="doc-container section mk-tight min-w-0" aria-label={`Record of “${entry.title}”`} role="region">
      <div ref={top} className="scroll-mt-20" />
      {events.status === 'loading' && <Loading label={`Loading “${entry.title}”`} />}
      {events.status === 'error' && <p className="text-sm text-seal">{events.error.message}</p>}
      {events.status === 'ready' && (
        <EssayView
          events={events.value}
          title={entry.title}
          editorLabel={kindLabel(entry.kind)}
          autoplay
          loop
          checkpoints={entry.server?.checkpoints.length}
          actions={
            <div className="flex flex-wrap gap-2">
              <ButtonLink to={`/verify?demo=${encodeURIComponent(entry.id)}`} variant="primary">
                Verify this record
              </ButtonLink>
              <ButtonLink to={CHROME_STORE_URL} external variant="secondary">
                Install Trail
              </ButtonLink>
            </div>
          }
          banner={
            <p className="text-sm text-ink-soft max-w-2xl">This essay's text is real; the sessions, pauses and pastes were simulated to match the way of writing on the card. The strip below shows what the simulation did and what Trail found.</p>
          }
          afterStats={<GroundTruth entry={entry} events={events.value} />}
          empty={<p className="mono text-xs text-ink-soft">This demo file has no events.</p>}
        />
      )}
    </div>
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
    <Note as="section" label="Ground truth" watermark={false}>
      <p className="text-sm text-ink-soft">What the simulation did, next to what Trail found.</p>
      <div className="scroll" role="region" aria-label="Ground truth" tabIndex={0}>
        <table className="mk-table min-w-[30rem]">
          <thead>
            <tr>
              <th>Measure</th>
              <th>Ground truth</th>
              <th>Trail found</th>
              <th className="text-right">Match</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>
                  <span className="inline-flex items-center gap-1.5">
                    {r.label}
                    <Info text={r.info} />
                  </span>
                </td>
                <td className="text-ink-soft tabular break-words">{r.truth}</td>
                <td className="tabular break-words">{r.found}</td>
                <td className={cx('text-right mono text-xs', r.match === null ? 'text-ink-faint' : r.match ? 'text-typed' : 'text-paste')}>{r.match === null ? 'n/a' : r.match ? 'yes' : 'no'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Note>
  );
}
