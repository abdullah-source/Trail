// Settings is a control panel: a chrome-bodied window with the key icon and a panel per group
// (Account, Plan, Extension, Your data, Delete everything). Anything irreversible asks in a dialog
// with the warning icon and the ring on Cancel (DESIGN-desktop.md §4).
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { data, download, safeName } from '../lib/data';
import { useMe } from '../components/AppShell';
import { useAsync, usePageTitle } from '../components/useAsync';
import { Button, ButtonLink, Caption, Checkbox, Chip, Dialog, Panel, Radio, TextField, Window } from '../components/ui';
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
    <Window as="section" titleAs="h1" title="Settings" icon="key" chrome open className="max-w-3xl" bodyClassName="grid gap-4">
      {checkout === 'success' && <Caption role="status">Thank you. Your plan is active as soon as Stripe confirms the payment, usually within a few seconds; reload if it does not show yet.</Caption>}
      {checkout === 'cancelled' && <Caption role="status">Checkout cancelled. Nothing was charged.</Caption>}

      <Panel legend="Account" className="grid gap-3">
        <p className="text-sm">
          Signed in as <span className="font-mono">{me.email}</span> since {fmtDateLong(me.createdAt)}.
        </p>
        <div>
          <Button
            onClick={async () => {
              await data.logout();
              location.assign('/login');
            }}
          >
            Sign out
          </Button>
        </div>
      </Panel>

      <PlanPanel reload={reload} />
      <ExtensionPanel />

      <Panel legend="Your data" className="grid gap-3">
        <p className="text-sm text-ink-soft">Everything Trail records lives in the extension on this computer: your essays' events and the homework time log (active minutes on school sites, with course and assignment names). Export it any time; it is yours whether or not you pay.</p>
        <ExportAll />
        <ExportWorklog />
      </Panel>

      <DeletePanel />
    </Window>
  );
}

function PlanPanel({ reload }: { reload: () => void }) {
  const { me } = useMe();
  const [pick, setPick] = useState<'semester' | 'monthly'>('semester');
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
    <Panel legend="Plan" className="grid gap-3">
      <div className="display text-xl">{me.billing.freeAccess ? FREE_ACCESS_LABEL : PLAN_LABEL[me.plan] || me.plan}</div>
      <p className="text-sm text-ink-soft">
        {me.billing.freeAccess && 'Every feature, no card, no clock. While Trail is in early access nothing is charged. If that ever changes you will hear it from us first, with notice, and recording, signing and export never lock.'}
        {me.plan === 'trial' && (me.trialEndsAt ? `${trialDays} day${trialDays === 1 ? '' : 's'} left, ends ${fmtDateLong(me.trialEndsAt)}. No card on file.` : 'Your 14 days start the first time you play a replay, not today.')}
        {me.plan === 'expired' && 'Replay, patterns, declaration and packs are paused. Recording, signing and raw export continue.'}
        {paid && me.currentPeriodEnd && (me.cancelAtPeriodEnd ? `Cancelled. Access continues until ${fmtDateLong(me.currentPeriodEnd)}; nothing more will be charged.` : `Renews ${fmtDateLong(me.currentPeriodEnd)}. We email you 7 days before.`)}
        {!me.billing.freeAccess && me.plan === 'free' && me.freeUntil && `Earned with invites. Free until ${fmtDateLong(me.freeUntil)}.`}
      </p>

      {!paid && !me.billing.freeAccess && (
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Radio name="plan" label="Semester, $12 for 4 months" description={`Recommended. Renews ${renew(4)}.`} checked={pick === 'semester'} onChange={() => setPick('semester')} />
            <Radio name="plan" label="Monthly, $3.99" description={`Renews ${renew(1)}.`} checked={pick === 'monthly'} onChange={() => setPick('monthly')} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={() => go(pick)} disabled={busy !== null || !me.billing.configured}>
              {busy === pick ? 'Opening checkout…' : pick === 'semester' ? 'Pay $12' : 'Pay $3.99'}
            </Button>
            <Caption>
              Cancel any time in one click, no retention screens. Any charge is refunded in full within 14 days, from this page. Prices in USD; Stripe shows your local currency.
              {!me.billing.configured && ' Payments are not switched on for this server yet.'}
            </Caption>
          </div>
        </div>
      )}

      {me.billing.hasCustomer && (
        <div className="flex flex-wrap gap-3">
          <Button
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
      {msg && <Caption role="status">{msg}</Caption>}
    </Panel>
  );
}

function ExtensionPanel() {
  const st = useAsync(() => data.extensionStatus(), []);
  const [connecting, setConnecting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const installed = st.status === 'ready' && st.value.installed;
  const connected = st.status === 'ready' && st.value.connected;
  return (
    <Panel legend="Extension" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {st.status === 'loading' && <Chip kind="neutral">checking…</Chip>}
        {st.status === 'ready' && !installed && <Chip kind="neutral">not installed</Chip>}
        {st.status === 'ready' && installed && !connected && <Chip kind="mixed">installed</Chip>}
        {st.status === 'ready' && connected && <Chip kind="typed">connected</Chip>}
        <span>
          {st.status === 'loading' && 'Checking…'}
          {st.status === 'ready' && !installed && 'Not installed in this browser.'}
          {st.status === 'ready' && installed && !connected && `Installed (v${st.value.version}) but not connected: checkpoints are not being signed.`}
          {st.status === 'ready' && connected && `Installed (v${st.value.version}) and connected. Checkpoints are signed every 10 minutes.`}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {!installed && st.status === 'ready' && (
          <ButtonLink to={CHROME_STORE_URL} external>
            Get Trail for Chrome
          </ButtonLink>
        )}
        {!installed && st.status === 'ready' && <Caption>Already loaded it unpacked? Click the Trail icon in Chrome's toolbar, then "Open my writing record", so the app learns its id.</Caption>}
        {installed && !connected && (
          <Button
            disabled={connecting}
            onClick={async () => {
              setConnecting(true);
              const ok = await data.connectExtension();
              setNote(ok ? 'Connected.' : 'Could not hand the extension its token. Reload and try again.');
              setConnecting(false);
              st.reload();
            }}
          >
            {connecting ? 'Connecting…' : 'Connect'}
          </Button>
        )}
        {note && <Caption role="status">{note}</Caption>}
      </div>
    </Panel>
  );
}

function ExportAll() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
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
      {msg && <Caption role="status">{msg}</Caption>}
    </div>
  );
}

function ExportWorklog() {
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        disabled={busy !== null}
        onClick={async () => {
          setBusy('export');
          setMsg(null);
          try {
            download(await data.exportWorklog(), `trail-homework-time-${new Date().toISOString().slice(0, 10)}.json`);
            setMsg('Exported. Course and assignment names are in the file; it has never been anywhere but this computer.');
          } catch (e) {
            setMsg((e as Error).message);
          } finally {
            setBusy(null);
          }
        }}
      >
        {busy === 'export' ? 'Exporting…' : 'Export homework time (.json)'}
      </Button>
      <Button variant="quiet" disabled={busy !== null} onClick={() => setConfirm(true)}>
        Delete the time log…
      </Button>
      {msg && <Caption role="status">{msg}</Caption>}
      {confirm && (
        <Dialog
          modal
          role="alertdialog"
          title="Delete the homework time log?"
          icon="warning"
          iconFill={{ w: 'var(--paste)' }}
          onClose={() => setConfirm(false)}
          width={480}
          actions={
            <>
              <Button
                disabled={busy !== null}
                onClick={async () => {
                  setBusy('delete');
                  setMsg(null);
                  try {
                    await data.deleteWorklog();
                    setMsg('Homework time log deleted.');
                    setConfirm(false);
                  } catch (e) {
                    setMsg((e as Error).message);
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {busy === 'delete' ? 'Deleting…' : 'Delete the log'}
              </Button>
              <Button ring onClick={() => setConfirm(false)}>
                Cancel
              </Button>
            </>
          }
        >
          <p className="text-sm">The time log on this computer is removed. Your essays and their records are not touched. This cannot be undone.</p>
        </Dialog>
      )}
    </div>
  );
}

function DeletePanel() {
  const { me } = useMe();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [alsoLocal, setAlsoLocal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const armed = confirm.trim().toLowerCase() === me.email.toLowerCase();
  return (
    <Panel legend="Delete everything" className="grid gap-3">
      <p className="text-sm text-ink-soft">Deleting your account removes every row Trail holds about you: your email, plan, signed checkpoint hashes, and invites. Any subscription is cancelled. Your essays, their records and the homework time log stay on this computer unless you also ask for them to go.</p>
      <div>
        <Button onClick={() => setOpen(true)}>Delete my account…</Button>
      </div>
      {open && (
        <Dialog
          modal
          role="alertdialog"
          title="Delete your account?"
          icon="warning"
          iconFill={{ w: 'var(--paste)' }}
          onClose={() => !busy && setOpen(false)}
          width={520}
          actions={
            <>
              <Button
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
              <Button ring onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
            </>
          }
        >
          <p className="text-sm">Every row Trail holds about you goes, and any subscription is cancelled. This cannot be undone.</p>
          <Checkbox label="Also wipe the extension's local records on this computer" description="Essays, their events and checkpoints, and the homework time log." checked={alsoLocal} onChange={(e) => setAlsoLocal(e.target.checked)} />
          <TextField id="delete-confirm" label="Type your email to confirm" placeholder={me.email} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          {err && (
            <p role="alert" className="text-sm">
              {err}
            </p>
          )}
        </Dialog>
      )}
    </Panel>
  );
}
