// First run (DECISIONS §6): install → sign in → connect → write one paragraph → first replay.
// The page polls the extension for the first document with events and opens its replay.
// On the desktop it is the installer dialog: a step list with a segmented progress bar that fills
// as the student goes, and the one default button for the current step (DESIGN-desktop.md §4).
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { data } from '../lib/data';
import { useMe } from '../components/AppShell';
import { usePageTitle } from '../components/useAsync';
import { Button, ButtonLink, Caption, Chip, Dialog, Icon, ProgressBar, cx } from '../components/ui';
import { CHROME_STORE_URL } from './shared';

type Step = 'install' | 'connect' | 'write' | 'done';

export default function Welcome() {
  usePageTitle('Welcome');
  const { me } = useMe();
  const nav = useNavigate();
  // ?stay=1 keeps the installer on screen even when a replay already exists (design review, screenshots)
  const [params] = useSearchParams();
  const stay = params.get('stay') === '1';
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
    if (!connected || stay) return;
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
  }, [connected, stay, nav]);

  const step: Step = installed === false ? 'install' : !connected ? 'connect' : 'write';
  const steps: { key: Step; title: string; body: string }[] = [
    { key: 'install', title: 'Install the extension', body: 'Chrome only for now. It records inside Google Docs, Notion, Word Online and your LMS editor, and nowhere else.' },
    { key: 'connect', title: 'Connect it to your account', body: 'The app hands the extension a token so it can get your checkpoints signed. No text is involved.' },
    { key: 'write', title: 'Write one paragraph', body: 'Open Google Docs or Notion and write a few lines. Your first replay opens here on its own.' },
  ];
  const order: Step[] = ['install', 'connect', 'write'];
  const idx = order.indexOf(step);

  const actions =
    step === 'install' ? (
      <>
        <ButtonLink to="/demo" variant="quiet">
          Watch the demo first
        </ButtonLink>
        <ButtonLink to={CHROME_STORE_URL} external ring variant="primary">
          Install
        </ButtonLink>
      </>
    ) : step === 'connect' ? (
      <Button ring variant="primary" onClick={connect} disabled={connecting}>
        {connecting ? 'Connecting…' : 'Connect'}
      </Button>
    ) : (
      <>
        <ButtonLink to="https://www.notion.so/new" external>
          Open Notion
        </ButtonLink>
        <ButtonLink to="https://docs.new" external ring variant="primary">
          Open a new Google Doc
        </ButtonLink>
      </>
    );

  return (
    <Dialog title="Trail Installer" icon="disk" className="max-w-2xl win-open" actions={actions}>
      <p className="text-sm">
        Hi {me.email.split('@')[0]}. Three steps, under five minutes. {me.billing.freeAccess ? 'Free during early access. No clock, no card.' : 'Your trial clock does not start until you see your first replay.'}
      </p>
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
        <ProgressBar segments={20} value={idx / order.length} label="Setup progress" />
        <span className="tabular">step {idx + 1} of {order.length}</span>
      </div>
      <ol className="grid gap-3 list-none m-0 p-0">
        {steps.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <li key={s.key} className="grid grid-cols-[16px_1fr] gap-3 items-start" aria-current={active ? 'step' : undefined}>
              {done ? <Icon name="check" fill={{ '#': 'var(--typed)' }} label="done" /> : active ? <Icon name="forward" label="current step" /> : <span className="font-mono text-ink-faint text-center w-4 leading-4" aria-hidden>—</span>}
              <div className="grid gap-1">
                <span className={cx('text-sm', active && 'font-semibold', done && 'text-ink-soft')}>
                  {i + 1}. {s.title}
                </span>
                <Caption>{s.body}</Caption>
                {active && s.key === 'install' && <Caption role="status">{installed === null ? 'Checking…' : 'Waiting for the extension… this page notices on its own.'}</Caption>}
                {active && s.key === 'connect' && error && (
                  <p role="alert" className="text-sm">
                    {error}
                  </p>
                )}
                {active && s.key === 'write' && (
                  <span className="inline-flex flex-wrap items-center gap-2 text-sm">
                    <Chip kind="typed">connected</Chip> Recording as soon as you type.
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <Caption>On a phone? Trail records on a laptop; this page shows what the laptop's extension has.</Caption>
    </Dialog>
  );
}
