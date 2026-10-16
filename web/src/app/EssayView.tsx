// The full product view of one essay, rendered from a list of events, set as a certificate of origin
// (DESIGN-document.md §9, "Demo" and "Essay (replay)"). The app route feeds it events from the
// extension; the public /demo page feeds it events from a published file. Everything that needs an
// account or the extension (export, AI-use note) comes in through slots so this component stays pure.
//
// Top to bottom: the certificate header (title, serial from the doc id, a seal that is verified only
// when the record has signed checkpoints, a rosette engraved from the essay's own typing), the replay
// sheet with the line strip, the stats, the record's notes (sessions, pastes, open while writing,
// AI sites, typing rhythm), the record chain, and the AI-use declaration as a framed document
// microprinted with the record's hashes.
import { useMemo, useState, type ReactNode } from 'react';
import type { AiPresence, Analysis, LineProvenance, PasteItem, SessionSummary, TrailEvent } from '../lib/types';
import { ReplayPlayer } from '../components/ReplayPlayer';
import { Button, Caption, Chip, Guilloche, Info, Marginal, Note, ProgressBar, ProvenancePath, ScrollArea, Seal, StatGrid, StatTile, Swatch, TABLE, TD, TH, cx, serialOf, type ChipKind, type ProvenanceNode } from '../components/ui';
import { editorName, fmtDateTime, fmtMinutes, num, pct, sourceKindLabel } from '../components/format';
import { useEssayAnalysis } from './shared';

export type EssayViewProps = {
  events: TrailEvent[];
  title: string;
  /** shown in the certificate's meta line, e.g. "Google Docs" */
  editorLabel?: string;
  autoplay?: boolean;
  loop?: boolean;
  /** the declaration's action row: the export flow in the app; verify + install on the demo */
  actions?: ReactNode;
  /** a status line under the certificate's title (first replay, or the demo's honesty line) */
  banner?: ReactNode;
  /** rendered right after the stats: the demo's ground-truth strip */
  afterStats?: ReactNode;
  /** rendered in the declaration's action row: the app's AI-use note */
  declarationExtra?: ReactNode;
  /** what to show when the events list is empty */
  empty?: ReactNode;
  /** a "back" link above the title, e.g. back to the essays list; none without it */
  onClose?: () => void;
  /** how many signed checkpoints the record has; the seal is verified only when this is above 0 */
  checkpoints?: number;
};

/** The record's hashes, newest chain head first: what the microprint engraves and the footer prints. */
function recordHashes(events: TrailEvent[], textHash: string) {
  const heads = new Map<string, string>();
  for (const e of events) if (e.hash) heads.set(e.session, e.hash);
  const head = events[events.length - 1]?.hash || textHash || '';
  const rest = [...heads.values()].filter((h) => h !== head).reverse();
  return { head, all: [head, textHash, ...rest].filter(Boolean).slice(0, 6) };
}

export function EssayView({ events, title, editorLabel, autoplay, loop, actions, banner, afterStats, declarationExtra, empty, onClose, checkpoints }: EssayViewProps) {
  const res = useEssayAnalysis(events.length ? events : null);
  const [clock, setClock] = useState('00:00 / 00:00');
  const [plate, setPlate] = useState<HTMLDivElement | null>(null);
  const hashes = useMemo(() => recordHashes(events, res?.analysis.document.text_hash ?? ''), [events, res]);
  if (!res) return <>{empty ?? <p className="font-mono text-xs text-ink-soft">Nothing recorded for this document yet.</p>}</>;
  const { analysis: a } = res;
  const sessions = `${a.sessions.length} session${a.sessions.length === 1 ? '' : 's'}`;
  const serial = serialOf(events[0].doc || hashes.head);
  const signed = (checkpoints ?? 0) > 0;
  // per-bucket typed characters from the analysis timeline: this record's own engraving
  const typing = a.timeline.map((b) => b.typed);
  const hosts = [...new Set(a.pastes.items.map((p) => p.source_host).filter(Boolean))] as string[];

  const chain: ProvenanceNode[] = [
    { id: 'doc', kind: 'doc', label: title, detail: `Nº ${serial}` },
    { id: 'session', kind: 'session', label: `${sessions} of writing`, detail: `${fmtMinutes(a.cadence.active_minutes)} active` },
    {
      id: 'paste',
      kind: 'paste',
      label: a.pastes.count ? `${a.pastes.count} paste${a.pastes.count === 1 ? '' : 's'}, each with its source` : 'No pastes',
      detail: a.pastes.count ? hosts.slice(0, 2).join(' · ') || 'source unknown' : 'every character typed',
    },
    { id: 'signature', kind: 'signature', label: signed ? 'Signed checkpoint' : 'Not signed yet', detail: signed ? `${checkpoints} on this record` : 'every 10 min when connected' },
    { id: 'log', kind: 'log', label: signed ? 'Anchored in the public log' : 'Public log, after signing', detail: hashes.head ? `${hashes.head.slice(0, 12)}…` : undefined },
  ];

  return (
    <article className="grid gap-12 min-w-0">
      {/* the certificate: title, serial, seal over a rosette engraved from this essay's typing */}
      <Note as="section" label="Record of writing" serial={serial} microprint={hashes.all} guilloche={{ seed: hashes.head || serial, data: typing, intensity: 'faint' }} watermark={false}>
        <div className="grid md:grid-cols-[minmax(0,1fr)_auto] gap-x-10 gap-y-8 items-center">
          <div className="grid gap-5 min-w-0">
            {onClose && (
              <div>
                <Button variant="quiet" size="sm" icon="arrow" className="-ml-3 [&>svg]:rotate-180" onClick={onClose}>
                  Back to essays
                </Button>
              </div>
            )}
            <h1 className="h-section break-words">{title}</h1>
            <Caption className="tabular">
              {editorLabel || 'Essay'} · recording started {fmtDateTime(a.first_event)} · last edit {fmtDateTime(a.last_event)} · {sessions}
            </Caption>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 text-sm max-w-xl">
              <Row term="Written">
                {sessions}, {fmtMinutes(a.cadence.active_minutes)} active
              </Row>
              <Row term="Typed">
                <span className="text-typed">{pct(a.document.typed_share)} of the final text</span>
              </Row>
              <Row term="Pasted">
                <span className={a.pastes.count ? 'text-paste' : 'text-ink-soft'}>
                  {a.pastes.count ? `${a.pastes.count} paste${a.pastes.count === 1 ? '' : 's'}${hosts.length ? ` · ${hosts.slice(0, 2).join(', ')}` : ''}` : 'nothing pasted'}
                </span>
              </Row>
              <Row term="Signature">
                {signed ? (
                  <span>
                    Signed, {checkpoints} checkpoint{checkpoints === 1 ? '' : 's'}
                  </span>
                ) : (
                  <span className="text-ink-soft">Not signed yet. While connected, the extension gets a checkpoint signed every 10 minutes.</span>
                )}
              </Row>
            </dl>
            {banner && (
              <div role="status" className="text-sm border-l-2 border-signed pl-4 max-w-xl">
                {banner}
              </div>
            )}
          </div>
          <figure className="grid justify-items-center gap-3 m-0">
            <div ref={setPlate} className="relative grid place-items-center w-[208px] sm:w-[232px] aspect-square">
              <Guilloche seed={hashes.head || serial} data={typing} variant="rosette" intensity={0.42} drift fill />
              <Seal state={signed ? 'verified' : 'pending'} size={120} zone={plate} ringText={signed ? 'SIGNED BY TRAIL · CHECK IT ON /VERIFY · ' : undefined} label={signed ? 'Record signed by Trail; check the signature on the verify page' : 'Record not signed yet'} />
            </div>
            <Chip kind={signed ? 'signed' : 'neutral'}>{signed ? 'Signed checkpoint' : 'Awaiting signature'}</Chip>
            <figcaption className="font-mono text-[11px] text-ink-soft text-center max-w-[15rem]">Engraved from this essay's own typing. The seal means Trail has signed this record; export it and drop it on the verify page to check the signature yourself.</figcaption>
          </figure>
        </div>
      </Note>

      {/* the replay sheet */}
      <Note as="section" label="Replay" aside={<span className="font-mono text-xs tabular text-ink-soft">{clock}</span>}>
        <ReplayPlayer events={events} title={null} autoplay={autoplay} loop={loop} onClock={setClock} />
        <div className="grid gap-3 pt-2">
          <Marginal className="inline-flex items-center gap-2">
            Where each line came from
            <Info text="One cell per line of the final essay, in reading order. Typed means every character was typed; pasted means it arrived in one paste; pasted, then edited means part of a paste was reworked; mixed is a line with both; unobserved is text that appeared while the recorder was not watching." />
          </Marginal>
          <LineStrip lines={res.lines} />
          {a.document.unobserved_chars > 0 && (
            <Caption>
              {num(a.document.unobserved_chars)} characters appeared while the recorder was not watching ({a.document.resyncs} resyncs). They are shown as unobserved and make no claim either way.
            </Caption>
          )}
        </div>
        <Caption>
          Space or K to play and pause; drag the scrubber to any moment. The essay is rebuilt from the record keystroke by keystroke. Pasted text is highlighted with the site it was copied from; pauses over two seconds are compressed to a beat and long gaps are named.
        </Caption>
      </Note>

      <StatGrid min={150} compact>
        <StatTile label="Final length" value={num(a.document.final_words)} detail={`words, ${a.document.final_lines} lines`} info="Words and lines in the document as it stood at the last recorded event." />
        <StatTile label="Typed" value={pct(a.document.typed_share)} detail="of the final text" tone="typed" bar={a.document.typed_share ?? 0} info="Characters that were typed one at a time and still survive in the final text, divided by the final length. Text retyped from a screen counts as typed: the record cannot tell." />
        <StatTile
          label="Pasted"
          value={pct(a.pastes.share_of_final_document)}
          detail={`${a.pastes.count} paste${a.pastes.count === 1 ? '' : 's'}, ${a.pastes.ai_pastes} from AI tools`}
          tone={a.pastes.count ? 'paste' : undefined}
          bar={a.pastes.count ? a.pastes.share_of_final_document : undefined}
          info="Pasted characters that survive in the final text, divided by the final length. A paste counts as from an AI tool when it was copied from a known AI site such as chatgpt.com or claude.ai."
        />
        <StatTile label="Active time" value={fmtMinutes(a.cadence.active_minutes)} detail={`over ${sessions}`} info="Minutes with at least one keystroke every two minutes. Time away from the keyboard is not counted." />
        <StatTile label="Deleted" value={num(a.cadence.deleted_chars)} detail="characters removed while writing" info="Every character that was typed or pasted and later removed. Rewriting shows up here." />
      </StatGrid>

      {afterStats}

      <div className="grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-x-10 gap-y-12 items-start">
        <div className="grid gap-12 min-w-0">
          <Note as="section" label={<Legend info="A session starts when the editor is opened and ends after a long silence or when it is closed. Active minutes count only time with keystrokes; the character columns are what was added or removed in that session.">Sessions</Legend>}>
            <Caption>When the writing happened, and what each sitting added.</Caption>
            <SessionList sessions={a.sessions} />
          </Note>

          <Note as="section" label={<Legend info="Every paste in the record, oldest first: when, how many characters, the kind of source (web page, AI tool, this document), the site it came from, and how much of it is still in the final text.">Pastes</Legend>}>
            <Caption>Only the host name of a source is recorded, never the page.</Caption>
            {a.pastes.items.length ? <PasteTable pastes={a.pastes.items} /> : <p className="text-sm">No pastes. Every character was typed.</p>}
          </Note>

          {a.sources.length > 0 && (
            <Note as="section" label={<Legend info="Sites that were in the foreground during a writing session, and for how long. Host names only; the pages themselves are never read.">Open while writing</Legend>}>
              <ScrollArea label="Sites open while writing" maxHeight={240}>
                <table className={TABLE}>
                  <thead>
                    <tr>
                      <th className={TH}>Site</th>
                      <th className={cx(TH, 'text-right')}>In front</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.sources.slice(0, 12).map((s) => (
                      <tr key={s.host} className="border-t border-rule first:border-t-0">
                        <td className={TD}>{s.host}</td>
                        <td className={cx(TD, 'text-right text-ink-soft')}>{fmtMinutes(s.dwell_minutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </Note>
          )}
        </div>

        <div className="grid gap-12 min-w-0">
          <Note
            as="section"
            label={
              <Legend info="Which known AI sites (chatgpt.com, claude.ai, gemini.google.com and others on Trail's public list) had their tab in front while a writing session was open, and what happened right after coming back from one. Host names only; the pages are never read.">
                AI sites during this essay
              </Legend>
            }
          >
            <Caption>What the tabs and the clock show. Nothing more.</Caption>
            <AiSites ap={a.ai_presence} />
          </Note>

          <Note
            as="section"
            label={
              <Legend info="How evenly the keys were pressed. People are irregular: the gap between keystrokes varies a lot and pauses come at odd moments. A script typing text in is unnaturally even. Trail reports the measurements; it does not decide.">
                Typing rhythm
              </Legend>
            }
          >
            <Rhythm a={a} />
          </Note>
        </div>
      </div>

      <Note as="section" label="Record chain" serial={serial} watermark={false}>
        <ProvenancePath nodes={chain} label={`How the record of ${title} was made`} />
        <Caption>Each checkpoint on the line is this record's own: the document, its sessions, its pastes with their sources, the signature, and the public log.</Caption>
      </Note>

      {/* the declaration: a document with crop marks, microprinted with the record's hashes */}
      <Note
        as="section"
        label="AI-use declaration"
        aside={<Chip kind="neutral">Draft</Chip>}
        microprint={hashes.all}
        className="max-w-3xl w-full"
        footer={
          <>
            <span className="font-mono text-xs text-ink-soft min-w-0 flex-1 truncate" title={hashes.head}>
              chain head {hashes.head}
            </span>
            <span className="font-mono text-xs text-ink-soft min-w-0 truncate max-w-full" title={a.document.text_hash}>
              text {a.document.text_hash.slice(0, 16)}…
            </span>
          </>
        }
      >
        <Marginal className="inline-flex items-center gap-2">
          Drafted from the record
          <Info text="A statement drafted from the record alone: sessions, pastes and their sources, and what survived. It says what the record shows and nothing more; the student edits and signs it." />
        </Marginal>
        <Declaration text={res.declaration} />
        <Caption>In plain words, from the record. Edit it, sign it, and send it with the essay.</Caption>
        {(actions || declarationExtra) && <div className="flex flex-wrap items-center gap-4 pt-2">{actions}{declarationExtra}</div>}
      </Note>
    </article>
  );
}

/**
 * The declaration as a document: its markdown heading set as the title and "**Label:**" set bold.
 * Text only (no HTML is built from it); the copy and the export keep the raw text.
 */
function Declaration({ text }: { text: string }) {
  const bold = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong> : part));
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="essay grid gap-4 max-w-[42rem] break-words">
      {blocks.map((b, i) => {
        const h = /^#{1,3}\s+(.*)$/.exec(b);
        if (h && !b.includes('\n')) return <h3 key={i} className="note-title">{h[1]}</h3>;
        return (
          <p key={i}>
            {b.split('\n').map((ln, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {bold(ln.replace(/^[-*]\s+/, '• '))}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="marginal py-2.5 border-b border-rule self-stretch flex items-center">{term}</dt>
      <dd className="m-0 py-2.5 border-b border-rule min-w-0">{children}</dd>
    </>
  );
}

function Legend({ children, info }: { children: ReactNode; info: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      {children} <Info text={info} />
    </span>
  );
}

const STRIP: { key: LineProvenance['label']; name: string; cls: string; swatch: ChipKind }[] = [
  { key: 'typed', name: 'typed', cls: 'is-typed', swatch: 'typed' },
  { key: 'pasted', name: 'pasted', cls: 'is-pasted', swatch: 'pasted' },
  { key: 'pasted-edited', name: 'pasted, then edited', cls: 'is-pasted-edited', swatch: 'pasted-edited' },
  { key: 'mixed', name: 'mixed', cls: 'is-mixed', swatch: 'mixed' },
  { key: 'unobserved', name: 'unobserved', cls: 'is-unobserved', swatch: 'unobserved' },
];

/** The provenance strip: one cell per line in reading order, a legend with counts in words. */
function LineStrip({ lines }: { lines: LineProvenance[] }) {
  const counts = {} as Record<string, number>;
  for (const l of lines) counts[l.label] = (counts[l.label] || 0) + 1;
  const summary = STRIP.filter((l) => counts[l.key]).map((l) => `${counts[l.key]} ${l.name}`).join(', ');
  return (
    <div className="grid gap-2.5">
      <div className="prov-strip" role="img" aria-label={`Where each line came from: ${summary || 'no lines'}`}>
        {lines.map((l) => (
          <span key={l.index} className={STRIP.find((x) => x.key === l.label)?.cls ?? 'is-unobserved'} title={`Line ${l.index + 1}: ${l.label}${l.text ? ` — ${l.text.slice(0, 60)}` : ''}`} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-ink-soft tabular list-none m-0 p-0">
        {STRIP.filter((l) => l.key !== 'unobserved' || counts.unobserved).map((l) => (
          <li key={l.key} className="inline-flex items-center gap-1.5">
            {/* "pasted, then edited" matches its strip cell: sepia at 45 %, not the pale wash */}
            <Swatch kind={l.key === 'pasted-edited' ? 'pasted' : l.swatch} className={l.key === 'pasted-edited' ? 'opacity-45' : undefined} />
            {l.name} {counts[l.key] || 0}
          </li>
        ))}
      </ul>
    </div>
  );
}

const SOURCE_CHIP: Record<string, ChipKind> = { ai: 'ai', web: 'web', self: 'self', internal: 'internal', search: 'search', unknown: 'unknown' };

/** Every paste, oldest first: when, how much, the kind of source as a chip, the host, how much survived. */
function PasteTable({ pastes, limit = 40 }: { pastes: PasteItem[]; limit?: number }) {
  return (
    <div className="grid gap-2">
      <ScrollArea label="Pastes" maxHeight={320}>
        <table className={cx(TABLE, 'min-w-[24rem]')}>
          <thead>
            <tr>
              <th className={TH}>When</th>
              <th className={cx(TH, 'text-right')}>Chars</th>
              <th className={TH}>Source</th>
              <th className={cx(TH, 'text-right')}>Still in text</th>
            </tr>
          </thead>
          <tbody>
            {pastes.slice(0, limit).map((p) => (
              <tr key={p.paste_id} className="border-t border-rule first:border-t-0">
                <td className={cx(TD, 'text-ink-soft')}>{fmtDateTime(p.ts)}</td>
                <td className={cx(TD, 'text-right')}>{num(p.chars)}</td>
                <td className={cx(TD, 'whitespace-normal!')}>
                  <span className="grid justify-items-start gap-1">
                    <Chip kind={SOURCE_CHIP[p.source_kind] ?? 'unknown'}>{sourceKindLabel(p.source_kind)}</Chip>
                    <span className="[overflow-wrap:anywhere]">{p.source_host || (p.from_self ? 'this document' : 'unknown')}</span>
                  </span>
                </td>
                <td className={cx(TD, 'text-right')}>
                  <span className="inline-flex items-center gap-2 justify-end">
                    <ProgressBar value={p.surviving_ratio} tone="paste" className="w-12 flex-none min-w-0" label={`${pct(p.surviving_ratio)} still in text`} />
                    {pct(p.surviving_ratio)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      {pastes.length > limit && (
        <Caption>
          Showing {limit} of {pastes.length} pastes.
        </Caption>
      )}
    </div>
  );
}

function SessionList({ sessions }: { sessions: SessionSummary[] }) {
  return (
    <ScrollArea label="Sessions" maxHeight={280}>
      <table className={TABLE}>
        <thead>
          <tr>
            <th className={TH}>#</th>
            <th className={TH}>Started</th>
            <th className={cx(TH, 'hide-phone')}>Editor</th>
            <th className={cx(TH, 'text-right')}>Active</th>
            <th className={cx(TH, 'text-right')}>Typed</th>
            <th className={cx(TH, 'text-right')}>Pasted</th>
            <th className={cx(TH, 'text-right')}>Deleted</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s, i) => (
            <tr key={s.session} className="border-t border-rule first:border-t-0">
              <td className={cx(TD, 'text-ink-faint')}>{String(i + 1).padStart(2, '0')}</td>
              <td className={TD}>{fmtDateTime(s.start)}</td>
              <td className={cx(TD, 'hide-phone text-ink-soft')}>{editorName(s.editor)}</td>
              <td className={cx(TD, 'text-right')}>{fmtMinutes(s.active_minutes)}</td>
              <td className={cx(TD, 'text-right text-typed')}>{num(s.typed_chars)}</td>
              <td className={cx(TD, 'text-right', s.pasted_chars ? 'text-paste' : 'text-ink-faint')}>{num(s.pasted_chars)}</td>
              <td className={cx(TD, 'text-right text-ink-soft')}>{num(s.deleted_chars)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}

const AI_SITES_NOTE = 'These are facts about tabs and timing on this computer. They do not say what was on the screen, and Trail does not judge them.';

function Measure({ label, info, children }: { label: string; info: string; children: ReactNode }) {
  return (
    <div>
      <dt className="marginal inline-flex items-center gap-1.5">
        {label} <Info text={info} />
      </dt>
      <dd className="m-0 mt-1 text-sm tabular">{children}</dd>
    </div>
  );
}

function AiSites({ ap }: { ap: AiPresence }) {
  if (!ap.ai_hosts.length && !ap.switches) {
    return (
      <div className="grid gap-2 text-sm">
        <p>No AI site was in front during this essay.</p>
        <Caption>{AI_SITES_NOTE}</Caption>
      </div>
    );
  }
  const sessionsWord = ap.sessions_total === 1 ? 'the only session' : `${ap.sessions_with_ai} of ${ap.sessions_total} sessions`;
  const withAi = ap.by_session.filter((s) => s.ai_hosts.length || s.switches);
  return (
    <div className="grid gap-4 text-sm">
      <p>
        {ap.ai_hosts.map((h, i) => (
          <span key={h.host}>
            {i > 0 && (i === ap.ai_hosts.length - 1 ? ' and ' : ', ')}
            <span className="font-mono text-xs">{h.host}</span>
          </span>
        ))}{' '}
        {ap.ai_hosts.length === 1 ? 'was' : 'were'} in front for {fmtMinutes(ap.ai_minutes)} in total, during {sessionsWord}.
      </p>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(9rem,100%),1fr))] gap-x-6 gap-y-4 m-0">
        <Measure label="In front" info="Minutes an AI site's tab was the front tab of a focused browser window while a writing session was open. Time with the browser in the background is not counted.">
          {fmtMinutes(ap.ai_minutes)}
          {ap.ai_hosts.length > 1 && <span className="text-ink-soft"> · {ap.ai_hosts.map((h) => `${h.host} ${fmtMinutes(h.minutes)}`).join(', ')}</span>}
        </Measure>
        <Measure label="Returns to the document" info="Times the editor tab came back in front directly after an AI site's tab.">
          {num(ap.switches)}
        </Measure>
        <Measure label="Typed within a minute of returning" info="Characters in typing batches that began within 60 seconds of such a return, and how many separate runs of keystrokes (no pause over two seconds) began in that minute.">
          {num(ap.typed_after_switch_chars)} chars
          <span className="text-ink-soft">
            {' '}
            in {num(ap.bursts_after_switch)} run{ap.bursts_after_switch === 1 ? '' : 's'}
          </span>
        </Measure>
        <Measure label="Corrections after returning" info="Characters deleted divided by characters typed, inside those first 60 seconds after a return, next to the same ratio over the whole essay. Shown as a dash when nothing was typed in those windows.">
          {pct(ap.correction_ratio_after_switch, 1)} <span className="text-ink-soft">vs {pct(ap.correction_ratio_overall, 1)} overall</span>
        </Measure>
        <Measure label="Pastes from AI sites" info="Pastes whose text matched something copied on an AI site. Each one is listed under Pastes.">
          {num(ap.ai_copy_paste_matches)}
        </Measure>
        <Measure label="Sessions" info="Writing sessions in which an AI site's tab was in front at least once, out of all sessions in this record.">
          {num(ap.sessions_with_ai)} <span className="text-ink-soft">of {num(ap.sessions_total)}</span>
        </Measure>
      </dl>
      {ap.sessions_total > 1 && withAi.length > 0 && (
        <ScrollArea label="Sessions with an AI site in front" maxHeight={200}>
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>#</th>
                <th className={TH}>Started</th>
                <th className={TH}>AI sites in front</th>
                <th className={cx(TH, 'text-right')}>Returns</th>
                <th className={cx(TH, 'text-right')}>Typed within a minute</th>
              </tr>
            </thead>
            <tbody>
              {withAi.map((s) => (
                <tr key={s.session} className="border-t border-rule first:border-t-0">
                  <td className={cx(TD, 'text-ink-faint')}>{String(ap.by_session.indexOf(s) + 1).padStart(2, '0')}</td>
                  <td className={TD}>{fmtDateTime(s.start)}</td>
                  <td className={cx(TD, 'text-ink-soft')}>{s.ai_hosts.map((h) => `${h.host} ${fmtMinutes(h.minutes)}`).join(', ')}</td>
                  <td className={cx(TD, 'text-right')}>{num(s.switches)}</td>
                  <td className={cx(TD, 'text-right')}>{num(s.typed_after_switch_chars)} chars</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
      <Caption>{AI_SITES_NOTE}</Caption>
    </div>
  );
}

function Rhythm({ a }: { a: Analysis }) {
  const r = a.regularity;
  const c = a.cadence;
  const measures = (
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(9rem,100%),1fr))] gap-x-6 gap-y-4 m-0">
      <Measure label="Median gap" info="The middle value of the time between one keystroke and the next, in milliseconds. Most people sit between 80 and 250 ms.">
        {c.inter_key_median_ms ?? '—'} ms
      </Measure>
      <Measure label="Spread" info="How much the gaps between keystrokes vary (the interquartile range divided by the median). A person is well above 0.5; a script is close to 0.">
        {r.inter_key_spread ?? '—'}
      </Measure>
      <Measure label="Pauses" info="Gaps of more than two seconds between keystrokes inside a session: thinking, reading, checking a source.">
        {c.pauses}
      </Measure>
      <Measure label="Pace" info="Words added per minute of active writing.">
        {c.words_per_minute ? `${num(c.words_per_minute)} wpm` : '—'}
      </Measure>
    </dl>
  );
  if (r.flagged) {
    return (
      <div className="grid gap-4 text-sm">
        <p>
          <Chip kind="paste">unusually regular</Chip> The typing rhythm in this record does not look like a person at a keyboard. This is what the record shows; a reader weighs it with everything else:
        </p>
        <ul className="grid gap-2 text-ink-soft list-none m-0 p-0">
          {r.signals.map((s) => (
            <li key={s.signal} className="border-b border-rule pb-2">
              <span className="font-mono text-xs text-ink">{s.signal}</span> <span className="tabular">({s.value} vs {s.threshold})</span>: {s.meaning}
            </li>
          ))}
        </ul>
        {measures}
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      <p className="text-sm text-ink-soft">
        <Chip kind="typed">looks like a person at a keyboard</Chip> {pct(c.correction_ratio)} of typed characters were later deleted
        {c.words_per_minute ? <>, about {num(c.words_per_minute)} words a minute while active</> : null}.{r.signals.length ? ' One observation is listed in the exported report; on its own it is not evidence of anything.' : ''}
      </p>
      {measures}
    </div>
  );
}

export default EssayView;
