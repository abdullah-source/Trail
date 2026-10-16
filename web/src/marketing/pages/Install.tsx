import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ButtonLink, Disclosure, Row, Section, useTitle } from '../../design/components';
import { Note, Reveal } from '../../design/document';
import { WaitlistCard } from '../../components/Waitlist';

const ZIP = '/trail-extension.zip';

const STEPS: { title: string; body: ReactNode }[] = [
  {
    title: 'Download',
    body: (
      <>
        <a className="link" href={ZIP} download>
          Download trail-extension.zip
        </a>{' '}
        and unzip it. Keep the folder somewhere it will not be deleted.
      </>
    ),
  },
  {
    title: 'Developer mode',
    body: (
      <>
        In Chrome open <span className="mono text-sm">chrome://extensions</span> and switch on <b>Developer mode</b> (top right).
      </>
    ),
  },
  {
    title: 'Load it',
    body: (
      <>
        Click <b>Load unpacked</b> and choose the unzipped folder.
      </>
    ),
  },
  {
    title: 'Pin and sign in',
    body: (
      <>
        Pin Trail from the puzzle-piece menu, click it, then <b>Open my writing record</b> and sign in.
      </>
    ),
  },
  { title: 'Write', body: <>Write in Google Docs or Notion. Your first replay is one paragraph away.</> },
];

export default function Install() {
  useTitle('Get Trail for Chrome');
  return (
    <>
      <Section
        className="mk-first"
        titleAs="h1"
        index="Nº 01"
        eyebrow="Get Trail for Chrome"
        title="Install Trail"
        lede="The Chrome Web Store listing is on its way. Until it is live, install it yourself today in about two minutes, or leave your email and we will tell you the day it lands."
      >
        <Reveal className="mk-btns">
          <a className="btn btn-primary btn-lg" href={ZIP} download>
            Download trail-extension.zip
          </a>
          <ButtonLink to="/demo" variant="secondary" size="lg" icon="play">
            Watch the demo first
          </ButtonLink>
        </Reveal>
      </Section>

      <Section band index="02" eyebrow="Install today" title="Load it yourself, no store needed.">
        <div className="mk-split" data-lean="left">
          <div className="grid gap-6 min-w-0">
            <Reveal as="ol" className="mk-grid-2 !gap-x-8 !gap-y-10">
              {STEPS.map((s, i) => (
                <Note key={s.title} as="li" label={`Step ${String(i + 1).padStart(2, '0')}`} title={s.title} titleAs="h3">
                  <p className="text-sm text-ink-soft">{s.body}</p>
                </Note>
              ))}
            </Reveal>
            <p className="text-sm text-ink-soft max-w-prose">Chrome on a laptop. Chrome will show an “unpacked extension” notice on launch; that is what an unlisted extension looks like. The store version replaces it with one click.</p>
          </div>
          <WaitlistCard source="install" />
        </div>
      </Section>

      <Section index="03" eyebrow="Already have it" title="Already installed?" lede="Then you only need to sign in.">
        <Reveal className="mk-btns">
          <ButtonLink to="/login" variant="primary" arrow>
            Sign in
          </ButtonLink>
          <ButtonLink to="/how-it-works" variant="secondary">
            How it works
          </ButtonLink>
        </Reveal>
      </Section>

      <Section band index="04" eyebrow="Questions" title="Questions">
        <Reveal className="max-w-3xl">
          <div>
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
        </Reveal>
      </Section>
    </>
  );
}
