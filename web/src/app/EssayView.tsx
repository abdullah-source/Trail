// The full product view of one essay, rendered from a list of events. The app route feeds it
// events from the extension; the public /demo page feeds it events from a published file.
// Everything that needs an account or the extension (export dialog, AI-use note) comes in
// through slots so this component stays pure.
//
// On the desktop it is three windows: the player (sheet, transport, provenance strip, stat tiles),
// the Record control panel (sessions, pastes, AI sites, open-while-writing, rhythm as panels) and the
// AI-use declaration as a document window (DESIGN-desktop.md §4).
import { useState, type ReactNode } from 'react';
import type { AiPresence, Analysis, SessionSummary, TrailEvent } from '../lib/types';
import { ReplayPlayer } from '../components/ReplayPlayer';
import { PasteList, ProvenanceStrip } from '../design/Provenance';
import { Caption, Chip, Info, Marginal, Panel, ScrollArea, StatGrid, StatTile, Window, cx } from '../components/ui';
import { editorName, fmtDateTime, fmtMinutes, num, pct } from '../components/format';
import { useEssayAnalysis } from './shared';

export type EssayViewProps = {
  events: TrailEvent[];
  title: string;
  /** shown in the player's meta line, e.g. "Google Docs" */
  editorLabel?: string;
  autoplay?: boolean;
  loop?: boolean;
  /** the declaration window's action row: the export dialog in the app; verify + install on the demo */
  actions?: ReactNode;
  /** a status line under the player's title bar (first replay, or the demo's honesty line) */
  banner?: ReactNode;
  /** rendered right after the player window: the demo's ground-truth strip */
  afterStats?: ReactNode;
  /** rendered in the declaration window's action row: the app's AI-use note */
  declarationExtra?: ReactNode;
  /** what to show when the events list is empty */
  empty?: ReactNode;
  /** the player window's close box, e.g. back to the essays list; no box without it */
  onClose?: () => void;
};

const TH = 'marginal font-normal text-left px-2 py-1.5 whitespace-nowrap';
const TD = 'px-2 py-1.5 whitespace-nowrap';

export function EssayView({ events, title, editorLabel, autoplay, loop, actions, banner, afterStats, declarationExtra, empty, onClose }: EssayViewProps) {
  const res = useEssayAnalysis(events.length ? events : null);
  const [clock, setClock] = useState('00:00 / 00:00');
  if (!res) return <>{empty ?? <p className="label-plate">Nothing recorded for this document yet.</p>}</>;
  const { analysis: a } = res;
  const sessions = `${a.sessions.length} session${a.sessions.length === 1 ? '' : 's'}`;

  return (
    <article className="grid gap-6">
      <Window as="section" titleAs="h1" title={title} icon="document" right={clock} open bodyClassName="p-0" onClose={onClose} closeLabel="Back to essays">
        <Caption className="px-4 py-2 border-b border-rule tabular">
          {editorLabel || 'Essay'} · recording started {fmtDateTime(a.first_event)} · last edit {fmtDateTime(a.last_event)} · {sessions}
        </Caption>
        {banner && (
          <p role="status" className="px-4 py-2 border-b border-rule text-sm">
            {banner}
          </p>
        )}
        <ReplayPlayer events={events} title={null} autoplay={autoplay} loop={loop} onClock={setClock} />
        <div className="grid gap-4 p-4 border-t border-frame">
          <div className="grid gap-2">
            <Marginal className="inline-flex items-center gap-2">
              Where each line came from
              <Info text="One cell per line of the final essay, in reading order. Typed means every character was typed; pasted means it arrived in one paste; pasted, then edited means part of a paste was reworked; mixed is a line with both; unobserved is text that appeared while the recorder was not watching." />
            </Marginal>
            <ProvenanceStrip lines={res.lines} animate />
            {a.document.unobserved_chars > 0 && (
              <Caption>
                {num(a.document.unobserved_chars)} characters appeared while the recorder was not watching ({a.document.resyncs} resyncs). They are shown as unobserved and make no claim either way.
              </Caption>
            )}
          </div>
          <StatGrid>
            <StatTile label="Final length" value={num(a.document.final_words)} detail={`words, ${a.document.final_lines} lines`} info="Words and lines in the document as it stood at the last recorded event." />
            <StatTile label="Typed" value={pct(a.document.typed_share)} detail="of the final text" tone="typed" info="Characters that were typed one at a time and still survive in the final text, divided by the final length. Text retyped from a screen counts as typed: the record cannot tell." />
            <StatTile
              label="Pasted"
              value={pct(a.pastes.share_of_final_document)}
              detail={`${a.pastes.count} paste${a.pastes.count === 1 ? '' : 's'}, ${a.pastes.ai_pastes} from AI tools`}
              tone={a.pastes.count ? 'paste' : undefined}
              info="Pasted characters that survive in the final text, divided by the final length. A paste counts as from an AI tool when it was copied from a known AI site such as chatgpt.com or claude.ai."
            />
            <StatTile label="Active time" value={fmtMinutes(a.cadence.active_minutes)} detail={`over ${sessions}`} info="Minutes with at least one keystroke every two minutes. Time away from the keyboard is not counted." />
            <StatTile label="Deleted" value={num(a.cadence.deleted_chars)} detail="characters removed while writing" info="Every character that was typed or pasted and later removed. Rewriting shows up here." />
          </StatGrid>
          <Caption>
            Space or K to play and pause; drag the scrubber to any moment. The essay is rebuilt from the record keystroke by keystroke. Pasted text is highlighted with the site it was copied from; pauses over two seconds are compressed to a beat and long gaps are named.
          </Caption>
        </div>
      </Window>

      {afterStats}

      <div className="grid lg:grid-cols-[3fr_2fr] gap-6 items-start">
        <Window as="section" title="Record" icon="magnifier" chrome bodyClassName="grid gap-4">
          <Panel
            legend={
              <span className="inline-flex items-center gap-2">
                Sessions <Info text="A session starts when the editor is opened and ends after a long silence or when it is closed. Active minutes count only time with keystrokes; the character columns are what was added or removed in that session." />
              </span>
            }
          >
            <Caption className="mb-2">When the writing happened, and what each sitting added.</Caption>
            <SessionList sessions={a.sessions} />
          </Panel>

          <Panel
            legend={
              <span className="inline-flex items-center gap-2">
                Pastes <Info text="Every paste in the record, oldest first: when, how many characters, the kind of source (web page, AI tool, this document), the site it came from, and how much of it is still in the final text." />
              </span>
            }
          >
            <Caption className="mb-2">Only the host name of a source is recorded, never the page.</Caption>
            {a.pastes.items.length ? (
              <ScrollArea label="Pastes" maxHeight={320} className="bg-sheet">
                <PasteList pastes={a.pastes.items} className="px-2" />
              </ScrollArea>
            ) : (
              <p className="text-sm">No pastes. Every character was typed.</p>
            )}
          </Panel>

          {a.sources.length > 0 && (
            <Panel
              legend={
                <span className="inline-flex items-center gap-2">
                  Open while writing <Info text="Sites that were in the foreground during a writing session, and for how long. Host names only; the pages themselves are never read." />
                </span>
              }
            >
              <ScrollArea label="Sites open while writing" maxHeight={240} className="bg-sheet">
                <table className="w-full font-mono text-xs tabular border-collapse">
                  <thead>
                    <tr>
                      <th className={TH}>Site</th>
                      <th className={cx(TH, 'text-right')}>In front</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.sources.slice(0, 12).map((s) => (
                      <tr key={s.host} className="border-t border-rule">
                        <td className={TD}>{s.host}</td>
                        <td className={cx(TD, 'text-right text-ink-soft')}>{fmtMinutes(s.dwell_minutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </Panel>
          )}
        </Window>

        <Window as="section" title="Observations" icon="magnifier" chrome bodyClassName="grid gap-4" className="lg:mt-10">
          <Panel
            legend={
              <span className="inline-flex items-center gap-2">
                AI sites during this essay <Info text="Which known AI sites (chatgpt.com, claude.ai, gemini.google.com and others on Trail's public list) had their tab in front while a writing session was open, and what happened right after coming back from one. Host names only; the pages are never read." />
              </span>
            }
          >
            <Caption className="mb-2">What the tabs and the clock show. Nothing more.</Caption>
            <AiSites ap={a.ai_presence} />
          </Panel>

          <Panel
            legend={
              <span className="inline-flex items-center gap-2">
                Typing rhythm <Info text="How evenly the keys were pressed. People are irregular: the gap between keystrokes varies a lot and pauses come at odd moments. A script typing text in is unnaturally even. Trail reports the measurements; it does not decide." />
              </span>
            }
          >
            <Rhythm a={a} />
          </Panel>
        </Window>
      </div>

      <Window as="section" title="AI-use declaration" icon="document" right="draft" bodyClassName="grid gap-4" className="max-w-3xl">
        <Marginal className="inline-flex items-center gap-2">
          Drafted from the record
          <Info text="A statement drafted from the record alone: sessions, pastes and their sources, and what survived. It says what the record shows and nothing more; the student edits and signs it." />
        </Marginal>
        <pre className="essay whitespace-pre-wrap">{res.declaration}</pre>
        <Caption>In plain words, from the record. Edit it, sign it, and send it with the essay.</Caption>
        {(actions || declarationExtra) && (
          <div className="flex flex-wrap items-center gap-4 border-t border-rule pt-4">
            {actions}
            {declarationExtra}
          </div>
        )}
      </Window>
    </article>
  );
}

function SessionList({ sessions }: { sessions: SessionSummary[] }) {
  return (
    <ScrollArea label="Sessions" maxHeight={280} className="bg-sheet">
      <table className="w-full font-mono text-xs tabular border-collapse">
        <thead>
          <tr>
            <th className={TH}>#</th>
            <th className={TH}>Started</th>
            <th className={TH}>Editor</th>
            <th className={cx(TH, 'text-right')}>Active</th>
            <th className={cx(TH, 'text-right')}>Typed</th>
            <th className={cx(TH, 'text-right')}>Pasted</th>
            <th className={cx(TH, 'text-right')}>Deleted</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s, i) => (
            <tr key={s.session} className="border-t border-rule">
              <td className={cx(TD, 'text-ink-faint')}>{String(i + 1).padStart(2, '0')}</td>
              <td className={TD}>{fmtDateTime(s.start)}</td>
              <td className={cx(TD, 'text-ink-soft')}>{editorName(s.editor)}</td>
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
      <dt className="marginal inline-flex items-center gap-1">
        {label} <Info text={info} />
      </dt>
      <dd className="mt-0.5 text-sm tabular">{children}</dd>
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
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
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
        <ScrollArea label="Sessions with an AI site in front" maxHeight={200} className="bg-sheet">
          <table className="w-full font-mono text-xs tabular border-collapse">
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
                <tr key={s.session} className="border-t border-rule">
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
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
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
        <ul className="grid gap-1.5 text-ink-soft">
          {r.signals.map((s) => (
            <li key={s.signal} className="border-b border-rule pb-1.5">
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
