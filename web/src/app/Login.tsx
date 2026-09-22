import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSiteConfig } from '../lib/config';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { data } from '../lib/data';
import { useAsync, usePageTitle } from '../components/useAsync';
import { Button, Field, Marginal, Sheet, inputCls } from '../components/ui';
import { PublicShell } from './shared';

export default function Login() {
  const cfg = useSiteConfig();
  usePageTitle('Sign in');
  const [params] = useSearchParams();
  const { code } = useParams();
  const me = useAsync(() => data.me(), []);
  const referral = params.get('ref') || code || undefined;
  if (me.status === 'ready' && me.value) return <Navigate to="/app" replace />;
  if (cfg.clerkPublishableKey && me.status === 'ready') return <ClerkLogin referral={referral} freeAccess={cfg.freeAccess} />;
  return <MagicLinkLogin referral={referral} freeAccess={cfg.freeAccess} expired={params.get('error') === 'expired'} />;
}

/** Clerk's hosted box (Google, email code). Once Clerk has a session, its token is exchanged
 *  for our own httpOnly cookie; Clerk never learns anything about the writing record. */
function ClerkLogin({ referral, freeAccess }: { referral?: string; freeAccess: boolean }) {
  const [Ui, setUi] = useState<null | typeof import('@clerk/clerk-react')>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    import('@clerk/clerk-react').then((m) => setUi(() => m));
  }, []);
  if (!Ui) return <PublicShell><div className="max-w-md mx-auto text-sm text-ink-soft">Loading sign-in…</div></PublicShell>;
  const { SignIn, useAuth } = Ui;
  function Exchange() {
    const { isSignedIn, getToken } = useAuth();
    const started = useRef(false);
    useEffect(() => {
      if (!isSignedIn || started.current) return;
      started.current = true;
      (async () => {
        try {
          const token = await getToken();
          if (!token) throw new Error('Clerk gave no session token.');
          const r = await data.clerkSignIn(token, referral);
          navigate(r.first ? '/app/welcome' : '/app?connect=1', { replace: true });
        } catch (e) {
          setError((e as Error).message);
          started.current = false;
        }
      })();
    }, [isSignedIn, getToken]);
    return null;
  }
  return (
    <PublicShell>
      <div className="max-w-md mx-auto grid gap-4">
        <Exchange />
        <Sheet className="p-4 sm:p-6 grid gap-3">
          <Marginal>Sign in</Marginal>
          <h1 className="text-2xl">Sign in with Google or your email.</h1>
          <p className="text-ink-soft text-sm">Any address works; .edu is not required. {freeAccess ? 'Free during early access, no card.' : '14-day trial, no card.'} Your writing never leaves your device.</p>
          {referral && (
            <p className="text-sm text-ink-soft">
              Invited with code <span className="font-mono text-ink">{referral}</span>. Your first replay counts toward your friend's free semester.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-paste">
              {error}
            </p>
          )}
          <div className="grid place-items-center">
            <SignIn routing="hash" signUpUrl="/login" forceRedirectUrl="/login" />
          </div>
        </Sheet>
      </div>
    </PublicShell>
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

  return (
    <PublicShell>
      <div className="max-w-md mx-auto">
        <Sheet className="p-6 sm:p-8 grid gap-5">
          <Marginal>Sign in</Marginal>
          {state.kind === 'sent' ? (
            <div className="grid gap-3">
              <h1 className="text-2xl">Check your inbox.</h1>
              <p className="text-ink-soft">
                We sent a sign-in link to <span className="font-mono text-ink break-all">{email.trim().toLowerCase()}</span>. It works once and expires in 30 minutes.
              </p>
              <p className="text-sm text-ink-soft">
                Nothing there? Look in spam, or{' '}
                <button className="link" onClick={() => setState({ kind: 'idle' })}>
                  send another
                </button>
                .
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-4" aria-busy={state.kind === 'busy'}>
              <h1 className="text-2xl">Your email is the only password.</h1>
              <p className="text-ink-soft text-sm">We email you a link. No password to forget, nothing to reset. Any address works; .edu is not required.</p>
              {expired && (
                <p role="alert" className="text-sm border border-paste/50 bg-paste/5 rounded px-3 py-2">
                  That link expired or was already used. Request a fresh one.
                </p>
              )}
              {referral && (
                <p className="text-sm text-ink-soft">
                  Invited with code <span className="font-mono text-ink">{referral}</span>. Your first replay counts toward your friend's free semester.
                </p>
              )}
              <Field label="Email" id="email">
                <input id="email" type="email" autoComplete="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu" />
              </Field>
              {state.kind === 'error' && (
                <p role="alert" className="text-sm text-paste">
                  {state.message}
                </p>
              )}
              <Button type="submit" size="lg" disabled={state.kind === 'busy' || !email.includes('@')}>
                {state.kind === 'busy' ? 'Sending…' : 'Email me a sign-in link'}
              </Button>
              <p className="text-xs text-ink-faint">Signing in creates an account if you do not have one. {cfg.freeAccess ? 'Free during early access, no card.' : '14-day trial, no card.'} Your writing never leaves your device.</p>
            </form>
          )}
        </Sheet>
      </div>
    </PublicShell>
  );
}
