// Public verifier: drop a .trail.tar.gz (or a raw events.jsonl); everything is checked in
// the browser (lib/verify.ts). Nothing is uploaded. For a professor who does not trust us.
import { useState, type DragEvent } from 'react';
import { data } from '../lib/data';
import type { VerifyResult } from '../lib/types';
import { usePageTitle } from '../components/useAsync';
import { Marginal, Sheet, cx } from '../components/ui';
import { PublicShell } from './shared';

export default function Verify() {
  usePageTitle('Verify a record');
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const check = async (f: File) => {
    setFile(f);
    setResult(null);
    setErr(null);
    setBusy(true);
    try {
      setResult(await data.verifyRecord(f));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) check(f);
  };

  return (
    <PublicShell>
      <div className="grid gap-8">
        <header className="grid gap-3">
          <Marginal>Verify a record</Marginal>
          <h1 className="text-3xl sm:text-4xl">Check a Trail record without trusting Trail.</h1>
          <p className="text-ink-soft max-w-prose">
            Drop the <span className="font-mono">.trail.tar.gz</span> a student gave you. Your browser recomputes every hash, walks every chain, checks every signature against Trail's public key fetched from this site (not the copy inside the archive), and looks each checkpoint up in the public log. Nothing is uploaded. The <span className="font-mono">verify.py</span> inside the archive repeats the hash and signature checks offline.
          </p>
        </header>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={cx('block border-2 border-dashed rounded-lg px-6 py-12 text-center cursor-pointer transition-colors duration-150', drag ? 'border-accent bg-sheet' : 'border-rule-strong hover:border-ink')}
        >
          <input type="file" accept=".gz,.tgz,.tar.gz,.jsonl,.json,application/gzip" className="sr-only" onChange={(e) => e.target.files?.[0] && check(e.target.files[0])} />
          <span className="display text-xl block">Drop a record here, or click to choose one</span>
          <span className="text-sm text-ink-soft block mt-2">.trail.tar.gz (full record) or events.jsonl (raw export)</span>
        </label>

        {busy && (
          <p role="status" className="text-sm text-ink-soft">
            Checking {file?.name}…
          </p>
        )}
        {err && (
          <p role="alert" className="text-sm text-paste">
            {err}
          </p>
        )}
        {result && file && (
          <Sheet className="p-5 grid gap-4" as="section">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className={cx('display text-2xl', result.ok ? 'text-typed' : 'text-paste')}>{result.ok ? 'Verified' : 'Failed'}</span>
              <span className="font-mono text-xs text-ink-soft break-all">{file.name}</span>
            </div>
            <ol className="grid divide-y divide-rule border-t border-b border-rule text-sm">
              {result.checks.map((c, i) => (
                <li key={i} className="grid grid-cols-[3.5rem_1fr] gap-x-4 py-2">
                  <span className={cx('font-mono text-xs', c.status === 'PASS' ? 'text-typed' : c.status === 'FAIL' ? 'text-paste' : 'text-ink-faint')}>{c.status}</span>
                  <span>
                    {c.name}
                    {c.detail && <span className="text-ink-soft"> — {c.detail}</span>}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-ink-soft">
              Verified means Trail's key signed these checkpoints, they are in the public log, and the record was not altered after any of them. A pack signed by any other key fails, however consistent its hashes are. It describes how the document was produced. It does not judge content, and it cannot see text retyped by hand.
            </p>
          </Sheet>
        )}
      </div>
    </PublicShell>
  );
}
