import { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { Me } from '../lib/types';
import { data } from '../lib/data';
import { useAsync } from './useAsync';
import { ThemeToggle, Wordmark } from '../design/components';
import { Button, ButtonLink, ErrorNote, Loading, cx } from './ui';
import { daysUntil } from './format';

type Ctx = { me: Me; reload: () => void };
const MeCtx = createContext<Ctx | null>(null);
export const useMe = (): Ctx => {
  const c = useContext(MeCtx);
  if (!c) throw new Error('useMe outside AppShell');
  return c;
};

const NAV = [
  { to: '/app', label: 'Essays', end: true },
  { to: '/app/patterns', label: 'Patterns' },
  { to: '/app/invite', label: 'Invite' },
  { to: '/app/settings', label: 'Settings' },
];

export function AppShell() {
  const me = useAsync(() => data.me(), []);
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  // Returning login lands on /app?connect=1: hand the extension a fresh token, then drop the flag.
  useEffect(() => {
    if (me.status === 'ready' && me.value && new URLSearchParams(loc.search).get('connect') === '1') {
      data.connectExtension().finally(() => nav(loc.pathname, { replace: true }));
    }
  }, [me.status, loc.search, loc.pathname, nav]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (me.status === 'loading')
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loading label="Opening your notebook" />
      </div>
    );
  if (me.status === 'error')
    return (
      <div className="min-h-dvh grid place-items-center p-6">
        <ErrorNote error={me.error} retry={me.reload} />
      </div>
    );
  if (!me.value) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;

  const user = me.value;
  const trialDays = daysUntil(user.trialEndsAt);
  const expired = user.plan === 'expired';
  const onWelcome = loc.pathname.startsWith('/app/welcome');

  return (
    <MeCtx.Provider value={{ me: user, reload: me.reload }}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-ink text-paper px-3 py-2 rounded z-50">
          Skip to content
        </a>
        {/* rail */}
        <aside className="hidden lg:flex flex-col border-r border-rule px-5 py-6 gap-8 sticky top-0 h-dvh">
          <Wordmark to="/app" />
          <nav className="grid gap-1 text-sm" aria-label="App">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cx('px-2 py-1.5 rounded-md border-l-2 -ml-2 pl-3 transition-colors duration-150', isActive ? 'border-ink text-ink' : 'border-transparent text-ink-soft hover:text-ink')
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto grid gap-3">
            {user.plan === 'trial' && trialDays !== null && (
              <p className="text-xs text-ink-soft">
                Trial: <span className="tabular font-mono">{trialDays}</span> days left.{' '}
                <NavLink to="/app/settings" className="link">
                  Plans
                </NavLink>
              </p>
            )}
            <div className="flex items-center justify-between">
              <ThemeToggle />
            </div>
            <p className="text-xs text-ink-faint font-mono truncate" title={user.email}>
              {user.email}
            </p>
          </div>
        </aside>

        <div className="min-w-0">
          {/* top bar (below lg) */}
          <header className="lg:hidden border-b border-rule">
            <div className="px-5 h-14 flex items-center gap-4">
              <Wordmark to="/app" />
              <button className="ml-auto h-9 px-3 rounded-md border border-rule text-sm" aria-expanded={open} aria-controls="app-nav" onClick={() => setOpen((o) => !o)}>
                {open ? 'Close' : 'Menu'}
              </button>
            </div>
            {open && (
              <nav id="app-nav" className="border-t border-rule px-5 py-3 grid gap-2 text-base" aria-label="App">
                {NAV.map((n) => (
                  <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) => cx('py-1', isActive ? 'text-ink font-semibold' : 'text-ink-soft')}>
                    {n.label}
                  </NavLink>
                ))}
                <div className="pt-2">
                  <ThemeToggle />
                </div>
              </nav>
            )}
            <p className="px-5 py-2 text-xs text-ink-soft bg-sheet border-t border-rule">Read-only on phones. Recording happens in Chrome on your laptop.</p>
          </header>

          <main id="main" className="px-5 md:px-8 lg:px-12 py-8 lg:py-10 max-w-5xl">
            {expired && !onWelcome && !loc.pathname.startsWith('/app/settings') ? <Paywall /> : <Outlet />}
          </main>
        </div>
      </div>
    </MeCtx.Provider>
  );
}

export function Paywall() {
  const [busy, setBusy] = useState<'semester' | 'monthly' | null>(null);
  const go = async (plan: 'semester' | 'monthly') => {
    setBusy(plan);
    try {
      const { url } = await data.startCheckout(plan);
      window.location.assign(url);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="max-w-2xl grid gap-6">
      <span className="marginal">Your trial has ended</span>
      <h1 className="text-3xl sm:text-4xl">Your record is still yours. The views are what you pay for.</h1>
      <p className="text-ink-soft text-lg">
        Recording, local storage, checkpoint signing and raw export never stop. Replay, sessions, patterns and the declaration come back the moment you pick a plan. Refund within 14 days, one click, no questions.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="border border-ink rounded-lg p-5 grid gap-3 bg-sheet">
          <span className="marginal">Semester</span>
          <div className="display text-3xl tabular">
            $12 <span className="text-base text-ink-soft font-sans">/ 4 months</span>
          </div>
          <Button onClick={() => go('semester')} disabled={busy !== null}>
            {busy === 'semester' ? 'Opening checkout…' : 'Continue with semester'}
          </Button>
        </div>
        <div className="border border-rule rounded-lg p-5 grid gap-3">
          <span className="marginal">Monthly</span>
          <div className="display text-3xl tabular">
            $3.99 <span className="text-base text-ink-soft font-sans">/ month</span>
          </div>
          <Button variant="secondary" onClick={() => go('monthly')} disabled={busy !== null}>
            {busy === 'monthly' ? 'Opening checkout…' : 'Continue monthly'}
          </Button>
        </div>
      </div>
      <p className="text-sm text-ink-soft">
        Price and renewal date are shown on the checkout button. Or invite three friends and get a semester free — <ButtonLink to="/app/invite" variant="quiet" className="!px-0 underline">see your invite link</ButtonLink>.
      </p>
    </div>
  );
}
