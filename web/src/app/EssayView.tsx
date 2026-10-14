// The full product view of one essay, rendered from a list of events. The app route feeds it
// events from the extension; the public /demo page feeds it events from a published file.
// Everything that needs an account or the extension (export menu, AI-use note form) comes in
// through slots so this component stays pure.
import type { ReactNode } from 'react';
import type { AiPresence, Analysis, SessionSummary, TrailEvent } from '../lib/types';
import { ReplayPlayer } from '../components/ReplayPlayer';
import { PasteList, ProvenanceStrip } from '../design/Provenance';
import { Info, Marginal, Sheet, StatTile, cx } from '../components/ui';
import { editorName, fmtDateTime, fmtMinutes, num, pct } from '../components/format';
import { useEssayAnalysis } from './shared';

export type EssayViewProps = {
  events: TrailEvent[];
  title: string;
  /** shown in the margin above the dates, e.g. "Google Docs" */
  editorLabel?: string;
  autoplay?: boolean;
  loop?: boolean;
  /** header, right of the title: the export menu in the app; verify + install on the demo */
  actions?: ReactNode;
  /** a notice under the header (first replay, or the demo's honesty line) */
  banner?: ReactNode;
  /** rendered right after the stat row: the demo's ground-truth strip */
  afterStats?: ReactNode;
  /** rendered under the declaration: the app's AI-use note form */
  declarationExtra?: ReactNode;
  /** what to show when the events list is empty */
  empty?: ReactNode;
};

export function EssayView({ events, title, editorLabel, autoplay, loop, actions, banner, afterStats, declarationExtra, empty }: EssayViewProps) {
  const res = useEssayAnalysis(events.length ? events : null);
  if (!res) return <>{empty ?? <p className="text-ink-soft">Nothing recorded for this document yet.</p>}</>;
  const { analysis: a } = res;

  return (
    <article className="grid gap-10">
      <header className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-4 items-end">
        <div className="grid gap-1">
          <Marginal>{editorLabel || 'Essay'}</Marginal>
          <span className="font-mono text-xs text-ink-soft tabular">Recording started {fmtDateTime(a.first_event)}</span>
          <span className="font-mono text-xs text-ink-soft tabular">
            Last edit {fmtDateTime(a.last_event)} · {a.sessions.length} session{a.sessions.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex flex-wrap items-start gap-4">
          <h1 className="text-3xl sm:text-4xl flex-1 min-w-[16rem]">{title}</h1>
          {actions}
        </div>
      </header>

      {banner}

      <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
        <div className="grid gap-1 content-start">
          <Marginal className="inline-flex items-center gap-1.5">
            Replay
            <Info text="The essay rebuilt from the record, keystroke by keystroke. Pasted text is highlighted with the site it was copied from; pauses over two seconds are compressed to a beat and long gaps are named." />
          </Marginal>
          <span className="text-xs text-ink-soft">Space or K to play and pause. Drag the scrubber to any moment.</span>
        </div>
        <ReplayPlayer events={events} title={null} autoplay={autoplay} loop={loop} />
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-6">
        <StatTile label="Final length" value={num(a.document.final_words)} detail={`words, ${a.document.final_lines} lines`} info="Words and lines in the document as it stood at the last recorded event." />
        <StatTile label="Typed" value={pct(a.document.typed_share)} detail="of the final text" tone="typed" info="Characters that were typed one at a time and still survive in the final text, divided by the final length. Text retyped from a screen counts as typed: the record cannot tell." />
        <StatTile
          label="Pasted"
          value={pct(a.pastes.share_of_final_document)}
          detail={`${a.pastes.count} paste${a.pastes.count === 1 ? '' : 's'}, ${a.pastes.ai_pastes} from AI tools`}
          tone={a.pastes.count ? 'paste' : undefined}
          info="Pasted characters that survive in the final text, divided by the final length. A paste counts as from an AI tool when it was copied from a known AI site such as chatgpt.com or claude.ai."
        />
        <StatTile label="Active time" value={fmtMinutes(a.cadence.active_minutes)} detail={`over ${a.sessions.length} session${a.sessions.length === 1 ? '' : 's'}`} info="Minutes with at least one keystroke every two minutes. Time away from the keyboard is not counted." />
        <StatTile label="Deleted" value={num(a.cadence.deleted_chars)} detail="characters removed while writing" info="Every character that was typed or pasted and later removed. Rewriting shows up here." />
      </section>

      {afterStats}

      <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
        <div className="grid gap-1 content-start">
          <Marginal className="inline-flex items-center gap-1.5">
            Where each line came from
            <Info text="One cell per line of the final essay, in reading order. Typed means every character was typed; pasted means it arrived in one paste; pasted, then edited means part of a paste was reworked; mixed is a line with both; unobserved is text that appeared while the recorder was not watching." />
          </Marginal>
        </div>
        <ProvenanceStrip lines={res.lines} animate />
      </section>

      {a.document.unobserved_chars > 0 && (
        <p className="text-sm text-ink-soft max-w-2xl">
          {num(a.document.unobserved_chars)} characters appeared while the recorder was not watching ({a.document.resyncs} resyncs). They are shown as unobserved and make no claim either way.
        </p>
      )}

      <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
        <div className="grid gap-1 content-start">
          <Marginal className="inline-flex items-center gap-1.5">
            Sessions
            <Info text="A session starts when the editor is opened and ends after a long silence or when it is closed. Active minutes count only time with keystrokes; the character columns are what was added or removed in that session." />
          </Marginal>
          <span className="text-xs text-ink-soft">When the writing happened, and what each sitting added.</span>
        </div>
        <SessionList sessions={a.sessions} />
      </section>

      <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
        <div className="grid gap-1 content-start">
          <Marginal className="inline-flex items-center gap-1.5">
            Pastes
            <Info text="Every paste in the record, oldest first: when, how many characters, the kind of source (web page, AI tool, this document), the site it came from, and how much of it is still in the final text." />
          </Marginal>
          <span className="text-xs text-ink-soft">Only the host name of a source is recorded, never the page.</span>
        </div>
        <PasteList pastes={a.pastes.items} empty="No pastes. Every character was typed." />
      </section>

      <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
        <div className="grid gap-1 content-start">
          <Marginal className="inline-flex items-center gap-1.5">
            AI sites during this essay
            <Info text="Which known AI sites (chatgpt.com, claude.ai, gemini.google.com and others on Trail's public list) had their tab in front while a writing session was open, and what happened right after coming back from one. Host names only; the pages are never read." />
          </Marginal>
          <span className="text-xs text-ink-soft">What the tabs and the clock show. Nothing more.</span>
        </div>
        <AiSites ap={a.ai_presence} />
      </section>

      {a.sources.length > 0 && (
        <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
          <div className="grid gap-1 content-start">
            <Marginal className="inline-flex items-center gap-1.5">
              Open while writing
              <Info text="Sites that were in the foreground during a writing session, and for how long. Host names only; the pages themselves are never read." />
            </Marginal>
          </div>
          <ul className="grid gap-1 text-sm tabular max-w-2xl">
            {a.sources.slice(0, 12).map((s) => (
              <li key={s.host} className="flex justify-between border-b border-rule py-1.5">
                <span className="font-mono text-xs">{s.host}</span>
                <span className="text-ink-soft">{fmtMinutes(s.dwell_minutes)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
        <div className="grid gap-1 content-start">
          <Marginal className="inline-flex items-center gap-1.5">
            Typing rhythm
            <Info text="How evenly the keys were pressed. People are irregular: the gap between keystrokes varies a lot and pauses come at odd moments. A script typing text in is unnaturally even. Trail reports the measurements; it does not decide." />
          </Marginal>
        </div>
        <Rhythm a={a} />
      </section>

      <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
        <div className="grid gap-1 content-start">
          <Marginal className="inline-flex items-center gap-1.5">
            AI-use declaration
            <Info text="A statement drafted from the record alone: sessions, pastes and their sources, and what survived. It says what the record shows and nothing more; the student edits and signs it." />
          </Marginal>
          <span className="text-xs text-ink-soft">Drafted from the record, in plain words.</span>
        </div>
        <div className="grid gap-4 max-w-2xl">
          <Sheet className="p-5">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{res.declaration}</pre>
          </Sheet>
          {declarationExtra}
        </div>
      </section>
    </article>
  );
}

function SessionList({ sessions }: { sessions: SessionSummary[] }) {
  return (
    <ol className="grid divide-y divide-rule border-t border-b border-rule text-sm tabular">
      {sessions.map((s, i) => (
        <li key={s.session} className="grid grid-cols-[2rem_1fr_auto] sm:grid-cols-[2rem_1fr_6rem_6rem_6rem_6rem] gap-x-4 py-2 items-baseline">
          <span className="font-mono text-xs text-ink-faint">{String(i + 1).padStart(2, '0')}</span>
          <span>
            {fmtDateTime(s.start)} <span className="text-ink-soft">· {editorName(s.editor)}</span>
          </span>
          <span className="text-ink-soft">{fmtMinutes(s.active_minutes)}</span>
          <span className="hidden sm:inline text-typed">{num(s.typed_chars)} typed</span>
          <span className={cx('hidden sm:inline', s.pasted_chars ? 'text-paste' : 'text-ink-faint')}>{num(s.pasted_chars)} pasted</span>
          <span className="hidden sm:inline text-ink-soft">{num(s.deleted_chars)} deleted</span>
        </li>
      ))}
    </ol>
  );
}

const AI_SITES_NOTE = 'These are facts about tabs and timing on this computer. They do not say what was on the screen, and Trail does not judge them.';

function AiSites({ ap }: { ap: AiPresence }) {
  if (!ap.ai_hosts.length && !ap.switches) {
    return (
      <div className="grid gap-2 max-w-2xl text-sm">
        <p>No AI site was in front during this essay.</p>
        <p className="text-ink-soft">{AI_SITES_NOTE}</p>
      </div>
    );
  }
  const sessionsWord = ap.sessions_total === 1 ? 'the only session' : `${ap.sessions_with_ai} of ${ap.sessions_total} sessions`;
  const withAi = ap.by_session.filter((s) => s.ai_hosts.length || s.switches);
  return (
    <div className="grid gap-4 max-w-2xl text-sm">
      <p>
        {ap.ai_hosts.map((h, i) => (
          <span key={h.host}>
            {i > 0 && (i === ap.ai_hosts.length - 1 ? ' and ' : ', ')}
            <span className="font-mono text-xs">{h.host}</span>
          </span>
        ))}{' '}
        {ap.ai_hosts.length === 1 ? 'was' : 'were'} in front for {fmtMinutes(ap.ai_minutes)} in total, during {sessionsWord}.
      </p>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 tabular">
        <div>
          <dt className="marginal inline-flex items-center gap-1">
            In front <Info text="Minutes an AI site's tab was the front tab of a focused browser window while a writing session was open. Time with the browser in the background is not counted." />
          </dt>
          <dd className="text-ink mt-0.5">
            {fmtMinutes(ap.ai_minutes)}
            {ap.ai_hosts.length > 1 && <span className="text-ink-soft"> · {ap.ai_hosts.map((h) => `${h.host} ${fmtMinutes(h.minutes)}`).join(', ')}</span>}
          </dd>
        </div>
        <div>
          <dt className="marginal inline-flex items-center gap-1">
            Returns to the document <Info text="Times the editor tab came back in front directly after an AI site's tab." />
          </dt>
          <dd className="text-ink mt-0.5">{num(ap.switches)}</dd>
        </div>
        <div>
          <dt className="marginal inline-flex items-center gap-1">
            Typed within a minute of returning <Info text="Characters in typing batches that began within 60 seconds of such a return, and how many separate runs of keystrokes (no pause over two seconds) began in that minute." />
          </dt>
          <dd className="text-ink mt-0.5">
            {num(ap.typed_after_switch_chars)} chars
            <span className="text-ink-soft">
              {' '}
              in {num(ap.bursts_after_switch)} run{ap.bursts_after_switch === 1 ? '' : 's'}
            </span>
          </dd>
        </div>
        <div>
          <dt className="marginal inline-flex items-center gap-1">
            Corrections after returning <Info text="Characters deleted divided by characters typed, inside those first 60 seconds after a return, next to the same ratio over the whole essay. Shown as a dash when nothing was typed in those windows." />
          </dt>
          <dd className="text-ink mt-0.5">
            {pct(ap.correction_ratio_after_switch, 1)} <span className="text-ink-soft">vs {pct(ap.correction_ratio_overall, 1)} overall</span>
          </dd>
        </div>
        <div>
          <dt className="marginal inline-flex items-center gap-1">
            Pastes from AI sites <Info text="Pastes whose text matched something copied on an AI site. Each one is listed under Pastes above." />
          </dt>
          <dd className="text-ink mt-0.5">{num(ap.ai_copy_paste_matches)}</dd>
        </div>
        <div>
          <dt className="marginal inline-flex items-center gap-1">
            Sessions <Info text="Writing sessions in which an AI site's tab was in front at least once, out of all sessions in this record." />
          </dt>
          <dd className="text-ink mt-0.5">
            {num(ap.sessions_with_ai)} <span className="text-ink-soft">of {num(ap.sessions_total)}</span>
          </dd>
        </div>
      </dl>
      {ap.sessions_total > 1 && withAi.length > 0 && (
        <ol className="grid divide-y divide-rule border-t border-b border-rule tabular">
          {withAi.map((s) => {
            const n = ap.by_session.indexOf(s) + 1;
            return (
              <li key={s.session} className="grid grid-cols-[2rem_1fr] sm:grid-cols-[2rem_1fr_auto] gap-x-4 py-2 items-baseline">
                <span className="font-mono text-xs text-ink-faint">{String(n).padStart(2, '0')}</span>
                <span>
                  {fmtDateTime(s.start)} <span className="text-ink-soft">· {s.ai_hosts.map((h) => `${h.host} ${fmtMinutes(h.minutes)}`).join(', ')}</span>
                </span>
                <span className="text-ink-soft sm:text-right">
                  {num(s.switches)} return{s.switches === 1 ? '' : 's'}, {num(s.typed_after_switch_chars)} chars within a minute
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-ink-soft">{AI_SITES_NOTE}</p>
    </div>
  );
}

function Rhythm({ a }: { a: Analysis }) {
  const r = a.regularity;
  const c = a.cadence;
  const measures = (
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-sm tabular max-w-2xl">
      <div>
        <dt className="marginal inline-flex items-center gap-1">
          Median gap <Info text="The middle value of the time between one keystroke and the next, in milliseconds. Most people sit between 80 and 250 ms." />
        </dt>
        <dd className="text-ink mt-0.5">{c.inter_key_median_ms ?? '—'} ms</dd>
      </div>
      <div>
        <dt className="marginal inline-flex items-center gap-1">
          Spread <Info text="How much the gaps between keystrokes vary (the interquartile range divided by the median). A person is well above 0.5; a script is close to 0." />
        </dt>
        <dd className="text-ink mt-0.5">{r.inter_key_spread ?? '—'}</dd>
      </div>
      <div>
        <dt className="marginal inline-flex items-center gap-1">
          Pauses <Info text="Gaps of more than two seconds between keystrokes inside a session: thinking, reading, checking a source." />
        </dt>
        <dd className="text-ink mt-0.5">{c.pauses}</dd>
      </div>
      <div>
        <dt className="marginal inline-flex items-center gap-1">
          Pace <Info text="Words added per minute of active writing." />
        </dt>
        <dd className="text-ink mt-0.5">{c.words_per_minute ? `${num(c.words_per_minute)} wpm` : '—'}</dd>
      </div>
    </dl>
  );
  if (r.flagged) {
    return (
      <div className="grid gap-4 text-sm max-w-2xl">
        <p>
          <span className="text-paste font-semibold">Unusually regular.</span> The typing rhythm in this record does not look like a person at a keyboard. This is what the record shows; a reader weighs it with everything else:
        </p>
        <ul className="grid gap-1.5 text-ink-soft">
          {r.signals.map((s) => (
            <li key={s.signal} className="grid grid-cols-[1fr_auto] gap-x-3 border-b border-rule pb-1.5">
              <span>
                <span className="font-mono text-xs text-ink">{s.signal}</span> <span className="tabular">({s.value} vs {s.threshold})</span>: {s.meaning}
              </span>
            </li>
          ))}
        </ul>
        {measures}
      </div>
    );
  }
  return (
    <div className="grid gap-4 max-w-2xl">
      <p className="text-sm text-ink-soft">
        <span className="text-typed font-semibold">Looks like a person at a keyboard.</span> {pct(c.correction_ratio)} of typed characters were later deleted
        {c.words_per_minute ? <>, about {num(c.words_per_minute)} words a minute while active</> : null}.{r.signals.length ? ' One observation is listed in the exported report; on its own it is not evidence of anything.' : ''}
      </p>
      {measures}
    </div>
  );
}

export default EssayView;
