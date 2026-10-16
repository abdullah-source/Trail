// Invite: one note with the link in a read-only field and a Copy secondary button, and the progress
// toward the next free semester as a pill track (DESIGN-document.md §9, "Settings / Invite").
import { useState } from 'react';
import { data } from '../lib/data';
import { useMe } from '../components/AppShell';
import { useAsync, usePageTitle } from '../components/useAsync';
import { Button, Caption, ErrorNote, Icon, Loading, Marginal, Note, ProgressBar, SectionHead, TextField } from '../components/ui';
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
    <section className="grid gap-10 min-w-0 max-w-3xl" aria-labelledby="invite-title">
      <SectionHead as="h1" kicker="Invite" index="Nº 04" title={<span id="invite-title">Three friends, one free semester.</span>} />
      <Note
        label={
          <span className="inline-flex items-center gap-2">
            <Icon name="link" size={16} /> Your invite
          </span>
        }
        aside={
          <span className="font-mono text-xs tabular text-ink-soft">
            {progress} of {r.needed}
          </span>
        }
      >
        <p className="text-sm text-ink-soft max-w-prose">
          {me.billing.freeAccess
            ? 'Trail is free for everyone during early access. Invites still count: when three people you invite play their first replay, a free semester is banked for you for whenever pricing switches on.'
            : 'When three people you invite play their first replay, you get a semester free. Up to three times. They get the same 14-day trial as everyone.'}
        </p>

        <div className="grid gap-2">
          <div className="grid sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-3 items-end">
            <TextField id="invite-link" label="Your link" readOnly value={r.link} onFocus={(e) => e.currentTarget.select()} className="font-mono text-sm" />
            <Button
              icon="copy"
              className="h-11"
              onClick={async () => {
                setCopied(await copyText(r.link));
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
            {canShare && (
              <Button variant="quiet" className="h-11" onClick={() => navigator.share({ text: share }).catch(() => undefined)}>
                Share…
              </Button>
            )}
          </div>
          <Caption>
            Code <span className="text-ink">{r.code}</span>. Anyone who signs in with it counts once they play a first replay.
          </Caption>
        </div>

        <section className="grid gap-3 pt-2">
          <Marginal as="h2">Progress</Marginal>
          <div className="flex items-center gap-4">
            <ProgressBar value={r.needed ? progress / r.needed : 0} tone="typed" label={`${progress} of ${r.needed} activated invites toward the next free semester`} />
            <span className="numeral text-2xl tabular">
              {progress}
              <span className="text-ink-soft text-base">/{r.needed}</span>
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
      </Note>
    </section>
  );
}
