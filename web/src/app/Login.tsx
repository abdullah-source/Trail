import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useSiteConfig } from '../lib/config';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { data } from '../lib/data';
import { useAsync, usePageTitle } from '../components/useAsync';
import { Button, Guilloche, Icon, Note, TextField } from '../design/document';
import { PublicShell } from './shared';

export default function Login() {
  const cfg = useSiteConfig();
  usePageTitle('Sign in');
  const [params] = useSearchParams();
  const { code } = useParams();
  const me = useAsync(() => data.me(), []);
  const referral = params.get('ref') || code || undefined;
  if (me.status === 'ready' && me.value) return <Navigate to="/app" replace />;
  if (cfg.clerkPublishableKey && me.status === 'ready') return <ClerkLogin referral={referral} freeAccess={cfg.freeAccess} signUp={params.get('mode') === 'signup'} />;
  return <MagicLinkLogin referral={referral} freeAccess={cfg.freeAccess} expired={params.get('error') === 'expired'} />;
}

/** The "Log in" note: narrow, centred, framed, with a faint rosette engraved behind the page. */
function SignInDialog({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center" aria-hidden="true">
        <div className="w-[min(640px,96vw)] aspect-square">
          <Guilloche seed="login" intensity="faint" />
        </div>
      </div>
      <PublicShell>
        <Note frame label="Trail account" className="relative">
          <h1 className="note-title">Log in</h1>
          {children}
          {actions && <div className="grid gap-3">{actions}</div>}
        </Note>
      </PublicShell>
    </div>
  );
}

function Warn({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm inline-flex items-start gap-2">
      <Icon name="warning" size={18} className="mt-0.5 text-seal shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Clerk's hosted box (Google, email code). Once Clerk has a session, its token is exchanged
 *  for our own httpOnly cookie; Clerk never learns anything about the writing record. */
function ClerkLogin({ referral, freeAccess, signUp }: { referral?: string; freeAccess: boolean; signUp: boolean }) {
  const [Ui, setUi] = useState<null | typeof import('@clerk/clerk-react')>(null);
  useEffect(() => {
    import('@clerk/clerk-react').then((m) => setUi(() => m));
  }, []);
  if (!Ui)
    return (
      <SignInDialog>
        <p className="text-sm text-ink-soft" role="status">
          Loading sign-in…
        </p>
      </SignInDialog>
    );
  const { SignIn, SignUp, useAuth } = Ui;
  function Exchange() {
    // Clerk already has a session (e.g. our cookie expired): finish on the handoff page.
    const { isSignedIn } = useAuth();
    useEffect(() => {
      if (isSignedIn) location.replace('/login/done');
    }, [isSignedIn]);
    return null;
  }
  return (
    <SignInDialog>
      <Exchange />
      <h2 className="text-lg font-semibold">{signUp ? 'Create your account.' : 'Sign in with Google or your email.'}</h2>
      <p className="text-ink-soft text-sm">Any address works; .edu is not required. {freeAccess ? 'Free during early access, no card.' : '14-day trial, no card.'} Your writing never leaves your device.</p>
      {referral && (
        <p className="text-sm text-ink-soft">
          Invited with code <span className="font-mono text-ink">{referral}</span>. Your first replay counts toward your friend's free semester.
        </p>
      )}
      <div className="grid place-items-center">{signUp ? <SignUp routing="hash" signInUrl="/login" forceRedirectUrl="/login/done" /> : <SignIn routing="hash" signUpUrl="/login?mode=signup" forceRedirectUrl="/login/done" />}</div>
    </SignInDialog>
  );
}

function MagicLinkLogin({ referral, freeAccess, expired }: { referral?: string; freeAccess: boolean; expired: boolean }) {
  const cfg = { freeAccess };
  const [email, setEmail] = useState('');
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'busy' } | { kind: 'sent'; created: boolean } | { kind: 'error'; message: string }>({ kind: 'idle' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState({ kind: 'busy' });
    try {
      const r = await data.requestMagicLink(email.trim(), referral);
      setState({ kind: 'sent', created: r.created });
    } catch (err) {
      setState({ kind: 'error', message: (err as Error).message });
    }
  };

  if (state.kind === 'sent')
    return (
      <SignInDialog
        actions={
          <Button variant="secondary" className="w-full" onClick={() => setState({ kind: 'idle' })}>
            Send another
          </Button>
        }
      >
        <h2 className="text-lg font-semibold">Check your inbox.</h2>
        <p className="text-ink-soft">
          We sent a sign-in link to <span className="font-mono text-ink [overflow-wrap:anywhere]">{email.trim().toLowerCase()}</span>. It works once and expires in 30 minutes.
        </p>
        <p className="text-sm text-ink-soft">
          Nothing there? Look in spam, or{' '}
          <button type="button" className="link" onClick={() => setState({ kind: 'idle' })}>
            send another
          </button>
          .
        </p>
      </SignInDialog>
    );

  return (
    <SignInDialog
      actions={
        <Button type="submit" form="login-form" variant="primary" size="lg" icon="key" className="w-full" disabled={state.kind === 'busy' || !email.includes('@')}>
          {state.kind === 'busy' ? 'Sending…' : 'Email me a sign-in link'}
        </Button>
      }
    >
      <form id="login-form" onSubmit={submit} className="grid gap-4" aria-busy={state.kind === 'busy'}>
        <h2 className="text-lg font-semibold">Your email is the only password.</h2>
        <p className="text-ink-soft text-sm">We email you a link. No password to forget, nothing to reset. Any address works; .edu is not required.</p>
        {expired && <Warn>That link expired or was already used. Request a fresh one.</Warn>}
        {referral && (
          <p className="text-sm text-ink-soft">
            Invited with code <span className="font-mono text-ink">{referral}</span>. Your first replay counts toward your friend's free semester.
          </p>
        )}
        <TextField id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu" hint="For the sign-in link and nothing else." />
        {state.kind === 'error' && <Warn>{state.message}</Warn>}
        <p className="text-sm text-ink-soft">Signing in creates an account if you do not have one. {cfg.freeAccess ? 'Free during early access, no card.' : '14-day trial, no card.'} Your writing never leaves your device.</p>
      </form>
    </SignInDialog>
  );
}

/** /login/done: Clerk lands here after sign-in or sign-up. One job: swap Clerk's token for our
 *  cookie, then hard-navigate so the app loads with a fresh session and nothing races. */
export function ClerkDone() {
  usePageTitle('Signing you in');
  const cfg = useSiteConfig();
  const [params] = useSearchParams();
  const [msg, setMsg] = useState<string>('Signing you in…');
  const referral = params.get('ref') || undefined;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const already = await data.me();
        if (already) {
          location.replace('/app');
          return;
        }
        const clerk = (window as any).Clerk;
        // Clerk's script may still be booting: wait up to ~8s for a session.
        for (let i = 0; i < 40 && !clerk?.session; i++) await new Promise((r) => setTimeout(r, 200));
        const session = (window as any).Clerk?.session;
        if (!session) {
          location.replace('/login');
          return;
        }
        const token = await session.getToken();
        if (!token) throw new Error('no token');
        const r = await data.clerkSignIn(token, referral);
        if (cancelled) return;
        location.replace(r.first ? '/app/welcome' : '/app?connect=1');
      } catch (e) {
        if (!cancelled) setMsg(`Sign-in did not complete (${(e as Error).message}). Go back and try again.`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <SignInDialog
      actions={
        <Button variant="secondary" className="w-full" onClick={() => location.replace('/login')}>
          Back to sign in
        </Button>
      }
    >
      <p className="text-ink-soft" role="status">
        {msg}
      </p>
      {!cfg.clerkPublishableKey && <Navigate to="/login" replace />}
    </SignInDialog>
  );
}
