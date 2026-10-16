// The app shell is the document's frosted Nav with the app's items (Essays, Time, Patterns, Invite,
// Settings) and, on the right, the theme toggle, the account email in mono and Sign out
// (DESIGN-document.md §9, "App shell"). No side rail and no desk: pages sit on banknote paper in the
// 1200 px container. The trial line sits under the nav; "Read-only on phones" is one note line.
import { createContext, useContext, useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { Me } from '../lib/types';
import { data } from '../lib/data';
import { useAsync } from './useAsync';
import { Button, ButtonLink, Caption, Chip, ErrorNote, Icon, Loading, Note, Radio, Reveal, RouterLink, ThemeToggle } from './ui';
import { Nav } from '../design/document';
import { daysUntil } from './format';

type Ctx = { me: Me; reload: () => void };
const MeCtx = createContext<Ctx | null>(null);
export const useMe = (): Ctx => {
  const c = useContext(MeCtx);
  if (!c) throw new Error('useMe outside AppShell');
  return c;
};

const NAV: { to: string; label: string; match: (path: string) => boolean }[] = [
  { to: '/app', label: 'Essays', match: (p) => p === '/app' || p === '/app/' || p.startsWith('/app/essays') },
  { to: '/app/time', label: 'Time', match: (p) => p.startsWith('/app/time') },
  { to: '/app/patterns', label: 'Patterns', match: (p) => p.startsWith('/app/patterns') },
  { to: '/app/invite', label: 'Invite', match: (p) => p.startsWith('/app/invite') },
  { to: '/app/settings', label: 'Settings', match: (p) => p.startsWith('/app/settings') },
];

/* ------------------------------------------------------------------- shell */

export function AppShell() {
  const me = useAsync(() => data.me(), []);
  const loc = useLocation();
  const nav = useNavigate();

  // Returning login lands on /app?connect=1: hand the extension a fresh token, then drop the flag.
  useEffect(() => {
    if (me.status === 'ready' && me.value && new URLSearchParams(loc.search).get('connect') === '1') {
      data.connectExtension().finally(() => nav(loc.pathname, { replace: true }));
    }
  }, [me.status, loc.search, loc.pathname, nav]); // eslint-disable-line react-hooks/exhaustive-deps

  if (me.status === 'loading')
    return (
      <div className="min-h-dvh grid place-items-center bg-paper">
        <Loading label="Opening your record" />
      </div>
    );
  if (me.status === 'error')
    return (
      <div className="min-h-dvh grid place-items-center bg-paper p-4">
        <ErrorNote error={me.error} retry={me.reload} />
      </div>
    );
  if (!me.value) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;

  const user = me.value;
  const trialDays = daysUntil(user.trialEndsAt);
  const expired = user.plan === 'expired';
  const onWelcome = loc.pathname.startsWith('/app/welcome');
  const items = NAV.map((n) => ({ label: n.label, to: n.to, current: n.match(loc.pathname) }));
  const signOut = async () => {
    await data.logout();
    location.assign('/login');
  };

  return (
    <MeCtx.Provider value={{ me: user, reload: me.reload }}>
      <div className="min-h-dvh bg-paper text-ink">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 btn btn-secondary btn-sm">
          Skip to content
        </a>
        <Nav
          label="App"
          items={items}
          linkAs={RouterLink}
          brandTo="/app"
          right={
            <>
              <ThemeToggle />
              <span className="mono text-xs text-ink-soft hide-phone truncate max-w-[16rem] px-1" title={user.email}>
                {user.email}
              </span>
              <Button variant="quiet" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </>
          }
        />
        {user.plan === 'trial' && trialDays !== null && (
          <div className="border-b border-rule bg-paper-deep" role="status">
            <div className="doc-container flex flex-wrap items-center gap-x-3 gap-y-1 py-2 font-mono text-xs text-ink-soft">
              <Chip kind="signed">Trial</Chip>
              <span>
                <span className="tabular text-ink">{trialDays}</span> day{trialDays === 1 ? '' : 's'} left.
              </span>
              <Link to="/app/settings" className="link">
                Plans
              </Link>
            </div>
          </div>
        )}

        <main id="main" className="doc-container grid gap-10 py-10 sm:py-14 min-w-0">
          <Note crop={false} watermark={false} className="lg:hidden py-3 px-4">
            <p className="flex items-start gap-3 text-sm">
              <Icon name="info" size={18} className="flex-none mt-0.5 text-signed" />
              <span>
                <span className="font-medium">Read-only on phones.</span> <span className="text-ink-soft">Recording happens in Chrome on your laptop. This page shows what the laptop's extension has.</span>
              </span>
            </p>
          </Note>
          {/* keyed by path so a route change mounts a fresh page and it rises in once */}
          <Reveal key={loc.pathname} className="grid gap-10 min-w-0">
            {expired && !onWelcome && !loc.pathname.startsWith('/app/settings') ? <Paywall /> : <Outlet />}
          </Reveal>
        </main>
      </div>
    </MeCtx.Provider>
  );
}

/** The trial has ended: a framed note with a radio per plan and one default button. */
export function Paywall() {
  const [plan, setPlan] = useState<'semester' | 'monthly'>('semester');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const { url } = await data.startCheckout(plan);
      window.location.assign(url);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Note
      as="section"
      frame
      label={
        <span className="inline-flex items-center gap-2">
          <Icon name="key" size={16} /> Plan
        </span>
      }
      className="max-w-2xl"
    >
      <h1 className="note-title">Your trial has ended</h1>
      <p className="text-sm">Your record is still yours. The views are what you pay for.</p>
      <p className="text-sm text-ink-soft">Recording, local storage, checkpoint signing and raw export never stop. Replay, sessions, patterns and the declaration come back the moment you pick a plan. Refund within 14 days, one click, no questions.</p>
      <fieldset className="grid gap-3 border-0 p-0 m-0">
        <legend className="sr-only">Plan</legend>
        <Radio name="paywall-plan" label="Semester, $12 for 4 months" description="Recommended." checked={plan === 'semester'} onChange={() => setPlan('semester')} />
        <Radio name="paywall-plan" label="Monthly, $3.99" checked={plan === 'monthly'} onChange={() => setPlan('monthly')} />
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button ring variant="primary" onClick={go} disabled={busy} arrow>
          {busy ? 'Opening checkout…' : 'Continue'}
        </Button>
        <ButtonLink to="/app/invite" variant="quiet">
          Invite three friends instead
        </ButtonLink>
      </div>
      <Caption>Price and renewal date are shown on the checkout button. Invite three friends and a semester is free.</Caption>
    </Note>
  );
}
