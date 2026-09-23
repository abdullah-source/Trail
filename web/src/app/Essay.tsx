import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { data, download, safeName } from '../lib/data';
import { useAsync, usePageTitle } from '../components/useAsync';
import { useMe } from '../components/AppShell';
import { Button, ErrorNote, Field, Loading, Rule, Sheet, inputCls } from '../components/ui';
import { editorName } from '../components/format';
import { copyText, useEssayAnalysis } from './shared';
import { EssayView } from './EssayView';

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

  return (
    <EssayView
      events={events.value}
      title={title}
      editorLabel={essay ? editorName(essay.editor) : 'Essay'}
      autoplay={first}
      actions={res ? <ExportMenu docId={docId} title={title} declaration={res.declaration} entitled={me.entitled} /> : null}
      banner={
        first ? (
          <p className="border border-typed/40 bg-typed/5 rounded-lg px-4 py-3 text-sm max-w-2xl" role="status">
            This is your first replay: that paragraph, exactly as you wrote it. Keep writing and this page keeps growing.{me.billing.freeAccess ? '' : ' Your 14-day trial starts now.'}
          </p>
        ) : null
      }
      declarationExtra={<AiNoteForm docId={docId} onAdded={events.reload} />}
      empty={
        <div className="grid gap-4 max-w-xl">
          <h1 className="text-2xl">Nothing recorded for this document yet.</h1>
          <p className="text-ink-soft">
            Open it in the editor and write a line; the replay appears here.{' '}
            <Link to="/app" className="link">
              Back to essays
            </Link>
          </p>
        </div>
      }
    />
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
      <summary className="list-none cursor-pointer inline-flex items-center justify-center h-10 px-3 gap-2 rounded-md border border-rule-strong hover:border-ink text-sm font-semibold select-none" aria-label="Export and sign">
        Export
        <span aria-hidden className="font-mono text-ink-soft">▾</span>
      </summary>
      <div className="absolute right-0 mt-2 w-80 z-20">
        <Sheet className="p-2 grid gap-1 text-sm">
          {confirmPack ? (
            <div className="p-2 grid gap-3">
              <p className="text-ink-soft text-xs leading-relaxed">
                To sign the pack, this essay's record is sent to Trail <em>once</em>, built in memory, and returned as a .tar.gz. It is not stored or logged. Anyone can check the result at <span className="font-mono">/verify</span>.
              </p>
              <div className="flex gap-2">
                <Button
                  disabled={busy !== null}
                  onClick={() =>
                    run('record', async () => {
                      const blob = await data.buildPack(docId, 'record', { title });
                      download(blob, `${safeName(title)}.trail.tar.gz`);
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
              <MenuItem hint="Signed .tar.gz a professor can check at /verify" onClick={() => (entitled ? setConfirmPack(true) : setMsg('Packs need an active trial or plan. Raw export below always works.'))}>
                Evidence pack
              </MenuItem>
              <MenuItem
                hint="One readable page with the replay stills and declaration"
                disabled={busy !== null}
                onClick={() =>
                  run('html', async () => {
                    if (!entitled) throw new Error('The signed report needs an active trial or plan. Raw export always works.');
                    download(await data.buildPack(docId, 'html', { title }), `${safeName(title)}-report.html`);
                  })
                }
              >
                {busy === 'html' ? 'Building…' : 'Report (.html)'}
              </MenuItem>
              <MenuItem hint="Every event as JSON lines, built in your browser, never locked" disabled={busy !== null} onClick={() => run('json', async () => download(await data.exportJson(docId), `${safeName(title)}-events.jsonl`))}>
                {busy === 'json' ? 'Exporting…' : 'Raw events (.jsonl)'}
              </MenuItem>
              <MenuItem hint="The declaration text, to paste into your submission" onClick={() => run('copy', async () => setMsg((await copyText(declaration)) ? 'Declaration copied.' : 'Could not copy; select the text below instead.'))}>
                Copy declaration
              </MenuItem>
              <MenuItem
                hint="Get the chain head signed and logged right now instead of at the next 10-minute tick"
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

function MenuItem({ children, hint, onClick, disabled }: { children: React.ReactNode; hint?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="text-left px-3 py-2 rounded hover:bg-paper disabled:opacity-50 transition-colors duration-150 grid gap-0.5">
      <span>{children}</span>
      {hint && <span className="text-xs text-ink-soft">{hint}</span>}
    </button>
  );
}

function AiNoteForm({ docId, onAdded }: { docId: string; onAdded: () => void }) {
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
      setMsg('Added to the record. The declaration above now includes it.');
      onAdded();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
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
    </>
  );
}
