// The app shell is the desk: a menu bar along the top, the dithered desk below, and each page's
// windows on it (DESIGN-desktop.md §4, "App shell"). The margin rail and the phone top bar are gone;
// the menu bar folds its items behind "Menu" below 700 px on its own.
import { createContext, useContext, useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { Me } from '../lib/types';
import { data } from '../lib/data';
import { useAsync } from './useAsync';
import { Button, ButtonLink, Caption, DesktopPattern, Dialog, ErrorNote, Icon, Loading, MenuBar, Radio, Window, type MenuItem } from './ui';
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

/* ------------------------------------------------------------ desk accessories */

/** Same storage key and data-theme attribute as design/components ThemeToggle and index.html's first-paint
 *  script; drawn here as a menu bar item with the sun/moon pixel icon. */
const THEME_KEY = 'trail.theme';
type Pref = 'system' | 'light' | 'dark';
const systemDark = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
function useTheme() {
  const [pref, setPref] = useState<Pref>(() => {
    try {
      const v = localStorage.getItem(THEME_KEY);
      return v === 'light' || v === 'dark' ? v : 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    const apply = () => document.documentElement.setAttribute('data-theme', pref === 'dark' || (pref === 'system' && systemDark()) ? 'dark' : 'light');
    apply();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pref]);
  const isDark = pref === 'dark' || (pref === 'system' && systemDark());
  const toggle = () => {
    const next: Pref = isDark ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
    setPref(next);
  };
  return { isDark, toggle };
}

const timeNow = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
function useClock() {
  const [t, setT] = useState(timeNow);
  useEffect(() => {
    const id = setInterval(() => setT(timeNow()), 15_000);
    return () => clearInterval(id);
  }, []);
  return t;
}

/* ------------------------------------------------------------------- shell */

export function AppShell() {
  const me = useAsync(() => data.me(), []);
  const loc = useLocation();
  const nav = useNavigate();
  const theme = useTheme();
  const clock = useClock();

  // Returning login lands on /app?connect=1: hand the extension a fresh token, then drop the flag.
  useEffect(() => {
    if (me.status === 'ready' && me.value && new URLSearchParams(loc.search).get('connect') === '1') {
      data.connectExtension().finally(() => nav(loc.pathname, { replace: true }));
    }
  }, [me.status, loc.search, loc.pathname, nav]); // eslint-disable-line react-hooks/exhaustive-deps

  if (me.status === 'loading')
    return (
      <DesktopPattern className="min-h-dvh grid place-items-center">
        <Loading label="Opening your record" />
      </DesktopPattern>
    );
  if (me.status === 'error')
    return (
      <DesktopPattern className="min-h-dvh grid place-items-center p-4">
        <ErrorNote error={me.error} retry={me.reload} />
      </DesktopPattern>
    );
  if (!me.value) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;

  const user = me.value;
  const trialDays = daysUntil(user.trialEndsAt);
  const expired = user.plan === 'expired';
  const onWelcome = loc.pathname.startsWith('/app/welcome');
  const items: MenuItem[] = NAV.map((n) => ({ label: n.label, to: n.to, current: n.match(loc.pathname) }));
  const signOut = async () => {
    await data.logout();
    location.assign('/login');
  };

  return (
    <MeCtx.Provider value={{ me: user, reload: me.reload }}>
      <DesktopPattern className="min-h-dvh text-ink">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-8 focus:left-2 label-plate z-50">
          Skip to content
        </a>
        <MenuBar
          label="App"
          items={items}
          linkAs={Link}
          brandTo="/app"
          right={
            <>
              <span className="menubar-item tabular" aria-label="Clock" style={{ cursor: 'default' }}>
                {clock}
              </span>
              <button type="button" className="menubar-item" aria-label={theme.isDark ? 'Switch to Daytime theme' : 'Switch to After Dark theme'} title={theme.isDark ? 'Daytime' : 'After Dark'} onClick={theme.toggle}>
                <Icon name={theme.isDark ? 'sun' : 'moon'} />
              </button>
              <span className="marginal hide-phone self-center px-2 truncate max-w-[16rem]" title={user.email}>
                {user.email}
              </span>
              <Button variant="quiet" size="sm" className="self-center" onClick={signOut}>
                Sign out
              </Button>
            </>
          }
        />
        {user.plan === 'trial' && trialDays !== null && (
          <div className="on-chrome bg-chrome border-b border-frame h-6 px-4 sm:px-6 flex items-center gap-2 font-mono text-xs" role="status">
            <span>
              Trial: <span className="tabular">{trialDays}</span> day{trialDays === 1 ? '' : 's'} left.
            </span>
            <Link to="/app/settings" className="link">
              Plans
            </Link>
          </div>
        )}

        <main id="main" className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 grid gap-6 min-w-0">
          <Window inactive title="Read-only on phones" icon="warning" titleAs="div" className="lg:hidden" bodyClassName="py-2">
            <Caption>Recording happens in Chrome on your laptop. This page shows what the laptop's extension has.</Caption>
          </Window>
          {/* keyed by path so a route change mounts a fresh page and its main window zooms open (DESIGN-desktop.md §6) */}
          <div key={loc.pathname} className="grid gap-6 min-w-0">
            {expired && !onWelcome && !loc.pathname.startsWith('/app/settings') ? <Paywall /> : <Outlet />}
          </div>
        </main>
      </DesktopPattern>
    </MeCtx.Provider>
  );
}

/** The trial has ended: a dialog with a radio per plan and one default button. */
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
    <Dialog
      title="Your trial has ended"
      icon="key"
      className="max-w-2xl win-open"
      actions={
        <>
          <ButtonLink to="/app/invite" variant="quiet">
            Invite three friends instead
          </ButtonLink>
          <Button ring variant="primary" onClick={go} disabled={busy}>
            {busy ? 'Opening checkout…' : 'Continue'}
          </Button>
        </>
      }
    >
      <p className="text-sm">Your record is still yours. The views are what you pay for.</p>
      <p className="text-sm text-ink-soft">Recording, local storage, checkpoint signing and raw export never stop. Replay, sessions, patterns and the declaration come back the moment you pick a plan. Refund within 14 days, one click, no questions.</p>
      <div className="grid gap-2">
        <Radio name="paywall-plan" label="Semester, $12 for 4 months" description="Recommended." checked={plan === 'semester'} onChange={() => setPlan('semester')} />
        <Radio name="paywall-plan" label="Monthly, $3.99" checked={plan === 'monthly'} onChange={() => setPlan('monthly')} />
      </div>
      <Caption>Price and renewal date are shown on the checkout button. Invite three friends and a semester is free.</Caption>
    </Dialog>
  );
}
