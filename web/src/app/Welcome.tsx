// First run (DECISIONS §6): allow recording → install → connect → write one paragraph → first replay.
// Nothing is recorded until the student has read what Trail records and pressed "Start recording"
// (here, or in the extension's popup); the page hands that consent to the extension over the bridge
// (`setConsent`). Pressed before the extension is installed, it is kept for this tab and handed over
// as soon as the extension shows up. The page then polls for the first document with events and
// opens its replay.
// On the document it is the installer note: a framed note with a step list, a pill track that fills
// as the student goes, and the one default button for the current step (DESIGN-document.md §9).
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MOCK, data } from '../lib/data';
import * as ext from '../lib/extension';
import { useMe } from '../components/AppShell';
import { usePageTitle } from '../components/useAsync';
import { Button, ButtonLink, Caption, Chip, Icon, Note, ProgressBar, cx } from '../components/ui';
import { CHROME_STORE_URL } from './shared';

type Step = 'allow' | 'install' | 'connect' | 'write' | 'done';

const PENDING_KEY = 'trail_consent_pending';
const readPending = () => {
  try {
    return sessionStorage.getItem(PENDING_KEY) === '1';
  } catch {
    return false;
  }
};
const writePending = (on: boolean) => {
  try {
    if (on) sessionStorage.setItem(PENDING_KEY, '1');
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage may be unavailable */
  }
};

/** The same disclosure the extension's popup shows before its "Start recording" button. */
function Disclosure() {
  return (
    <div className="grid gap-3 text-sm p-4 sm:p-5 bg-well border border-rule rounded-sm">
      <p className="m-0">Trail keeps a private record of how you write, so you can replay it, see your patterns and prove where your work came from. When you start it, it records:</p>
      <ul className="m-0 pl-5 grid gap-1 list-disc">
        <li>what you type, delete and paste in Google Docs, Notion, Word Online and your school's LMS (Canvas, Moodle, Blackboard, Brightspace), with timing, and the site a paste came from;</li>
        <li>which sites are in front while a document is open, including AI sites (site name and minutes only);</li>
        <li>time on your LMS pages, by course and assignment.</li>
      </ul>
      <p className="m-0">
        <strong>It stays on this computer.</strong> What leaves: a fingerprint of each record every 10 minutes, only if you are signed in. Never your text. You can stop it any time from the Trail button in the toolbar.
      </p>
    </div>
  );
}

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
  // recording consent: what the extension holds (null until asked), and a "Start recording" pressed
  // before the extension was installed (kept for this tab, handed over when it shows up)
  const [consent, setConsent] = useState<boolean | null>(null);
  const [pending, setPending] = useState(readPending);
  const [allowing, setAllowing] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const tried = useRef(false);

  // 1. detect the extension (keeps polling while it is missing so an install shows up without a reload)
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const s = await data.extensionStatus();
      if (!alive) return;
      setInstalled(s.installed);
      if (s.connected) setConnected(true);
      if (s.installed && !MOCK) {
        try {
          const c = await ext.getConsent();
          if (alive) setConsent(c.granted);
        } catch {
          /* extension busy; ask again on the next check */
        }
      } else if (MOCK) setConsent((c) => c ?? false);
    };
    check();
    const t = setInterval(check, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // 1b. consent given before the extension was installed: hand it over as soon as it answers
  useEffect(() => {
    if (installed && consent === false && pending && !allowing) allow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installed, consent, pending]);

  const allow = async () => {
    setConsentError(null);
    if (MOCK) {
      setConsent(true);
      return;
    }
    if (!installed) {
      // not installed yet: remember the choice for this tab; nothing records until the extension has it
      writePending(true);
      setPending(true);
      return;
    }
    setAllowing(true);
    try {
      const c = await ext.setConsent(true);
      setConsent(c.granted);
      writePending(false);
      setPending(false);
    } catch {
      setConsentError('The extension did not answer. Reload this page, or press Start recording in the Trail button in the toolbar.');
    } finally {
      setAllowing(false);
    }
  };

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
    if (!connected || !consent || stay) return;
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
  }, [connected, consent, stay, nav]);

  const allowed = consent === true || (pending && !installed);
  const step: Step = installed && consent === null ? 'connect' : !allowed ? 'allow' : installed === false ? 'install' : !connected ? 'connect' : 'write';
  const steps: { key: Step; title: string; body: string }[] = [
    { key: 'allow', title: 'Allow recording', body: 'Nothing is recorded until you say so. Here is exactly what Trail keeps, and where.' },
    { key: 'install', title: 'Install the extension', body: 'Chrome only for now. It records inside Google Docs, Notion, Word Online and your LMS editor, and nowhere else.' },
    { key: 'connect', title: 'Connect it to your account', body: 'The app hands the extension a token so it can get your checkpoints signed. No text is involved.' },
    { key: 'write', title: 'Write one paragraph', body: 'Open Google Docs or Notion and write a few lines. Your first replay opens here on its own.' },
  ];
  const order: Step[] = ['allow', 'install', 'connect', 'write'];
  const idx = order.indexOf(step);

  const actions =
    step === 'allow' ? (
      <>
        <Button ring variant="primary" onClick={allow} disabled={allowing}>
          {allowing ? 'Starting…' : 'Start recording'}
        </Button>
        <ButtonLink to="/demo" variant="quiet">
          Not now
        </ButtonLink>
      </>
    ) : step === 'install' ? (
      <>
        <ButtonLink to={CHROME_STORE_URL} external ring variant="primary" arrow>
          Install
        </ButtonLink>
        <ButtonLink to="/demo" variant="quiet">
          Watch the demo first
        </ButtonLink>
      </>
    ) : step === 'connect' ? (
      <Button ring variant="primary" onClick={connect} disabled={connecting}>
        {connecting ? 'Connecting…' : 'Connect'}
      </Button>
    ) : (
      <>
        <ButtonLink to="https://docs.new" external ring variant="primary">
          Open a new Google Doc
        </ButtonLink>
        <ButtonLink to="https://www.notion.so/new" external>
          Open Notion
        </ButtonLink>
      </>
    );

  return (
    <Note
      as="section"
      frame
      label={
        <span className="inline-flex items-center gap-2">
          <Icon name="upload" size={16} /> Trail installer
        </span>
      }
      aside={
        <span className="font-mono text-xs tabular text-ink-soft">
          step {idx + 1} of {order.length}
        </span>
      }
      className="max-w-3xl"
      aria-labelledby="welcome-title"
    >
      <h1 id="welcome-title" className="h-section">
        Hi {me.email.split('@')[0]}.
      </h1>
      <p className="lede">
        Four steps, under five minutes. {me.billing.freeAccess ? 'Free during early access. No clock, no card.' : 'Your trial clock does not start until you see your first replay.'}
      </p>
      <ProgressBar value={idx / order.length} label="Setup progress" tone="typed" className="flex-none w-full" />
      <ol className="grid list-none m-0 p-0">
        {steps.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <li key={s.key} className="grid grid-cols-[32px_minmax(0,1fr)] gap-4 items-start py-5 border-t border-rule first:border-t-0" aria-current={active ? 'step' : undefined}>
              <span
                className={cx(
                  'grid place-items-center w-8 h-8 rounded-full border font-mono text-xs',
                  done && 'border-typed text-typed bg-[var(--typed-wash)]',
                  active && 'border-ink bg-ink text-on-ink',
                  !done && !active && 'border-rule-strong text-ink-faint',
                )}
              >
                {done ? <Icon name="check" size={16} label="done" /> : active ? <Icon name="arrow" size={16} label="current step" /> : <span aria-hidden>{i + 1}</span>}
              </span>
              <div className="grid gap-2 min-w-0">
                <span className={cx('text-base', active && 'font-semibold', done && 'text-ink-soft')}>
                  {i + 1}. {s.title}
                </span>
                <Caption>{s.body}</Caption>
                {active && s.key === 'allow' && <Disclosure />}
                {active && s.key === 'allow' && consentError && (
                  <p role="alert" className="text-sm text-seal">
                    {consentError}
                  </p>
                )}
                {s.key === 'allow' && i < idx && pending && !consent && <Caption role="status">Recording starts once the extension is installed.</Caption>}
                {active && s.key === 'install' && <Caption role="status">{installed === null ? 'Checking…' : 'Waiting for the extension… this page notices on its own.'}</Caption>}
                {active && s.key === 'connect' && error && (
                  <p role="alert" className="text-sm text-seal">
                    {error}
                  </p>
                )}
                {active && s.key === 'write' && (
                  <span className="inline-flex flex-wrap items-center gap-2 text-sm">
                    <Chip kind="typed">connected</Chip> Recording as soon as you type.
                  </span>
                )}
                {active && <div className="flex flex-wrap items-center gap-3 pt-2">{actions}</div>}
              </div>
            </li>
          );
        })}
      </ol>
      <Caption>On a phone? Trail records on a laptop; this page shows what the laptop's extension has.</Caption>
    </Note>
  );
}
