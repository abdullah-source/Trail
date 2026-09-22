// First run (DECISIONS §6): install → sign in → connect → write one paragraph → first replay.
// The page polls the extension for the first document with events and opens its replay.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { data } from '../lib/data';
import { useMe } from '../components/AppShell';
import { usePageTitle } from '../components/useAsync';
import { Button, ButtonLink, Marginal, Sheet, cx } from '../components/ui';
import { CHROME_STORE_URL } from './shared';

type Step = 'install' | 'connect' | 'write' | 'done';

export default function Welcome() {
  usePageTitle('Welcome');
  const { me } = useMe();
  const nav = useNavigate();
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tried = useRef(false);

  // 1. detect the extension (keeps polling while it is missing so an install shows up without a reload)
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const s = await data.extensionStatus();
      if (!alive) return;
      setInstalled(s.installed);
      if (s.connected) setConnected(true);
    };
    check();
    const t = setInterval(check, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // 2. hand the extension its token once, automatically
  useEffect(() => {
    if (installed && !connected && !tried.current) {
      tried.current = true;
      connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installed, connected]);

  const connect = async () => {
    setConnecting(true);
    setError(null);
    const ok = await data.connectExtension();
    setConnecting(false);
    if (ok) setConnected(true);
    else setError('The extension did not accept the connection. Reload this page; if it keeps failing, reinstall the extension.');
  };

  // 3. wait for the first recorded paragraph, then open its replay
  useEffect(() => {
    if (!connected) return;
    let alive = true;
    const poll = async () => {
      try {
        const essays = await data.essays();
        const first = essays.filter((e) => e.events > 0 && e.typed + e.pasted > 0).sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1))[0];
        if (first && alive) nav(`/app/essays/${encodeURIComponent(first.id)}?first=1`, { replace: true });
      } catch {
        /* extension busy; try again */
      }
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [connected, nav]);

  const step: Step = installed === false ? 'install' : !connected ? 'connect' : 'write';
  const steps: { key: Step; title: string; body: string }[] = [
    { key: 'install', title: 'Install the extension', body: 'Chrome only for now. It records inside Google Docs, Notion, Word Online and your LMS editor, and nowhere else.' },
    { key: 'connect', title: 'Connect it to your account', body: 'The app hands the extension a token so it can get your checkpoints signed. No text is involved.' },
    { key: 'write', title: 'Write one paragraph', body: 'Open Google Docs or Notion and write a few lines. Your first replay opens here on its own.' },
  ];
  const order: Step[] = ['install', 'connect', 'write'];
  const idx = order.indexOf(step);

  return (
    <div className="grid gap-8 max-w-2xl">
      <div className="grid gap-2">
        <Marginal>Welcome</Marginal>
        <h1 className="text-3xl sm:text-4xl">Hi {me.email.split('@')[0]}. Three steps, under five minutes.</h1>
        <p className="text-ink-soft">{me.billing.freeAccess ? 'Free during early access. No clock, no card.' : 'Your trial clock does not start until you see your first replay.'}</p>
      </div>

      <ol className="grid gap-4">
        {steps.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <li key={s.key}>
              <Sheet className={cx('p-5 grid gap-2 transition-colors duration-150', active && 'border-ink', done && 'opacity-70')}>
                <div className="flex items-center gap-3">
                  <span className={cx('font-mono text-xs w-6 h-6 rounded-full border grid place-items-center', done ? 'bg-typed border-typed text-paper' : active ? 'border-ink' : 'border-rule-strong text-ink-soft')} aria-hidden>
                    {done ? '✓' : i + 1}
                  </span>
                  <h2 className="text-xl">{s.title}</h2>
                  {done && <span className="sr-only">done</span>}
                </div>
                <p className="text-sm text-ink-soft pl-9">{s.body}</p>
                {active && s.key === 'install' && (
                  <div className="pl-9 pt-1 flex flex-wrap gap-3 items-center">
                    <ButtonLink to={CHROME_STORE_URL} external>
                      Get Trail for Chrome
                    </ButtonLink>
                    <span className="text-xs text-ink-soft">{installed === null ? 'Checking…' : 'Waiting for the extension… this page notices on its own.'}</span>
                  </div>
                )}
                {active && s.key === 'connect' && (
                  <div className="pl-9 pt-1 flex flex-wrap gap-3 items-center">
                    <Button onClick={connect} disabled={connecting}>
                      {connecting ? 'Connecting…' : 'Connect'}
                    </Button>
                    {error && (
                      <span role="alert" className="text-sm text-paste">
                        {error}
                      </span>
                    )}
                  </div>
                )}
                {active && s.key === 'write' && (
                  <div className="pl-9 pt-1 flex flex-wrap gap-4 items-center">
                    <span className="inline-flex items-center gap-2 text-sm">
                      <span className="w-2.5 h-2.5 rounded-full bg-typed animate-pulse motion-reduce:animate-none" aria-hidden />
                      Connected. Recording as soon as you type.
                    </span>
                    <a className="link text-sm" href="https://docs.new" target="_blank" rel="noreferrer">
                      Open a new Google Doc
                    </a>
                    <a className="link text-sm" href="https://www.notion.so/new" target="_blank" rel="noreferrer">
                      Open Notion
                    </a>
                  </div>
                )}
              </Sheet>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-ink-faint">On a phone? Trail records on a laptop; this page shows what the laptop's extension has.</p>
    </div>
  );
}
