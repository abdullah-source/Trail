// Referral waitlist card. Join with an email, then see your place in line, your share link and
// share buttons. A visitor who arrived on /?ref=CODE carries that code (localStorage trail_ref) into
// the join; a visitor who already joined on this browser sees their status (localStorage
// trail_waitlist_code). Styled as a note on the security-document kit (DESIGN-document.md).
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Chip, Icon, Note, TextField, Ticker } from '../design/document';
import { data } from '../lib/data';
import type { WaitlistStatus } from '../lib/types';
import { captureRef, instagramText, normalizeCode, PLACES_PER_REFERRAL, positionText, referralsText, saveCode, shareText, storedCode, waitingText, whatsappUrl, xUrl, captureSrc, sourceFor, SHOW_COUNTER_FROM } from '../lib/waitlist';

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** The public counter, refreshed once a minute while the page is open. */
function useWaitlistTotal(bump: number): number | null {
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    const load = () =>
      data
        .waitlistStats()
        .then((s) => live && setTotal(s.total))
        .catch(() => undefined);
    load();
    const t = setInterval(load, 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [bump]);
  return total;
}

/** "A friend invited you": shown when the visitor arrived with someone's share code. */
export function InvitedBanner() {
  return (
    <p className="text-sm flex flex-wrap items-center gap-x-2.5 gap-y-1.5" role="status">
      <Chip kind="accent">Invited</Chip>
      <span>A friend invited you. Join and you both move up the line.</span>
    </p>
  );
}

export function WaitlistCard({ source, compact = false }: { source: string; compact?: boolean }) {
  const location = useLocation();
  const [ref, setRef] = useState<string | null>(null);
  const [channel, setChannel] = useState<string | null>(null);
  const [status, setStatus] = useState<WaitlistStatus | null>(null);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [badLink, setBadLink] = useState(false);
  const [copied, setCopied] = useState<'link' | 'story' | null>(null);
  const total = useWaitlistTotal(status?.total ?? 0);

  // ?ref= from the URL, ?waitlist=confirmed&code= from the confirmation email, or a code saved earlier.
  useEffect(() => {
    setRef(captureRef(location.search));
    setChannel(captureSrc(location.search));
    const q = new URLSearchParams(location.search);
    const confirmedCode = q.get('waitlist') === 'confirmed' ? normalizeCode(q.get('code')) : null;
    setBadLink(q.get('waitlist') === 'invalid');
    if (confirmedCode) {
      saveCode(confirmedCode);
      setJustConfirmed(true);
    }
    const code = confirmedCode ?? storedCode();
    if (!code) return;
    let live = true;
    data
      .waitlistStatus(code)
      .then((s) => {
        if (!live) return;
        if (s) setStatus(s);
        else saveCode(null); // the code is gone (e.g. the account was deleted)
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [location.search]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState('busy');
    try {
      const r = await data.joinWaitlist(email.trim(), sourceFor(source, channel), ref);
      saveCode(r.code);
      setStatus(r);
      setState('idle');
    } catch {
      setState('error');
    }
  };

  const flash = async (what: 'link' | 'story', text: string) => {
    if (await copy(text)) {
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const shown = Math.max(total ?? 0, status?.total ?? 0);
  const counter =
    shown >= SHOW_COUNTER_FROM ? (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1" title={waitingText(shown)}>
        <Ticker value={shown} label="people waiting" live size={compact ? '1.5rem' : '2rem'} />
        <span className="text-sm text-ink-soft" aria-hidden>
          people waiting
        </span>
      </div>
    ) : null;

  if (!status) {
    return (
      <Note label="Join the waitlist" crop={!compact} className="content-start">
        {ref && <InvitedBanner />}
        {badLink && <p className="text-sm">That confirmation link no longer works. Join again with the same email and we will send a fresh one.</p>}
        <form onSubmit={submit} className={compact ? 'flex flex-wrap items-end gap-3' : 'grid gap-3 justify-items-start'} aria-busy={state === 'busy'}>
          <TextField id={`wl-${source}`} label="Email" type="email" required autoComplete="email" placeholder="you@university.edu" value={email} onChange={(e) => setEmail(e.target.value)} wrapClassName={compact ? 'flex-1 min-w-[12rem]' : 'w-full'} />
          <Button type="submit" variant="primary" disabled={state === 'busy' || !email.includes('@')}>
            {state === 'busy' ? 'Joining…' : 'Join the waitlist'}
          </Button>
          {state === 'error' && (
            <p role="alert" className="text-sm w-full inline-flex items-start gap-2">
              <Icon name="warning" size={18} className="mt-0.5 text-seal shrink-0" />
              That did not go through. Try again in a moment.
            </p>
          )}
        </form>
        {!compact && <p className="text-sm text-ink-soft">One email to confirm your spot, one the day the Chrome Web Store listing is live. No newsletter, no sharing your address.</p>}
        {counter}
      </Note>
    );
  }

  const url = status.share_url;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const refs = referralsText(status.referrals);
  return (
    <Note label="Your place in line" crop={!compact} className="content-start">
      <p className="numeral text-3xl">{positionText(status.position)}</p>
      <p className="text-sm">Each friend who confirms moves you up {PLACES_PER_REFERRAL} places.</p>
      {refs && <p className="text-sm text-ink-soft">{refs}</p>}
      <div className="flex flex-wrap items-end gap-2">
        <TextField id={`wl-link-${source}`} label="Your link" readOnly value={url} onFocus={(e) => e.currentTarget.select()} wrapClassName="flex-1 min-w-[12rem]" className="mono text-sm" />
        <Button onClick={() => flash('link', url)}>{copied === 'link' ? 'Copied' : 'Copy'}</Button>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Share">
        {canShare ? (
          <Button onClick={() => navigator.share({ title: 'Trail waitlist', text: shareText(url), url }).catch(() => undefined)}>Share</Button>
        ) : (
          <>
            <a className="btn btn-secondary" href={whatsappUrl(url)} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
            <a className="btn btn-secondary" href={xUrl(url)} target="_blank" rel="noreferrer">
              X
            </a>
          </>
        )}
        <Button onClick={() => flash('story', instagramText(url))}>{copied === 'story' ? 'Copied' : 'Copy for Instagram story'}</Button>
      </div>
      {status.confirmed ? (
        <p className="text-sm inline-flex items-center gap-2">
          <Icon name="check" size={18} className="text-typed" />
          {justConfirmed ? 'Your spot is confirmed.' : 'Your email is confirmed.'}
        </p>
      ) : (
        <p className="text-sm">Check your email to confirm your spot.</p>
      )}
      {counter}
      <button
        type="button"
        className="link text-xs justify-self-start"
        onClick={() => {
          saveCode(null);
          setStatus(null);
          setJustConfirmed(false);
        }}
      >
        Not you? Use another email
      </button>
    </Note>
  );
}

export default WaitlistCard;
