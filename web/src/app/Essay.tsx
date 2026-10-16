import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { data, download, safeName } from '../lib/data';
import { useAsync, usePageTitle } from '../components/useAsync';
import { useMe } from '../components/AppShell';
import { Button, ButtonLink, Caption, ErrorNote, Icon, Loading, Modal, Note, TextField } from '../components/ui';
import { editorName } from '../components/format';
import { copyText, useEssayAnalysis } from './shared';
import { EssayView } from './EssayView';

export default function EssayPage() {
  const { id = '' } = useParams();
  const docId = decodeURIComponent(id);
  const [params] = useSearchParams();
  const first = params.get('first') === '1';
  const nav = useNavigate();
  const { me, reload } = useMe();
  const essays = useAsync(() => data.essays(), []);
  const events = useAsync(() => data.essayEvents(docId), [docId]);
  // the seal is verified only when the record has signed checkpoints; pending until then
  const checkpoints = useAsync(() => data.checkpoints(docId).catch(() => []), [docId]);
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
      onClose={() => nav('/app')}
      checkpoints={checkpoints.status === 'ready' ? checkpoints.value.length : 0}
      actions={res ? <ExportDialogButton docId={docId} title={title} declaration={res.declaration} entitled={me.entitled} /> : null}
      banner={first ? <>This is your first replay: that paragraph, exactly as you wrote it. Keep writing and this page keeps growing.{me.billing.freeAccess ? '' : ' Your 14-day trial starts now.'}</> : null}
      declarationExtra={<AiNoteDialogButton docId={docId} onAdded={events.reload} />}
      empty={
        <Note
          as="section"
          label={
            <span className="inline-flex items-center gap-2">
              <Icon name="document" size={16} /> Record
            </span>
          }
          className="max-w-2xl"
        >
          <h1 className="note-title">Nothing recorded</h1>
          <p className="text-sm">Nothing recorded for this document yet. Open it in the editor and write a line; the replay appears here.</p>
          <div>
            <ButtonLink to="/app" icon="arrow" className="[&>svg:first-child]:rotate-180">
              Back to essays
            </ButtonLink>
          </div>
        </Note>
      }
    />
  );
}

/** "Sign and export" opens a modal note that lists every export with its hint; the evidence pack asks once before sending. */
function ExportDialogButton({ docId, title, declaration, entitled }: { docId: string; title: string; declaration: string; entitled: boolean }) {
  const [open, setOpen] = useState(false);
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
  const close = () => {
    setOpen(false);
    setConfirmPack(false);
  };
  return (
    <>
      <Button variant="primary" size="lg" icon="signature" onClick={() => setOpen(true)}>
        Sign and export
      </Button>
      {msg && !open && <Caption role="status">{msg}</Caption>}
      {open && (
        <Modal
          title={confirmPack ? 'Build the evidence pack' : 'Export and sign'}
          label={
            <span className="inline-flex items-center gap-2">
              <Icon name="upload" size={16} /> Export
            </span>
          }
          onClose={close}
          width={600}
          actions={
            confirmPack ? (
              <>
                <Button variant="quiet" onClick={() => setConfirmPack(false)} disabled={busy !== null}>
                  Back
                </Button>
                <Button
                  ring
                  variant="primary"
                  disabled={busy !== null}
                  onClick={() =>
                    run('record', async () => {
                      const blob = await data.buildPack(docId, 'record', { title });
                      download(blob, `${safeName(title)}.trail.tar.gz`);
                      setConfirmPack(false);
                      setMsg('Pack built and downloaded.');
                    })
                  }
                >
                  {busy === 'record' ? 'Building…' : 'Build the pack'}
                </Button>
              </>
            ) : (
              <Button ring variant="secondary" onClick={close}>
                Done
              </Button>
            )
          }
        >
          {confirmPack ? (
            <p className="text-sm text-ink-soft">
              To sign the pack, this essay's record is sent to Trail <em>once</em>, built in memory, and returned as a .tar.gz. It is not stored or logged. Anyone can check the result at <span className="font-mono">/verify</span>.
            </p>
          ) : (
            <ul className="grid list-none m-0 p-0">
              <ExportRow hint="Signed .tar.gz a professor can check at /verify" onClick={() => (entitled ? setConfirmPack(true) : setMsg('Packs need an active trial or plan. Raw export below always works.'))}>
                Evidence pack
              </ExportRow>
              <ExportRow
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
              </ExportRow>
              <ExportRow hint="Every event as JSON lines, built in your browser, never locked" disabled={busy !== null} onClick={() => run('json', async () => download(await data.exportJson(docId), `${safeName(title)}-events.jsonl`))}>
                {busy === 'json' ? 'Exporting…' : 'Raw events (.jsonl)'}
              </ExportRow>
              <ExportRow hint="The declaration text, to paste into your submission" onClick={() => run('copy', async () => setMsg((await copyText(declaration)) ? 'Declaration copied.' : 'Could not copy; select the text in the declaration window instead.'))}>
                Copy declaration
              </ExportRow>
              <ExportRow
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
              </ExportRow>
            </ul>
          )}
          {msg && <Caption role="status">{msg}</Caption>}
        </Modal>
      )}
    </>
  );
}

function ExportRow({ children, hint, onClick, disabled }: { children: ReactNode; hint: string; onClick: () => void; disabled?: boolean }) {
  return (
    <li className="grid sm:grid-cols-[13rem_minmax(0,1fr)] gap-x-5 gap-y-2 items-center py-3 border-t border-rule first:border-t-0">
      <Button size="sm" onClick={onClick} disabled={disabled} className="justify-start">
        {children}
      </Button>
      <span className="text-sm text-ink-soft">{hint}</span>
    </li>
  );
}

/** "Add an AI-use note" opens a modal note with two fields; the note goes into the record and the declaration. */
function AiNoteDialogButton({ docId, onAdded }: { docId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tool.trim() || !note.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await data.addAiNote(docId, tool.trim(), note.trim());
      setTool('');
      setNote('');
      setOpen(false);
      setMsg('Added to the record. The declaration now includes it.');
      onAdded();
    } catch (error) {
      setErr((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        size="lg"
        onClick={() => {
          setMsg(null);
          setOpen(true);
        }}
      >
        Add an AI-use note
      </Button>
      {msg && <Caption role="status">{msg}</Caption>}
      {open && (
        <Modal
          title="Add an AI-use note"
          label={
            <span className="inline-flex items-center gap-2">
              <Icon name="document" size={16} /> AI-use note
            </span>
          }
          onClose={() => setOpen(false)}
          width={560}
        >
          <form onSubmit={submit} className="grid gap-5">
            <p className="text-sm text-ink-soft">Used an AI tool in a way the record cannot see (brainstorming, an outline, a retyped suggestion)? Say so here. It is added to the record and to the declaration, in your words.</p>
            <TextField id="ai-tool" label="Tool" value={tool} onChange={(e) => setTool(e.target.value)} placeholder="ChatGPT" maxLength={60} />
            <TextField id="ai-note" label="What you used it for" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Brainstormed three possible thesis statements" maxLength={300} />
            {err && (
              <p role="alert" className="text-sm text-seal">
                {err}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <Button variant="quiet" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" ring variant="primary" disabled={busy || !tool.trim() || !note.trim()}>
                {busy ? 'Adding…' : 'Add note'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
