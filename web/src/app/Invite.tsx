// Invite is a window with the chain-link icon: the link in a sunken field with "Copy", and the
// progress toward the next free semester as a segmented bar (DESIGN-desktop.md §4).
import { useState } from 'react';
import { data } from '../lib/data';
import { useMe } from '../components/AppShell';
import { useAsync, usePageTitle } from '../components/useAsync';
import { Button, Caption, ErrorNote, Loading, Marginal, ProgressBar, TextField, Window } from '../components/ui';
import { fmtDateLong } from '../components/format';
import { copyText } from './shared';

export default function Invite() {
  usePageTitle('Invite');
  const { me } = useMe();
  const ref = useAsync(() => data.referrals(), []);
  const [copied, setCopied] = useState(false);
  if (ref.status === 'loading') return <Loading />;
  if (ref.status === 'error') return <ErrorNote error={ref.error} retry={ref.reload} />;
  const r = ref.value;
  const done = r.credits >= r.maxCredits;
  const progress = Math.min(r.needed, r.progress);
  const share = `I keep my own record of how I write my essays with Trail — replay, patterns, and an honest AI-use statement. Free, no card: ${r.link}`;
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <Window as="section" titleAs="h1" title="Invite" icon="link" right={`${progress} of ${r.needed}`} open className="max-w-2xl" bodyClassName="grid gap-4">
      <h2 className="text-xl">Three friends, one free semester.</h2>
      <p className="text-sm text-ink-soft">
        {me.billing.freeAccess
          ? 'Trail is free for everyone during early access. Invites still count: when three people you invite play their first replay, a free semester is banked for you for whenever pricing switches on.'
          : 'When three people you invite play their first replay, you get a semester free. Up to three times. They get the same 14-day trial as everyone.'}
      </p>

      <div className="grid gap-2">
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <TextField id="invite-link" label="Your link" readOnly value={r.link} onFocus={(e) => e.currentTarget.select()} />
          <Button
            onClick={async () => {
              setCopied(await copyText(r.link));
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
          {canShare && (
            <Button variant="quiet" onClick={() => navigator.share({ text: share }).catch(() => undefined)}>
              Share…
            </Button>
          )}
        </div>
        <Caption>
          Code <span className="text-ink">{r.code}</span>. Anyone who signs in with it counts once they play a first replay.
        </Caption>
      </div>

      <section className="grid gap-2">
        <Marginal as="h2">Progress</Marginal>
        <div className="flex flex-wrap items-center gap-3">
          <ProgressBar segments={r.needed * 8} value={r.needed ? progress / r.needed : 0} tone="typed" label={`${progress} of ${r.needed} activated invites toward the next free semester`} />
          <span className="font-mono text-sm tabular">
            {progress}/{r.needed}
          </span>
        </div>
        <p className="text-sm text-ink-soft">
          {r.invited} signed up, {r.activated} played a first replay, {r.credits} free semester{r.credits === 1 ? '' : 's'} earned.
          {r.freeUntil && (
            <>
              {' '}
              Free until <span className="text-ink">{fmtDateLong(r.freeUntil)}</span>.
            </>
          )}
          {done && ' You have earned the maximum; thank you.'}
        </p>
      </section>
    </Window>
  );
}
