import { useState } from 'react';
import { data } from '../lib/data';
import { useMe } from '../components/AppShell';
import { useAsync, usePageTitle } from '../components/useAsync';
import { Button, ErrorNote, Loading, Marginal, SectionHead, Sheet, cx } from '../components/ui';
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
  const share = `I keep my own record of how I write my essays with Longhand — replay, patterns, and an honest AI-use statement. Free, no card: ${r.link}`;

  return (
    <div className="grid gap-8 max-w-2xl">
      <SectionHead kicker="Invite" title="Three friends, one free semester." lede={me.billing.freeAccess ? 'Longhand is free for everyone during early access. Invites still count: when three people you invite play their first replay, a free semester is banked for you for whenever pricing switches on.' : 'When three people you invite play their first replay, you get a semester free. Up to three times. They get the same 14-day trial as everyone.'} />

      <Sheet className="p-5 grid gap-3">
        <Marginal>Your link</Marginal>
        <div className="flex flex-wrap gap-2 items-center">
          <code className="font-mono text-sm bg-paper border border-rule rounded px-2 py-1.5 break-all flex-1 min-w-[14rem]">{r.link}</code>
          <Button
            variant="secondary"
            onClick={async () => {
              setCopied(await copyText(r.link));
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? 'Copied' : 'Copy link'}
          </Button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button variant="quiet" onClick={() => navigator.share({ text: share }).catch(() => undefined)}>
              Share…
            </Button>
          )}
        </div>
        <p className="text-xs text-ink-soft">
          Code <span className="font-mono text-ink">{r.code}</span>. Anyone who signs in with it counts once they play a first replay.
        </p>
      </Sheet>

      <section className="grid gap-3">
        <Marginal>Progress</Marginal>
        <div className="flex items-center gap-3" role="img" aria-label={`${progress} of ${r.needed} activated invites toward the next free semester`}>
          {Array.from({ length: r.needed }, (_, i) => (
            <span key={i} className={cx('h-3 flex-1 rounded-sm border', i < progress ? 'bg-typed border-typed' : 'border-rule-strong')} />
          ))}
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
    </div>
  );
}
