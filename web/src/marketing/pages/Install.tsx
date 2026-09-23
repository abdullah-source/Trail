import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, ButtonLink, Card, Disclosure, Heading, Row, Section, useTitle } from '../../design/components';
import { FadeUp } from '../../design/motion';
import { data } from '../../lib/data';

const ZIP = '/trail-extension.zip';

export default function Install() {
  useTitle('Get Trail for Chrome');
  return (
    <>
      <Section flush code="00:00" label="Install">
        <Heading as="h1" eyebrow="Get Trail for Chrome" title="The extension is on its way to the Chrome Web Store." lede="Google is reviewing the listing. Until it is live, leave your email and we will tell you the day it lands, or install it yourself today in about two minutes." />
        <div className="grid md:grid-cols-2 gap-5 mt-10 items-start">
          <WaitlistCard source="install" />
          <Card className="grid gap-3">
            <span className="marginal">Install today</span>
            <h2 className="text-xl">Load it yourself, no store needed.</h2>
            <ol className="grid gap-2 text-sm list-decimal pl-5">
              <li>
                <a className="link" href={ZIP} download>
                  Download trail-extension.zip
                </a>{' '}
                and unzip it. Keep the folder somewhere it will not be deleted.
              </li>
              <li>
                In Chrome open <span className="font-mono">chrome://extensions</span> and switch on <b>Developer mode</b> (top right).
              </li>
              <li>
                Click <b>Load unpacked</b> and choose the unzipped folder.
              </li>
              <li>Pin Trail from the puzzle-piece menu, click it, then <b>Open my writing record</b> and sign in.</li>
              <li>Write in Google Docs or Notion. Your first replay is one paragraph away.</li>
            </ol>
            <p className="text-xs text-ink-soft">Chrome on a laptop. Chrome will show an “unpacked extension” notice on launch; that is what an unlisted extension looks like. The store version replaces it with one click.</p>
          </Card>
        </div>
      </Section>

      <Section code="00:12" label="Already have it">
        <FadeUp inView>
          <Heading title="Already installed?" lede="Then you only need to sign in." />
          <div className="flex flex-wrap gap-3 mt-6">
            <ButtonLink to="/login">Sign in</ButtonLink>
            <ButtonLink to="/how-it-works" variant="ghost">
              How it works
            </ButtonLink>
          </div>
        </FadeUp>
      </Section>

      <Section code="00:20" label="Questions">
        <FadeUp inView>
          <Heading title="Questions" />
          <div className="mt-6">
            <Disclosure q="Is the unpacked version the same as the store version?">
              <p>Same code. The store copy is signed by Google and updates itself; the unpacked copy is updated by downloading the zip again.</p>
            </Disclosure>
            <Disclosure q="What does the extension send anywhere?">
              <p>
                Fingerprints of your record every ten minutes, so the server can sign them, and nothing else. Not your text, not your titles, not the document’s address. The full list is on the{' '}
                <Link to="/privacy" className="link">
                  privacy page
                </Link>
                .
              </p>
            </Disclosure>
            <Disclosure q="Firefox, Safari, Edge?">
              <p>Edge can load the same zip the same way. Firefox and Safari are on the list once the Chrome version is in the store.</p>
            </Disclosure>
          </div>
          <dl className="mt-8">
            <Row term="Works with">Google Docs, Notion, Word Online, Canvas, Moodle, Blackboard, Brightspace.</Row>
          </dl>
        </FadeUp>
      </Section>
    </>
  );
}

export function WaitlistCard({ source, compact = false }: { source: string; compact?: boolean }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'again' | 'error'>('idle');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState('busy');
    try {
      const r = await data.joinWaitlist(email.trim(), source);
      setState(r.new ? 'done' : 'again');
    } catch {
      setState('error');
    }
  };
  return (
    <Card className="grid gap-3 border-ink">
      <span className="marginal">Tell me when it is in the store</span>
      {state === 'done' || state === 'again' ? (
        <p className="text-sm">
          {state === 'done' ? 'Got it. One email, the day the listing goes live. Nothing else.' : 'You are already on the list. One email, the day it goes live.'}
        </p>
      ) : (
        <form onSubmit={submit} className={compact ? 'flex flex-wrap gap-2' : 'grid gap-2'} aria-busy={state === 'busy'}>
          <label className="sr-only" htmlFor={`wl-${source}`}>
            Email
          </label>
          <input
            id={`wl-${source}`}
            type="email"
            required
            autoComplete="email"
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 px-3 rounded-md border border-rule bg-paper text-ink flex-1 min-w-[14rem]"
          />
          <Button type="submit" disabled={state === 'busy' || !email.includes('@')}>
            {state === 'busy' ? 'Adding…' : 'Notify me'}
          </Button>
          {state === 'error' && (
            <p role="alert" className="text-sm text-paste w-full">
              That did not go through. Try again in a moment.
            </p>
          )}
          {!compact && <p className="text-xs text-ink-soft">One email when the listing is live. No newsletter, no sharing your address.</p>}
        </form>
      )}
    </Card>
  );
}
