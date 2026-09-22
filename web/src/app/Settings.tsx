import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { data, download, safeName } from '../lib/data';
import { useMe } from '../components/AppShell';
import { useAsync, usePageTitle } from '../components/useAsync';
import { Button, ButtonLink, Marginal, Rule, SectionHead, Sheet, cx, inputCls } from '../components/ui';
import { daysUntil, fmtDateLong } from '../components/format';
import { CHROME_STORE_URL } from './shared';

const PLAN_LABEL: Record<string, string> = { trial: 'Free trial', semester: 'Semester plan', monthly: 'Monthly plan', expired: 'Trial ended', free: 'Free semester (invites)' };
const FREE_ACCESS_LABEL = 'Free, early access';

export default function Settings() {
  usePageTitle('Settings');
  const { me, reload } = useMe();
  const [params] = useSearchParams();
  const checkout = params.get('checkout');
  return (
    <div className="grid gap-12 max-w-2xl">
      <SectionHead kicker="Settings" title="Account, plan, extension, data." />
      {checkout === 'success' && (
        <p role="status" className="border border-typed/40 bg-typed/5 rounded-lg px-4 py-3 text-sm">
          Thank you. Your plan is active as soon as Stripe confirms the payment, usually within a few seconds; reload if it does not show yet.
        </p>
      )}
      {checkout === 'cancelled' && (
        <p role="status" className="border border-rule rounded-lg px-4 py-3 text-sm text-ink-soft">
          Checkout cancelled. Nothing was charged.
        </p>
      )}

      <section className="grid gap-3">
        <Marginal>Account</Marginal>
        <p className="text-sm">
          Signed in as <span className="font-mono">{me.email}</span> since {fmtDateLong(me.createdAt)}.
        </p>
        <div>
          <Button
            variant="secondary"
            onClick={async () => {
              await data.logout();
              location.assign('/login');
            }}
          >
            Sign out
          </Button>
        </div>
      </section>

      <PlanCard reload={reload} />
      <ExtensionCard />

      <section className="grid gap-3">
        <Marginal>Your data</Marginal>
        <p className="text-sm text-ink-soft">Everything Longhand records lives in the extension on this computer. Export it any time; it is yours whether or not you pay.</p>
        <ExportAll />
      </section>

      <DeleteCard />
    </div>
  );
}

function PlanCard({ reload }: { reload: () => void }) {
  const { me } = useMe();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const go = (plan: 'semester' | 'monthly') =>
    run(plan, async () => {
      const { url } = await data.startCheckout(plan);
      location.assign(url);
    });
  const trialDays = daysUntil(me.trialEndsAt);
  const paid = me.plan === 'semester' || me.plan === 'monthly';
  const renew = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <section className="grid gap-4">
      <Marginal>Plan</Marginal>
      <Sheet className="p-5 grid gap-2">
        <div className="display text-2xl">{me.billing.freeAccess ? FREE_ACCESS_LABEL : PLAN_LABEL[me.plan] || me.plan}</div>
        <p className="text-sm text-ink-soft">
          {me.billing.freeAccess && 'Every feature, no card, no clock. While Longhand is in early access nothing is charged. If that ever changes you will hear it from us first, with notice, and recording, signing and export never lock.'}
          {me.plan === 'trial' && (me.trialEndsAt ? `${trialDays} day${trialDays === 1 ? '' : 's'} left, ends ${fmtDateLong(me.trialEndsAt)}. No card on file.` : 'Your 14 days start the first time you play a replay, not today.')}
          {me.plan === 'expired' && 'Replay, patterns, declaration and packs are paused. Recording, signing and raw export continue.'}
          {paid && me.currentPeriodEnd && (me.cancelAtPeriodEnd ? `Cancelled. Access continues until ${fmtDateLong(me.currentPeriodEnd)}; nothing more will be charged.` : `Renews ${fmtDateLong(me.currentPeriodEnd)}. We email you 7 days before.`)}
          {!me.billing.freeAccess && me.plan === 'free' && me.freeUntil && `Earned with invites. Free until ${fmtDateLong(me.freeUntil)}.`}
        </p>
      </Sheet>

      {!paid && !me.billing.freeAccess && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="border border-ink rounded-lg p-4 grid gap-2 bg-sheet">
            <span className="marginal">Semester · recommended</span>
            <div className="display text-2xl tabular">
              $12 <span className="text-sm text-ink-soft font-sans">/ 4 months</span>
            </div>
            <Button onClick={() => go('semester')} disabled={busy !== null || !me.billing.configured}>
              {busy === 'semester' ? 'Opening checkout…' : `Pay $12 · renews ${renew(4)}`}
            </Button>
          </div>
          <div className="border border-rule rounded-lg p-4 grid gap-2">
            <span className="marginal">Monthly</span>
            <div className="display text-2xl tabular">
              $3.99 <span className="text-sm text-ink-soft font-sans">/ month</span>
            </div>
            <Button variant="secondary" onClick={() => go('monthly')} disabled={busy !== null || !me.billing.configured}>
              {busy === 'monthly' ? 'Opening checkout…' : `Pay $3.99 · renews ${renew(1)}`}
            </Button>
          </div>
          <p className="sm:col-span-2 text-xs text-ink-soft">
            Cancel any time in one click, no retention screens. Any charge is refunded in full within 14 days, from this page. Prices in USD; Stripe shows your local currency.
            {!me.billing.configured && ' Payments are not switched on for this server yet.'}
          </p>
        </div>
      )}

      {me.billing.hasCustomer && (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            disabled={busy !== null}
            onClick={() =>
              run('portal', async () => {
                const { url } = await data.openBillingPortal();
                location.assign(url);
              })
            }
          >
            {busy === 'portal' ? 'Opening…' : 'Manage or cancel (Stripe portal)'}
          </Button>
          {me.billing.refundable && (
            <Button
              variant="quiet"
              disabled={busy !== null}
              onClick={() =>
                run('refund', async () => {
                  const r = await data.requestRefund();
                  setMsg(r.refunded ? 'Refunded in full. It reaches your card in 5–10 days. Your plan has ended; your record has not.' : 'Nothing to refund.');
                  reload();
                })
              }
            >
              {busy === 'refund' ? 'Refunding…' : 'Refund my last payment'}
            </Button>
          )}
        </div>
      )}
      {msg && (
        <p role="status" className="text-sm text-ink-soft">
          {msg}
        </p>
      )}
    </section>
  );
}

function ExtensionCard() {
  const st = useAsync(() => data.extensionStatus(), []);
  const [connecting, setConnecting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const installed = st.status === 'ready' && st.value.installed;
  const connected = st.status === 'ready' && st.value.connected;
  return (
    <section className="grid gap-3">
      <Marginal>Extension</Marginal>
      <div className="flex items-center gap-3 text-sm">
        <span className={cx('inline-block w-2.5 h-2.5 rounded-full', connected ? 'bg-typed' : installed ? 'bg-mixed' : 'bg-rule-strong')} aria-hidden />
        <span>
          {st.status === 'loading' && 'Checking…'}
          {st.status === 'ready' && !installed && 'Not installed in this browser.'}
          {st.status === 'ready' && installed && !connected && `Installed (v${st.value.version}) but not connected: checkpoints are not being signed.`}
          {st.status === 'ready' && connected && `Installed (v${st.value.version}) and connected. Checkpoints are signed every 10 minutes.`}
        </span>
      </div>
      <div className="flex gap-3">
        {!installed && st.status === 'ready' && (
          <ButtonLink to={CHROME_STORE_URL} external variant="secondary">
            Get Longhand for Chrome
          </ButtonLink>
        )}
        {installed && (
          <Button
            variant="secondary"
            disabled={connecting}
            onClick={async () => {
              setConnecting(true);
              const ok = await data.connectExtension();
              setNote(ok ? 'Connected.' : 'Could not hand the extension its token. Reload and try again.');
              setConnecting(false);
              st.reload();
            }}
          >
            {connecting ? 'Connecting…' : connected ? 'Reconnect' : 'Connect'}
          </Button>
        )}
        {note && (
          <span role="status" className="text-sm text-ink-soft self-center">
            {note}
          </span>
        )}
      </div>
    </section>
  );
}

function ExportAll() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const essays = await data.essays();
            if (!essays.length) setMsg('Nothing recorded yet.');
            for (const e of essays) download(await data.exportJson(e.id), `${safeName(e.title || e.id)}-events.jsonl`);
            if (essays.length) setMsg(`Exported ${essays.length} file${essays.length === 1 ? '' : 's'}.`);
          } catch (e) {
            setMsg((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Exporting…' : 'Export every essay (.jsonl)'}
      </Button>
      {msg && (
        <span role="status" className="text-sm text-ink-soft">
          {msg}
        </span>
      )}
    </div>
  );
}

function DeleteCard() {
  const { me } = useMe();
  const nav = useNavigate();
  const [confirm, setConfirm] = useState('');
  const [alsoLocal, setAlsoLocal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const armed = confirm.trim().toLowerCase() === me.email.toLowerCase();
  return (
    <section className="grid gap-3">
      <Marginal>Delete everything</Marginal>
      <Rule />
      <p className="text-sm text-ink-soft max-w-prose">
        Deleting your account removes every row Longhand holds about you: your email, plan, signed checkpoint hashes, and invites. Any subscription is cancelled. Your essays and their records stay on this computer unless you also tick the box below.
      </p>
      <label className="text-sm flex items-center gap-2">
        <input type="checkbox" checked={alsoLocal} onChange={(e) => setAlsoLocal(e.target.checked)} />
        Also wipe the extension's local records on this computer
      </label>
      <div className="grid sm:grid-cols-[1fr_auto] gap-3 max-w-lg">
        <input className={inputCls} placeholder={`Type ${me.email} to confirm`} value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Type your email to confirm deletion" />
        <Button
          variant="secondary"
          className="border-paste text-paste hover:border-paste"
          disabled={!armed || busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              if (alsoLocal) await data.clearLocalData().catch(() => undefined);
              await data.deleteAccount();
              nav('/', { replace: true });
            } catch (e) {
              setErr((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? 'Deleting…' : 'Delete my account'}
        </Button>
      </div>
      {err && (
        <p role="alert" className="text-sm text-paste">
          {err}
        </p>
      )}
    </section>
  );
}
