import { useState, type FormEvent } from 'react';
import { useSiteConfig } from '../lib/config';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
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
  const [email, setEmail] = useState('');
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'busy' } | { kind: 'sent'; created: boolean } | { kind: 'error'; message: string }>({ kind: 'idle' });
  const referral = params.get('ref') || code || undefined;
  const expired = params.get('error') === 'expired';

  if (me.status === 'ready' && me.value) return <Navigate to="/app" replace />;

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
