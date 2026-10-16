// Public verifier: drop a .trail.tar.gz (or a raw events.jsonl); everything is checked in
// the browser (lib/verify.ts). Nothing is uploaded. For a professor who does not trust us.
// "Try it with a sample record" fetches a signed demo pack from this server; "Now tamper with
// it" changes one event in memory and re-runs, so the visitor sees the chain break.
//
// On the security document this is a certificate inspection (DESIGN-document.md §9): the
// three-step explainer as notes, a dashed drop zone, the pending seal while checks run, then a
// Certificate of origin engraved with the record's own hashes (serial = the record hash), the
// seal verified in foil or broken in red, and the checks rising in one by one.
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { data } from '../lib/data';
import type { VerifyCheck, VerifyResult } from '../lib/types';
import { tamperRecordFiles, unpackRecord, verifyRecordFiles, type TrustAnchor } from '../lib/verify';
import { demoPackUrl, loadDemoManifest, loadServerDemos } from '../lib/demo';
import { usePageTitle } from '../components/useAsync';
import { fmtDate, fmtDateTime, fmtTime } from '../components/format';
import { Button, Certificate, Chip, cx, Eyebrow, Icon, Note, Reveal, Seal, serialOf } from '../design/document';
import { ButtonLink, Section } from '../design/components';
import { copyText } from './shared';

type Tamper = NonNullable<ReturnType<typeof tamperRecordFiles>>;
type Sample = { id: string; name: string; files: Map<string, Uint8Array>; trust?: TrustAnchor };

/* ------------------------------------------------------------------ the record's own facts */

/** What the certificate prints about a record: read from the files, never from the server. */
type Facts = {
  /** the record hash: manifest.events_hash, or the chain head of a raw export */
  hash: string;
  /** further hashes for the microprint: chain head, events file, checkpoints */
  hashes: string[];
  title: string | null;
  first: string | null;
  last: string | null;
  typedShare: number | null;
  pastes: number | null;
  /** typed characters per active minute, sessions end to end: the certificate's guilloche */
  minutes: number[];
};

const dec = new TextDecoder();

function readEvents(bytes: Uint8Array): any[] {
  const text = dec.decode(bytes).trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const j = JSON.parse(text);
      return Array.isArray(j) ? j : [];
    } catch {
      return [];
    }
  }
  const out: any[] = [];
  for (const line of text.split('\n')) {
    try {
      if (line.trim()) out.push(JSON.parse(line));
    } catch {
      /* a broken line is the verifier's business, not the certificate's */
    }
  }
  return out;
}

function minutesOf(events: any[]): number[] {
  const mins: number[] = [];
  let start = 0;
  let offset = 0;
  for (const e of events) {
    const t = Date.parse(e?.ts ?? '');
    if (e?.kind === 'session.start' && !Number.isNaN(t)) start = t;
    if (e?.kind === 'session.end') offset = mins.length;
    if (e?.kind === 'insert' && e.data?.origin === 'typed' && typeof e.data.text === 'string' && start && !Number.isNaN(t)) {
      const m = offset + Math.max(0, Math.floor((t - start) / 60000));
      if (m > 2000) continue;
      while (mins.length <= m) mins.push(0);
      mins[m] += e.data.text.length;
    }
  }
  return mins.length > 2 ? mins : [];
}

function factsOf(files: Map<string, Uint8Array>): Facts | null {
  const names = [...files.keys()];
  const roots = new Set(names.map((n) => n.split('/')[0]));
  const root = roots.size === 1 && names.every((n) => n.includes('/')) ? [...roots][0] + '/' : '';
  const json = (rel: string) => {
    const b = files.get(root + rel);
    if (!b) return null;
    try {
      return JSON.parse(dec.decode(b));
    } catch {
      return null;
    }
  };
  const manifest = json('manifest.json') ?? {};
  const pack = json('pack.json');
  const evBytes = files.get(root + (manifest.events_file || 'events.jsonl'));
  const events = evBytes ? readEvents(evBytes) : [];
  const head = (events[events.length - 1]?.hash as string | undefined) ?? null;
  const hash = (typeof manifest.events_hash === 'string' && manifest.events_hash) || head;
  if (!hash) return null;
  const cps = files.get(root + (manifest.checkpoints_file || 'checkpoints.jsonl'));
  const cpHashes = cps ? readEvents(cps).map((c) => c?.hash).filter((h): h is string => typeof h === 'string') : [];
  const fileHashes = manifest.files && typeof manifest.files === 'object' ? (Object.values(manifest.files).filter((h) => typeof h === 'string') as string[]) : [];
  const times = events.map((e) => e?.ts).filter((t): t is string => typeof t === 'string').sort();
  const typed = pack?.analysis?.document?.typed_share;
  const pasteCount = pack?.analysis?.pastes?.count;
  return {
    hash,
    hashes: [head, ...cpHashes.slice(-2), ...fileHashes.slice(0, 2)].filter((h): h is string => !!h && h !== hash),
    title: (typeof pack?.title === 'string' && pack.title) || (typeof manifest.name === 'string' && manifest.name) || null,
    first: times.length ? times[0] : null,
    last: times.length ? times[times.length - 1] : null,
    typedShare: typeof typed === 'number' ? typed : null,
    pastes: typeof pasteCount === 'number' ? pasteCount : null,
    minutes: minutesOf(events),
  };
}

async function factsOfFile(f: File): Promise<Facts | null> {
  try {
    const bytes = new Uint8Array(await f.arrayBuffer());
    try {
      return factsOf(await unpackRecord(bytes));
    } catch {
      return factsOf(new Map([['events.jsonl', bytes]]));
    }
  } catch {
    return null;
  }
}

export default function Verify() {
  usePageTitle('Verify a record');
  const [params] = useSearchParams();
  const [drag, setDrag] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sample, setSample] = useState<Sample | null>(null);
  const [tamper, setTamper] = useState<Tamper | null>(null);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [runs, setRuns] = useState(0);

  const run = async (what: string, fn: () => Promise<void>) => {
    setErr(null);
    setBusy(what);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const checkFile = (f: File) =>
    run('file', async () => {
      setSample(null);
      setTamper(null);
      setFileName(f.name);
      setResult(null);
      setFacts(null);
      const [r, fx] = await Promise.all([data.verifyRecord(f), factsOfFile(f)]);
      setFacts(fx);
      setResult(r);
      setRuns((n) => n + 1);
    });

  const trySample = () =>
    run('sample', async () => {
      setTamper(null);
      setResult(null);
      let id = params.get('demo');
      if (!id) {
        const server = await loadServerDemos();
        id = server[0]?.id ?? (await loadDemoManifest().catch(() => []))[0]?.id ?? null;
      }
      if (!id) throw new Error('No sample records are published on this server yet. Drop a pack of your own instead.');
      let r: Response;
      try {
        r = await fetch(demoPackUrl(id), { credentials: 'omit' });
      } catch {
        throw new Error('Could not reach this server for the sample pack.');
      }
      if (!r.ok) throw new Error(r.status === 404 ? `This server has no sample pack called "${id}".` : `The sample pack could not be fetched (HTTP ${r.status}).`);
      const bytes = new Uint8Array(await r.arrayBuffer());
      const files = await unpackRecord(bytes);
      const trust = await data.trustAnchor();
      const name = `${id}.trail.tar.gz`;
      setSample({ id, name, files, trust });
      setFileName(name);
      setFacts(factsOf(files));
      setResult(await verifyRecordFiles(files, trust));
      setRuns((n) => n + 1);
    });

  const tamperSample = () =>
    run('tamper', async () => {
      if (!sample) return;
      const t = tamperRecordFiles(sample.files);
      if (!t) throw new Error('This pack has no event that could be altered.');
      setTamper(t);
      setFileName(`${sample.name} (altered in memory)`);
      setResult(await verifyRecordFiles(t.files, sample.trust));
      setRuns((n) => n + 1);
    });

  const restoreSample = () =>
    run('restore', async () => {
      if (!sample) return;
      setTamper(null);
      setFileName(sample.name);
      setResult(await verifyRecordFiles(sample.files, sample.trust));
      setRuns((n) => n + 1);
    });

  // Arriving from the demo page ("Verify this record") runs the sample straight away.
  const autoRan = useRef(false);
  useEffect(() => {
    if (params.get('demo') && !autoRan.current) {
      autoRan.current = true;
      trySample();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) checkFile(f);
  };

  const v = result && fileName ? verdict(result, !!tamper) : null;
  const busyLabel = busy === 'file' ? `Checking ${fileName}…` : busy === 'sample' ? 'Fetching and checking…' : busy === 'tamper' ? 'Altering…' : 'Restoring…';

  return (
    <>
      <Section
        className="mk-first"
        titleAs="h1"
        index="Nº 01"
        eyebrow="Verify a record"
        title="Check a Trail record without trusting Trail."
        lede={
          <>
            A student hands you a <span className="mono text-base">.trail.tar.gz</span>. This page opens it in your browser, recomputes every fingerprint and every link in the chain, and checks the signatures against Trail's public key and public log fetched from this site, never the copy inside the file. Nothing is uploaded.
          </>
        }
      >
        <Steps />
      </Section>

      <Section band index="02" eyebrow="Inspect" title="Inspect a record like a certificate." lede="Drop the file in. Every check runs in your browser; nothing is uploaded.">
        <div className="grid gap-10 min-w-0">
          <Note label="Record" watermark={false}>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              className="mk-drop"
              data-drag={drag ? '' : undefined}
            >
              <input type="file" accept=".gz,.tgz,.tar.gz,.jsonl,.json,application/gzip" className="sr-only" onChange={(e) => e.target.files?.[0] && checkFile(e.target.files[0])} />
              <Icon name="upload" size={28} className="text-guilloche-ink" />
              <span className="note-title">Or drop a record here, or click to choose one</span>
              <span className="text-sm text-ink-soft">.trail.tar.gz (full record) or events.jsonl (raw export). Checked in this browser, nothing uploaded.</span>
            </label>
            <div className="mk-btns">
              <Button variant={!sample || tamper ? 'primary' : 'secondary'} onClick={trySample} disabled={busy !== null}>
                {busy === 'sample' ? 'Fetching and checking…' : 'Try it with a sample record'}
              </Button>
              {sample && !tamper && (
                <Button variant="primary" icon="warning" onClick={tamperSample} disabled={busy !== null}>
                  {busy === 'tamper' ? 'Altering…' : 'Now tamper with it'}
                </Button>
              )}
              {v?.tone === 'bad' && !tamper && (
                <ButtonLink to={`mailto:hello@trail.app?subject=${encodeURIComponent(`A Trail record failed verification: ${fileName ?? ''}`)}`} variant="quiet" icon="warning">
                  Report this
                </ButtonLink>
              )}
            </div>
            <p className="text-sm text-ink-soft">The sample is one of the demo essays, signed by this server like any real pack.</p>
            {err && (
              <p role="alert" className="text-sm inline-flex items-start gap-2">
                <Icon name="warning" size={18} className="mt-0.5 text-seal shrink-0" />
                <span>{err}</span>
              </p>
            )}
          </Note>

          {busy && (
            <div className="mk-pending" role="status">
              <Seal state="pending" size={96} />
              <span className="mono text-sm text-ink-soft [overflow-wrap:anywhere]">{busyLabel}</span>
            </div>
          )}

          {result && fileName && !busy && v && (
            <Inspection key={runs} result={result} fileName={fileName} v={v} facts={facts} tamper={tamper} onRestore={restoreSample} busy={busy} />
          )}
        </div>
      </Section>
    </>
  );
}

/* ------------------------------------------------------------------ the inspection */

function Inspection({ result, fileName, v, facts, tamper, onRestore, busy }: { result: VerifyResult; fileName: string; v: Verdict; facts: Facts | null; tamper: Tamper | null; onRestore: () => void; busy: string | null }) {
  const s = result.summary;
  const n = result.checks.length;
  const passed = result.checks.filter((c) => c.status === 'PASS').length;
  const [zone, setZone] = useState<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const broken = v.tone === 'bad';
  const sealState = v.tone === 'ok' ? 'verified' : broken ? 'broken' : 'pending';
  const chipKind = v.tone === 'ok' ? 'signed' : broken ? 'seal' : 'mixed';
  const chipText = v.tone === 'ok' ? 'Signature valid' : broken ? (s?.brokenAt ? `Chain broken at event #${s.brokenAt.index + 1}` : 'Failed') : 'Partly checked';
  const failing = result.checks.find((c) => c.status === 'FAIL');

  const body = (
    <div className="mk-cert-body">
      <dl className="mk-dl">
        <div>
          <dt className="eyebrow">File</dt>
          <dd className="mono text-sm">{fileName}</dd>
        </div>
        {facts?.first && (
          <div>
            <dt className="eyebrow">Written</dt>
            <dd>
              {s ? `${s.sessions} session${s.sessions === 1 ? '' : 's'}, ` : ''}
              {fmtDate(facts.first)}
              {facts.last && fmtDate(facts.last) !== fmtDate(facts.first) ? ` to ${fmtDate(facts.last)}` : ''}
            </dd>
          </div>
        )}
        {facts?.typedShare != null && (
          <div>
            <dt className="eyebrow">Typed</dt>
            <dd className="text-typed">{Math.round(facts.typedShare * 100)}% of the final text</dd>
          </div>
        )}
        {facts?.pastes != null && (
          <div>
            <dt className="eyebrow">Pasted</dt>
            <dd className="text-paste">
              {facts.pastes} paste{facts.pastes === 1 ? '' : 's'}, each with its source
            </dd>
          </div>
        )}
        {s && (
          <div>
            <dt className="eyebrow">Record</dt>
            <dd className="tabular">
              {s.events.toLocaleString()} events · {s.checkpoints} signed checkpoint{s.checkpoints === 1 ? '' : 's'}
            </dd>
          </div>
        )}
        <div>
          <dt className="eyebrow">Checks</dt>
          <dd className={cx('tabular', broken && 'text-seal')}>
            {passed} of {n} passed{failing && broken ? `; failed: ${failing.plain || failing.name}` : ''}
          </dd>
        </div>
      </dl>
      <div className="mk-cert-seal">
        <Seal
          state={sealState}
          size={136}
          zone={zone}
          className={sealState === 'pending' ? 'mk-still' : undefined}
          ringText={sealState === 'pending' ? 'INTERNALLY INTACT · NOT SIGNED · ' : undefined}
          label={sealState === 'pending' ? 'Record internally intact; signatures not checked' : undefined}
        />
        <Chip kind={chipKind}>{chipText}</Chip>
      </div>
    </div>
  );

  const footer = facts ? (
    <>
      <span className="mk-hash mk-trunc">record {facts.hash}</span>
      <Button
        size="sm"
        variant="quiet"
        icon="copy"
        onClick={async () => {
          if (await copyText(facts.hash)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </>
  ) : undefined;

  return (
    <div className="grid gap-8 min-w-0">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-2 font-semibold" role="status">
        <Chip kind={v.tone === 'ok' ? 'typed' : broken ? 'seal' : 'mixed'}>{v.tone === 'ok' ? 'Verified' : broken ? 'Failed' : 'Partly checked'}</Chip>
        <span>{v.text}</span>
      </p>

      {tamper && (
        <Note tone="seal" label="Altered in memory" title={s?.brokenAt ? `Chain broken at event #${s.brokenAt.index + 1}` : `Event #${tamper.index + 1} altered`} watermark={false}>
          <p className="text-sm max-w-prose">
            We changed one letter in event <span className="mono">#{tamper.index + 1}</span> (<span className="mono">“{tamper.before.trim().slice(0, 24)}”</span> became <span className="mono">“{tamper.after.trim().slice(0, 24)}”</span>) and recomputed that event's own fingerprint, the way a careful forger would. The event looks fine on its own; the file's fingerprint and the link from the next event both give it away, and the check below names the exact spot.
          </p>
          <div>
            <Button variant="secondary" onClick={onRestore} disabled={busy !== null}>
              {busy === 'restore' ? 'Restoring…' : 'Put it back'}
            </Button>
          </div>
        </Note>
      )}

      <div className="mk-inspect">
        <div ref={setZone} className="min-w-0">
          {facts ? (
            <Certificate hash={facts.hash} hashes={facts.hashes} data={facts.minutes.length ? facts.minutes : undefined} label="Certificate of origin" title={facts.title ?? 'Writing record'} tone={broken ? 'seal' : undefined} footer={footer}>
              {body}
            </Certificate>
          ) : (
            <Note frame label="Certificate of origin" title="Writing record" tone={broken ? 'seal' : undefined}>
              {body}
            </Note>
          )}
        </div>
        <Note label="Checks" aside={<span className="mono text-xs text-ink-soft tabular">{passed} / {n}</span>} watermark={false}>
          <section aria-live="polite" aria-label="Checks" className="grid gap-4">
            <Reveal as="ol" className="mk-checks text-sm" stagger={60}>
              {result.checks.map((c, i) => (
                <CheckRow key={i} c={c} />
              ))}
            </Reveal>
            <p className="text-xs text-ink-soft">Verified means Trail's key signed these checkpoints, they are in the public log, and the record was not altered after any of them. A pack signed by any other key fails, however consistent its hashes are. It describes how the document was produced; it does not judge content, and it cannot see text retyped by hand.</p>
          </section>
        </Note>
      </div>
      {facts && <p className="mk-hash">Serial Nº {serialOf(facts.hash)} is the first eight digits of this record's hash; the hashes engraved around the certificate are its own.</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ explainer */

function Steps() {
  const steps: { n: string; title: string; body: string; art: JSX.Element }[] = [
    {
      n: '1',
      title: 'Every event is hashed and chained',
      body: 'Each keystroke burst, paste or deletion gets a fingerprint that includes the fingerprint of the event before it. Change one, and every link after it breaks.',
      art: <ChainArt />,
    },
    {
      n: '2',
      title: 'Every 10 minutes the chain head is signed',
      body: "The extension sends only the last fingerprint (64 characters, no text). Trail's key signs it with the time and appends it to a public, append-only log.",
      art: <SignArt />,
    },
    {
      n: '3',
      title: 'This page recomputes all of it, here',
      body: "Your browser rebuilds every fingerprint and link, then compares the signatures with Trail's key and the log fetched from this site. The file never leaves your machine.",
      art: <CheckArt />,
    },
  ];
  return (
    <Reveal as="ol" className="mk-grid-3">
      {steps.map((s) => (
        <Note key={s.n} as="li" label={`Step 0${s.n}`} title={s.title}>
          <div className="h-20 text-ink" aria-hidden>
            {s.art}
          </div>
          <p className="text-sm text-ink-soft">{s.body}</p>
        </Note>
      ))}
    </Reveal>
  );
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function ChainArt() {
  const boxes = [0, 1, 2, 3];
  return (
    <svg viewBox="0 0 240 80" className="w-full h-full" >
      {boxes.map((i) => {
        const x = 8 + i * 60;
        return (
          <g key={i}>
            <rect x={x} y={22} width={44} height={36} {...stroke} />
            <text x={x + 6} y={38} fontSize="9" fontFamily="var(--font-mono)" fill="currentColor">
              ev {i + 1}
            </text>
            <text x={x + 6} y={51} fontSize="8" fontFamily="var(--font-mono)" fill="var(--signed)">
              #{['a41f', '9c02', '77be', 'e3d0'][i]}
            </text>
            {i < 3 && (
              <g stroke="var(--guilloche)">
                <path d={`M${x + 44} 40 h12`} {...stroke} stroke="var(--guilloche)" />
                <path d={`M${x + 52} 36 l4 4 -4 4`} {...stroke} stroke="var(--guilloche)" />
              </g>
            )}
          </g>
        );
      })}
      <text x={8} y={72} fontSize="8" fontFamily="var(--font-mono)" fill="var(--ink-soft)">
        each fingerprint includes the previous one
      </text>
    </svg>
  );
}

function SignArt() {
  return (
    <svg viewBox="0 0 240 80" className="w-full h-full">
      <circle cx={30} cy={38} r={18} {...stroke} />
      <path d="M30 26 v12 l8 5" {...stroke} />
      <text x={12} y={72} fontSize="8" fontFamily="var(--font-mono)" fill="var(--ink-soft)">
        every 10 min
      </text>
      <path d="M56 38 h22" {...stroke} stroke="var(--guilloche)" />
      <path d="M74 34 l4 4 -4 4" {...stroke} stroke="var(--guilloche)" />
      <rect x={86} y={26} width={54} height={24} {...stroke} />
      <text x={92} y={41} fontSize="8" fontFamily="var(--font-mono)" fill="var(--signed)">
        #e3d0 14:02
      </text>
      <path d="M113 50 v10" {...stroke} />
      <path d="M100 66 c4 -6 12 -8 16 -2 c4 6 12 4 14 -2" {...stroke} stroke="var(--guilloche)" />
      <text x={94} y={78} fontSize="8" fontFamily="var(--font-mono)" fill="var(--ink-soft)">
        signed by Trail
      </text>
      <path d="M144 38 h20" {...stroke} stroke="var(--guilloche)" />
      <path d="M160 34 l4 4 -4 4" {...stroke} stroke="var(--guilloche)" />
      <rect x={172} y={14} width={60} height={50} {...stroke} />
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={178} y1={24 + i * 10} x2={i === 3 ? 206 : 226} y2={24 + i * 10} stroke="currentColor" strokeWidth={1.5} opacity={i === 3 ? 1 : 0.5} />
      ))}
      <text x={174} y={76} fontSize="8" fontFamily="var(--font-mono)" fill="var(--ink-soft)">
        public log
      </text>
    </svg>
  );
}

function CheckArt() {
  return (
    <svg viewBox="0 0 240 80" className="w-full h-full">
      <rect x={8} y={8} width={150} height={64} {...stroke} />
      <line x1={8} y1={22} x2={158} y2={22} stroke="currentColor" strokeWidth={1.5} />
      <circle cx={16} cy={15} r={2.5} fill="currentColor" />
      <circle cx={25} cy={15} r={2.5} fill="currentColor" />
      {['fingerprints', 'chain links', "Trail's key", 'public log'].map((t, i) => (
        <g key={t}>
          <path d={`M18 ${34 + i * 10} l3 3 5 -6`} {...stroke} stroke="var(--typed)" />
          <text x={32} y={37 + i * 10} fontSize="8" fontFamily="var(--font-mono)" fill="currentColor">
            {t}
          </text>
        </g>
      ))}
      <text x={172} y={26} fontSize="8" fontFamily="var(--font-mono)" fill="var(--ink-soft)">
        this site
      </text>
      <path d="M184 40 v-6 a6 6 0 0 1 12 0 v6" {...stroke} />
      <rect x={180} y={40} width={20} height={14} {...stroke} />
      <path d="M170 47 h-8" {...stroke} stroke="var(--guilloche)" />
      <path d="M166 43 l-4 4 4 4" {...stroke} stroke="var(--guilloche)" />
      <text x={172} y={70} fontSize="8" fontFamily="var(--font-mono)" fill="var(--ink-soft)">
        key + log
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ results */

type Verdict = { text: string; tone: 'ok' | 'bad' | 'partial' };

function verdict(r: VerifyResult, tampered: boolean): Verdict {
  const s = r.summary;
  if (r.ok) {
    if (s?.signedAt.length) {
      const times = s.signedAt.map((t) => fmtTime(t));
      const shown = times.length > 6 ? `${times.slice(0, 5).join(', ')} and ${times.length - 5} more` : times.join(', ');
      return { text: `This record is intact and was signed by Trail at ${shown}.`, tone: 'ok' };
    }
    const skipped = r.checks.some((c) => c.status === 'SKIP' && /key|log|signature/.test(c.name));
    if (skipped) return { text: 'This record is internally intact. Its signatures could not be checked from here, so it only shows the file agrees with itself.', tone: 'partial' };
    return { text: 'This record is internally intact, but carries no Trail signatures, so it only shows the file agrees with itself.', tone: 'partial' };
  }
  const key = r.checks.find((c) => c.name === "signed by Trail's key" && c.status === 'FAIL');
  if (key && !tampered) return { text: "This record was not signed by Trail's key. It could have been made by anyone.", tone: 'bad' };
  if (s?.brokenAt) return { text: `This record was altered at event #${s.brokenAt.index + 1}${s.brokenAt.ts ? ` (${fmtDateTime(s.brokenAt.ts)})` : ''}: the chain breaks there, and nothing after it can be trusted.`, tone: 'bad' };
  const n = r.checks.filter((c) => c.status === 'FAIL').length;
  return { text: `This record failed ${n} check${n === 1 ? '' : 's'}.`, tone: 'bad' };
}

function CheckRow({ c }: { c: VerifyCheck }) {
  const mark =
    c.status === 'PASS' ? (
      <Icon name="check" label="Passed" size={18} className="text-typed" />
    ) : c.status === 'FAIL' ? (
      <Icon name="cross" label="Failed" size={18} className="text-seal" />
    ) : (
      <span role="img" aria-label="Skipped" className="inline-block w-[18px] text-center mono text-ink-faint leading-[18px]">
        —
      </span>
    );
  const sub = [c.plain ? c.name : null, c.status === 'SKIP' ? 'skipped' : null].filter(Boolean).join(' · ');
  return (
    <li>
      <span className="mt-px">{mark}</span>
      <span className="grid gap-0.5 min-w-0">
        <span className={cx(c.status === 'SKIP' && 'text-ink-soft')}>{c.plain || c.name}</span>
        {(sub || c.detail) && (
          <span className="mono text-xs text-ink-soft [overflow-wrap:anywhere]">
            {sub}
            {c.detail && <span className="block">{c.detail}</span>}
          </span>
        )}
      </span>
    </li>
  );
}
