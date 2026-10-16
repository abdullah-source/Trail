import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button, ButtonLink, Desk, Disclosure, Eyebrow, Heading, Row, Section, useTitle } from '../../design/components';
import { Dialog, Icon } from '../../design/desktop';
import { WaitlistCard } from '../../components/Waitlist';

const ZIP = '/trail-extension.zip';

const STEPS: ReactNode[] = [
  <>
    <a className="link" href={ZIP} download>
      Download trail-extension.zip
    </a>{' '}
    and unzip it. Keep the folder somewhere it will not be deleted.
  </>,
  <>
    In Chrome open <span className="font-mono">chrome://extensions</span> and switch on <b>Developer mode</b> (top right).
  </>,
  <>
    Click <b>Load unpacked</b> and choose the unzipped folder.
  </>,
  <>
    Pin Trail from the puzzle-piece menu, click it, then <b>Open my writing record</b> and sign in.
  </>,
  <>Write in Google Docs or Notion. Your first replay is one paragraph away.</>,
];

export default function Install() {
  useTitle('Get Trail for Chrome');
  return (
    <Desk>
      <Dialog
        title="Install Trail"
        icon="disk"
        className="win-open min-[701px]:col-span-2"
        actions={
          <>
            <ButtonLink to="/demo">Watch the demo first</ButtonLink>
            <a className="btn btn-primary btn-ring" href={ZIP} download>
              <Icon name="disk" />
              Download trail-extension.zip
            </a>
          </>
        }
      >
        <Eyebrow>Get Trail for Chrome</Eyebrow>
        <p className="text-lg">The extension is on its way to the Chrome Web Store.</p>
        <p className="text-sm text-ink-soft max-w-prose">The Chrome Web Store listing is on its way. Until it is live, leave your email and we will tell you the day it lands, or install it yourself today in about two minutes.</p>
        <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(16rem,2fr)] items-start">
          <div className="grid gap-3">
            <Eyebrow>Install today</Eyebrow>
            <h3 className="text-xl">Load it yourself, no store needed.</h3>
            <ol className="grid gap-2 sm:grid-cols-2" aria-label="Install steps">
              {STEPS.map((s, i) => (
                <li key={i} className="panel on-chrome text-sm grid gap-1 content-start">
                  <span className="panel-legend">Step {i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-ink-soft">Chrome on a laptop. Chrome will show an “unpacked extension” notice on launch; that is what an unlisted extension looks like. The store version replaces it with one click.</p>
          </div>
          <WaitlistCard source="install" />
        </div>
      </Dialog>

      <Section label="Already have it" icon="key" code="00:12">
        <Heading title="Already installed?" lede="Then you only need to sign in." />
        <div className="flex flex-wrap gap-3 mt-6">
          <ButtonLink to="/login" variant="primary">
            Sign in
          </ButtonLink>
          <ButtonLink to="/how-it-works">How it works</ButtonLink>
        </div>
      </Section>

      <Section label="Questions" code="00:20" offset>
        <Heading title="Questions" />
        <div className="mt-4">
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
        <dl className="mt-6">
          <Row term="Works with">Google Docs, Notion, Word Online, Canvas, Moodle, Blackboard, Brightspace.</Row>
        </dl>
      </Section>
    </Desk>
  );
}
