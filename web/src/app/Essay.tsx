import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { data, download, safeName } from '../lib/data';
import type { Analysis, SessionSummary } from '../lib/types';
import { useAsync, usePageTitle } from '../components/useAsync';
import { useMe } from '../components/AppShell';
import { ReplayPlayer } from '../components/ReplayPlayer';
import { PasteList, ProvenanceStrip } from '../design/Provenance';
import { Button, ErrorNote, Field, Loading, Marginal, Rule, Sheet, StatTile, cx, inputCls } from '../components/ui';
import { editorName, fmtDateLong, fmtDateTime, fmtMinutes, num, pct } from '../components/format';
import { copyText, useEssayAnalysis } from './shared';

export default function EssayPage() {
  const { id = '' } = useParams();
  const docId = decodeURIComponent(id);
  const [params] = useSearchParams();
  const first = params.get('first') === '1';
  const { me, reload } = useMe();
  const essays = useAsync(() => data.essays(), []);
  const events = useAsync(() => data.essayEvents(docId), [docId]);
  const essay = essays.status === 'ready' ? essays.value.find((e) => e.id === docId) : undefined;
  const title = essay?.title || (essay ? `Untitled ${editorName(essay.editor)} document` : 'Essay');
  usePageTitle(title);
  const res = useEssayAnalysis(events.status === 'ready' ? events.value : null);

  // The trial clock starts at the first replay, not at signup (DECISIONS §6).
  const started = useRef(false);
  useEffect(() => {
    if (res && !me.trialStartedAt && !started.current) {
      started.current = true;
      data.startTrial().then(reload).catch(() => undefined);
    }
  }, [res, me.trialStartedAt, reload]);

  if (events.status === 'loading') return <Loading label="Replaying from the extension" />;
  if (events.status === 'error') return <ErrorNote error={events.error} retry={events.reload} />;
  if (!res) {
    return (
      <div className="grid gap-4 max-w-xl">
        <h1 className="text-2xl">Nothing recorded for this document yet.</h1>
        <p className="text-ink-soft">
          Open it in the editor and write a line; the replay appears here. <Link to="/app" className="link">Back to essays</Link>
        </p>
      </div>
    );
  }
  const { analysis: a } = res;
  const evs = events.value;

  return (
    <article className="grid gap-10">
      <header className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-4 items-end">
        <div className="grid gap-1">
          <Marginal>{essay ? editorName(essay.editor) : 'Essay'}</Marginal>
          <span className="font-mono text-xs text-ink-soft tabular">
            {fmtDateLong(a.first_event)} → {fmtDateLong(a.last_event)}
          </span>
        </div>
        <div className="flex flex-wrap items-start gap-4">
          <h1 className="text-3xl sm:text-4xl flex-1 min-w-[16rem]">{title}</h1>
          <ExportMenu docId={docId} title={title} declaration={res.declaration} entitled={me.entitled} />
        </div>
      </header>

      {first && (
        <p className="border border-typed/40 bg-typed/5 rounded-lg px-4 py-3 text-sm max-w-2xl" role="status">
          This is your first replay: that paragraph, exactly as you wrote it. Keep writing and this page keeps growing.{me.billing.freeAccess ? '' : ' Your 14-day trial starts now.'}
        </p>
      )}

      <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
        <div className="grid gap-1 content-start">
          <Marginal>Replay</Marginal>
          <span className="text-xs text-ink-soft">Space or K to play and pause.</span>
        </div>
        <ReplayPlayer events={evs} title={null} autoplay={first} />
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-6">
        <StatTile label="Final length" value={num(a.document.final_words)} detail={`words, ${a.document.final_lines} lines`} />
        <StatTile label="Typed" value={pct(a.document.typed_share)} detail="of the final text" tone="typed" />
        <StatTile label="Pasted" value={pct(a.pastes.share_of_final_document)} detail={`${a.pastes.count} paste${a.pastes.count === 1 ? '' : 's'}, ${a.pastes.ai_pastes} from AI tools`} tone={a.pastes.count ? 'paste' : undefined} />
        <StatTile label="Active time" value={fmtMinutes(a.cadence.active_minutes)} detail={`over ${a.sessions.length} session${a.sessions.length === 1 ? '' : 's'}`} />
        <StatTile label="Deleted" value={num(a.cadence.deleted_chars)} detail="characters removed while writing" />
      </section>

      <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
        <Marginal>Where each line came from</Marginal>
        <ProvenanceStrip lines={res.lines} />
      </section>

      {a.document.unobserved_chars > 0 && (
        <p className="text-sm text-ink-soft max-w-2xl">
          {num(a.document.unobserved_chars)} characters appeared while the recorder was not watching ({a.document.resyncs} resyncs). They are shown as unobserved and make no claim either way.
        </p>
      )}

      <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
        <Marginal>Sessions</Marginal>
        <SessionList sessions={a.sessions} />
      </section>

      <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
        <Marginal>Pastes</Marginal>
        <PasteList pastes={a.pastes.items} empty="No pastes. Every character was typed." />
      </section>

      {a.sources.length > 0 && (
        <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
          <Marginal>Open while writing</Marginal>
          <ul className="grid gap-1 text-sm tabular">
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
        <Marginal>Typing rhythm</Marginal>
        <Rhythm a={a} />
      </section>

      <section className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-3">
        <Marginal>AI-use declaration</Marginal>
        <DeclarationPanel docId={docId} text={res.declaration} onAdded={events.reload} />
      </section>
    </article>
  );
}

function ExportMenu({ docId, title, declaration, entitled }: { docId: string; title: string; declaration: string; entitled: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmPack, setConfirmPack] = useState(false);
  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <details className="relative">
      <summary className="list-none cursor-pointer inline-flex items-center justify-center w-10 h-10 rounded-md border border-rule-strong hover:border-ink font-mono text-lg leading-none select-none" aria-label="Essay menu">
        …
      </summary>
      <div className="absolute right-0 mt-2 w-80 z-20">
        <Sheet className="p-2 grid gap-1 text-sm">
          {confirmPack ? (
            <div className="p-2 grid gap-3">
              <p className="text-ink-soft text-xs leading-relaxed">
                To sign the pack, this essay's record is sent to Longhand <em>once</em>, built in memory, and returned as a .tar.gz. It is not stored or logged. Anyone can check the result at <span className="font-mono">/verify</span>.
              </p>
              <div className="flex gap-2">
                <Button
                  disabled={busy !== null}
                  onClick={() =>
                    run('record', async () => {
                      const blob = await data.buildPack(docId, 'record', { title });
                      download(blob, `${safeName(title)}.longhand.tar.gz`);
                      setConfirmPack(false);
                    })
                  }
                >
                  {busy === 'record' ? 'Building…' : 'Build the pack'}
                </Button>
                <Button variant="quiet" onClick={() => setConfirmPack(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <MenuItem onClick={() => (entitled ? setConfirmPack(true) : setMsg('Packs need an active trial or plan. Raw export below always works.'))}>
                Export evidence pack (.tar.gz)
              </MenuItem>
              <MenuItem
                disabled={busy !== null}
                onClick={() =>
                  run('html', async () => {
                    if (!entitled) throw new Error('The signed report needs an active trial or plan. Raw export always works.');
                    download(await data.buildPack(docId, 'html', { title }), `${safeName(title)}-report.html`);
                  })
                }
              >
                {busy === 'html' ? 'Building…' : 'Export report (.html)'}
              </MenuItem>
              <MenuItem disabled={busy !== null} onClick={() => run('json', async () => download(await data.exportJson(docId), `${safeName(title)}-events.jsonl`))}>
                {busy === 'json' ? 'Exporting…' : 'Export raw events (.jsonl)'}
              </MenuItem>
              <MenuItem onClick={() => run('copy', async () => setMsg((await copyText(declaration)) ? 'Declaration copied.' : 'Could not copy; select the text below instead.'))}>Copy declaration</MenuItem>
              <MenuItem
                disabled={busy !== null}
                onClick={() =>
                  run('cp', async () => {
                    const r = await data.signCheckpoint(docId);
                    setMsg(r.created ? 'Checkpoint signed.' : 'Nothing new to sign since the last checkpoint.');
                  })
                }
              >
                {busy === 'cp' ? 'Signing…' : 'Sign a checkpoint now'}
              </MenuItem>
            </>
          )}
          {msg && (
            <p role="status" className="px-2 py-1 text-xs text-ink-soft">
              {msg}
            </p>
          )}
        </Sheet>
      </div>
    </details>
  );
}

function MenuItem({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="text-left px-3 py-2 rounded hover:bg-paper disabled:opacity-50 transition-colors duration-150">
      {children}
    </button>
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

function Rhythm({ a }: { a: Analysis }) {
  const r = a.regularity;
  const c = a.cadence;
  if (r.flagged) {
    return (
      <div className="grid gap-2 text-sm max-w-2xl">
        <p>The typing rhythm in this record is unusually regular. This is what the record shows; a reader weighs it with everything else:</p>
        <ul className="list-disc pl-5 text-ink-soft">
          {r.signals.map((s) => (
            <li key={s.signal}>
              <span className="font-mono text-xs">{s.signal}</span> ({s.value} vs {s.threshold}): {s.meaning}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <p className="text-sm max-w-2xl text-ink-soft">
      Looks like a person at a keyboard: median <span className="text-ink tabular">{c.inter_key_median_ms ?? '—'} ms</span> between keys, spread <span className="text-ink tabular">{r.inter_key_spread ?? '—'}</span>, {c.pauses} pause{c.pauses === 1 ? '' : 's'} over two seconds, {pct(c.correction_ratio)} of typed characters later deleted
      {c.words_per_minute ? <>, about {num(c.words_per_minute)} words a minute while active</> : null}.
      {r.signals.length ? ' One observation is listed in the exported report; on its own it is not evidence of anything.' : ''}
    </p>
  );
}

function DeclarationPanel({ docId, text, onAdded }: { docId: string; text: string; onAdded: () => void }) {
  const [tool, setTool] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tool.trim() || !note.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await data.addAiNote(docId, tool.trim(), note.trim());
      setTool('');
      setNote('');
      setMsg('Added to the record. The declaration below now includes it.');
      onAdded();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-4 max-w-2xl">
      <Sheet className="p-5">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{text}</pre>
      </Sheet>
      <Rule />
      <form onSubmit={submit} className="grid gap-3">
        <p className="text-sm text-ink-soft">Used an AI tool in a way the record cannot see (brainstorming, an outline, a retyped suggestion)? Say so here. It is added to the record and to the declaration, in your words.</p>
        <div className="grid sm:grid-cols-[10rem_1fr] gap-3">
          <Field label="Tool" id="ai-tool">
            <input id="ai-tool" className={inputCls} value={tool} onChange={(e) => setTool(e.target.value)} placeholder="ChatGPT" maxLength={60} />
          </Field>
          <Field label="What you used it for" id="ai-note">
            <input id="ai-note" className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Brainstormed three possible thesis statements" maxLength={300} />
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="secondary" disabled={busy || !tool.trim() || !note.trim()}>
            {busy ? 'Adding…' : 'Add AI-use note'}
          </Button>
          {msg && (
            <span role="status" className="text-xs text-ink-soft">
              {msg}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
