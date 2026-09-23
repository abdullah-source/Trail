// Public verifier: drop a .trail.tar.gz (or a raw events.jsonl); everything is checked in
// the browser (lib/verify.ts). Nothing is uploaded. For a professor who does not trust us.
// "Try it with a sample record" fetches a signed demo pack from this server; "Now tamper with
// it" changes one event in memory and re-runs, so the visitor sees the chain break.
import { useState, type DragEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { data } from '../lib/data';
import type { VerifyCheck, VerifyResult } from '../lib/types';
import { tamperRecordFiles, unpackRecord, verifyRecordFiles, type TrustAnchor } from '../lib/verify';
import { demoPackUrl, loadDemoManifest, loadServerDemos } from '../lib/demo';
import { usePageTitle } from '../components/useAsync';
import { Button, Marginal, Sheet, cx } from '../components/ui';
import { fmtDateTime, fmtTime } from '../components/format';
import { PublicShell } from './shared';

type Tamper = NonNullable<ReturnType<typeof tamperRecordFiles>>;
type Sample = { id: string; name: string; files: Map<string, Uint8Array>; trust?: TrustAnchor };

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
      setResult(await data.verifyRecord(f));
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
      setResult(await verifyRecordFiles(files, trust));
    });

  const tamperSample = () =>
    run('tamper', async () => {
      if (!sample) return;
      const t = tamperRecordFiles(sample.files);
      if (!t) throw new Error('This pack has no event that could be altered.');
      setTamper(t);
      setFileName(`${sample.name} (altered in memory)`);
      setResult(await verifyRecordFiles(t.files, sample.trust));
    });

  const restoreSample = () =>
    run('restore', async () => {
      if (!sample) return;
      setTamper(null);
      setFileName(sample.name);
      setResult(await verifyRecordFiles(sample.files, sample.trust));
    });

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) checkFile(f);
  };

  return (
    <PublicShell wide>
      <div className="grid gap-10 max-w-4xl">
        <header className="grid gap-3">
          <Marginal>Verify a record</Marginal>
          <h1 className="text-3xl sm:text-4xl">Check a Trail record without trusting Trail.</h1>
          <p className="text-ink-soft max-w-prose">
            A student hands you a <span className="font-mono">.trail.tar.gz</span>. This page opens it in your browser, recomputes every fingerprint and every link in the chain, and checks the signatures against Trail's public key and public log fetched from this site, never the copy inside the file. Nothing is uploaded.
          </p>
        </header>

        <Steps />

        <section className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={trySample} disabled={busy !== null}>
              {busy === 'sample' ? 'Fetching and checking…' : 'Try it with a sample record'}
            </Button>
            {sample && !tamper && (
              <Button variant="secondary" onClick={tamperSample} disabled={busy !== null}>
                {busy === 'tamper' ? 'Altering…' : 'Now tamper with it'}
              </Button>
            )}
            {sample && tamper && (
              <Button variant="secondary" onClick={restoreSample} disabled={busy !== null}>
                {busy === 'restore' ? 'Restoring…' : 'Put it back'}
              </Button>
            )}
            <span className="text-xs text-ink-soft">The sample is one of the demo essays, signed by this server like any real pack.</span>
          </div>

          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={cx('block border-2 border-dashed rounded-lg px-6 py-10 text-center cursor-pointer transition-colors duration-150', drag ? 'border-accent bg-sheet' : 'border-rule-strong hover:border-ink')}
          >
            <input type="file" accept=".gz,.tgz,.tar.gz,.jsonl,.json,application/gzip" className="sr-only" onChange={(e) => e.target.files?.[0] && checkFile(e.target.files[0])} />
            <span className="display text-xl block">Or drop a record here, or click to choose one</span>
            <span className="text-sm text-ink-soft block mt-2">.trail.tar.gz (full record) or events.jsonl (raw export)</span>
          </label>
        </section>

        {busy === 'file' && (
          <p role="status" className="text-sm text-ink-soft">
            Checking {fileName}…
          </p>
        )}
        {err && (
          <p role="alert" className="text-sm text-paste">
            {err}
          </p>
        )}

        {tamper && (
          <p className="text-sm max-w-prose border-l-2 border-paste pl-3" role="status">
            We changed one letter in event <span className="font-mono">#{tamper.index + 1}</span> (<span className="font-mono">“{tamper.before.trim().slice(0, 24)}”</span> became <span className="font-mono">“{tamper.after.trim().slice(0, 24)}”</span>) and recomputed that event's own fingerprint, the way a careful forger would. The event looks fine on its own. The one after it still points at the old fingerprint, so the chain breaks there, and every signed checkpoint after it no longer matches.
          </p>
        )}

        {result && fileName && <Results result={result} fileName={fileName} tampered={!!tamper} />}
      </div>
    </PublicShell>
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
    <ol className="grid md:grid-cols-3 gap-4" aria-label="How verification works">
      {steps.map((s) => (
        <li key={s.n}>
          <Sheet className="p-5 grid gap-3 content-start h-full">
            <div className="h-20 text-ink" aria-hidden>
              {s.art}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm text-margin">{s.n}</span>
              <h2 className="text-lg leading-tight">{s.title}</h2>
            </div>
            <p className="text-sm text-ink-soft">{s.body}</p>
          </Sheet>
        </li>
      ))}
    </ol>
  );
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function ChainArt() {
  const boxes = [0, 1, 2, 3];
  return (
    <svg viewBox="0 0 240 80" className="w-full h-full">
      {boxes.map((i) => {
        const x = 8 + i * 60;
        return (
          <g key={i}>
            <rect x={x} y={22} width={44} height={36} rx={4} {...stroke} />
            <text x={x + 6} y={38} fontSize="9" fontFamily="var(--font-mono)" fill="currentColor">
              ev {i + 1}
            </text>
            <text x={x + 6} y={51} fontSize="8" fontFamily="var(--font-mono)" fill="var(--accent)">
              #{['a41f', '9c02', '77be', 'e3d0'][i]}
            </text>
            {i < 3 && (
              <g stroke="var(--margin)">
                <path d={`M${x + 44} 40 h12`} {...stroke} stroke="var(--margin)" />
                <path d={`M${x + 52} 36 l4 4 -4 4`} {...stroke} stroke="var(--margin)" />
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
      <path d="M56 38 h22" {...stroke} stroke="var(--margin)" />
      <path d="M74 34 l4 4 -4 4" {...stroke} stroke="var(--margin)" />
      <rect x={86} y={26} width={54} height={24} rx={4} {...stroke} />
      <text x={92} y={41} fontSize="8" fontFamily="var(--font-mono)" fill="var(--accent)">
        #e3d0 14:02
      </text>
      <path d="M113 50 v10" {...stroke} />
      <path d="M100 66 c4 -6 12 -8 16 -2 c4 6 12 4 14 -2" {...stroke} stroke="var(--margin)" />
      <text x={94} y={78} fontSize="8" fontFamily="var(--font-mono)" fill="var(--ink-soft)">
        signed by Trail
      </text>
      <path d="M144 38 h20" {...stroke} stroke="var(--margin)" />
      <path d="M160 34 l4 4 -4 4" {...stroke} stroke="var(--margin)" />
      <rect x={172} y={14} width={60} height={50} rx={4} {...stroke} />
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={178} y1={24 + i * 10} x2={i === 3 ? 206 : 226} y2={24 + i * 10} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" opacity={i === 3 ? 1 : 0.5} />
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
      <rect x={8} y={8} width={150} height={64} rx={5} {...stroke} />
      <line x1={8} y1={22} x2={158} y2={22} stroke="currentColor" strokeWidth={1.5} />
      <circle cx={16} cy={15} r={2} fill="currentColor" />
      <circle cx={23} cy={15} r={2} fill="currentColor" />
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
      <rect x={180} y={40} width={20} height={14} rx={2} {...stroke} />
      <path d="M170 47 h-8" {...stroke} stroke="var(--margin)" />
      <path d="M166 43 l-4 4 4 4" {...stroke} stroke="var(--margin)" />
      <text x={172} y={70} fontSize="8" fontFamily="var(--font-mono)" fill="var(--ink-soft)">
        key + log
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ results */

function verdict(r: VerifyResult, tampered: boolean): { text: string; tone: 'ok' | 'bad' | 'partial' } {
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
  if (s?.brokenAt) return { text: `This record was altered after event #${s.brokenAt.index + 1}${s.brokenAt.ts ? ` (${fmtDateTime(s.brokenAt.ts)})` : ''}.`, tone: 'bad' };
  const n = r.checks.filter((c) => c.status === 'FAIL').length;
  return { text: `This record failed ${n} check${n === 1 ? '' : 's'}.`, tone: 'bad' };
}

function Results({ result, fileName, tampered }: { result: VerifyResult; fileName: string; tampered: boolean }) {
  const v = verdict(result, tampered);
  const s = result.summary;
  return (
    <Sheet className="p-5 grid gap-4" as="section" aria-live="polite">
      <div className="grid gap-2">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className={cx('display text-2xl', v.tone === 'ok' ? 'text-typed' : v.tone === 'bad' ? 'text-paste' : 'text-mixed')}>{v.tone === 'ok' ? 'Verified' : v.tone === 'bad' ? 'Failed' : 'Partly checked'}</span>
          <span className="font-mono text-xs text-ink-soft break-all">{fileName}</span>
        </div>
        <p className="text-lg">{v.text}</p>
        {s && (
          <p className="font-mono text-xs text-ink-soft tabular">
            {s.events.toLocaleString()} events · {s.sessions} session{s.sessions === 1 ? '' : 's'} · {s.checkpoints} signed checkpoint{s.checkpoints === 1 ? '' : 's'}
          </p>
        )}
      </div>
      <ol className="grid divide-y divide-rule border-t border-b border-rule text-sm">
        {result.checks.map((c, i) => (
          <CheckRow key={i} c={c} />
        ))}
      </ol>
      <p className="text-xs text-ink-soft">
        Verified means Trail's key signed these checkpoints, they are in the public log, and the record was not altered after any of them. A pack signed by any other key fails, however consistent its hashes are. It describes how the document was produced; it does not judge content, and it cannot see text retyped by hand.
      </p>
    </Sheet>
  );
}

function CheckRow({ c }: { c: VerifyCheck }) {
  const mark = c.status === 'PASS' ? '✓' : c.status === 'FAIL' ? '✕' : '–';
  return (
    <li className="grid grid-cols-[1.5rem_1fr] gap-x-3 py-2.5">
      <span className={cx('font-mono text-base leading-5', c.status === 'PASS' ? 'text-typed' : c.status === 'FAIL' ? 'text-paste' : 'text-ink-faint')} aria-label={c.status}>
        {mark}
      </span>
      <span className="grid gap-0.5">
        <span className={cx(c.status === 'SKIP' && 'text-ink-soft')}>
          {c.plain || c.name}
          {c.status === 'SKIP' && <span className="font-mono text-[11px] text-ink-faint ml-2">skipped</span>}
        </span>
        {c.detail && <span className="font-mono text-[11px] text-ink-soft break-words">{c.detail}</span>}
      </span>
    </li>
  );
}
