import { Link } from 'react-router-dom';
import { Badge, ButtonLink, Card, CHROME_STORE_URL, Heading, Prose, Row, Section, useTitle } from '../../design/components';
import { FadeUp } from '../../design/motion';

const RECORDED: [string, string][] = [
  ['Text you type', 'The characters, where they went, and the gaps between keystrokes. This is what makes the replay and the rhythm.'],
  ['Text you paste', 'The pasted text, plus the site it was copied from (the host name only, like jstor.org or chatgpt.com), or "this document" if you copied from your own draft.'],
  ['Deletions', 'What was removed and when, so the replay can show you rewriting.'],
  ['Sessions', 'When you started and stopped, and which editor you were in.'],
  ['Sites open while writing', 'Host names and minutes, for the sources list. Never the page content, never the URL.'],
  ['Text snapshots', 'Every three minutes, a copy of the document as the editor shows it, kept only on your device so the record can be checked against the real text.'],
];

const NOT_RECORDED: [string, string][] = [
  ['Anything outside a supported editor', 'Longhand only wakes up on Google Docs, Notion, Word Online and your LMS editor. Email, chat, banking, search: not seen.'],
  ['Passwords or form fields', 'The recorder attaches to the document body of the editor, not to inputs.'],
  ['Screenshots, camera, microphone', 'None. The extension does not ask for those permissions.'],
  ['Anything while paused', 'Pause any site from the popup. Paused means paused; there is no "we still collect a little".'],
  ['What you copied, on the source site', 'On other sites the extension only notes the host name when you copy, so a later paste can be attributed. It does not read the page.'],
];

export default function HowItWorks() {
  useTitle('How it works');
  return (
    <>
      <Section flush code="00:00" label="Overview">
        <Heading as="h1" eyebrow="How it works" title="A record you keep. A fingerprint we sign." lede="Longhand is two small things: an extension that keeps a record of your writing on your own device, and a server that puts a signed timestamp on a fingerprint of that record every ten minutes. Here is exactly what each one sees." />
      </Section>

      <Section code="00:08" label="Recorded">
        <FadeUp inView>
          <Heading title="What is recorded" lede="Only inside the editor, only while recording is on." />
          <dl className="mt-6">
            {RECORDED.map(([t, d]) => (
              <Row key={t} term={t}>
                {d}
              </Row>
            ))}
          </dl>
        </FadeUp>
      </Section>

      <Section code="00:19" label="Not recorded">
        <FadeUp inView>
          <Heading title="What is not recorded" lede="The list that matters more." />
          <dl className="mt-6">
            {NOT_RECORDED.map(([t, d]) => (
              <Row key={t} term={t}>
                {d}
              </Row>
            ))}
          </dl>
          <p className="text-sm text-ink-soft mt-6 max-w-prose">
            The extension asks Chrome for access to the editor domains, plus a small copy-tracking script on other sites that stores only the host name. The full list is in the Chrome Web Store listing, and you can read the source.
          </p>
        </FadeUp>
      </Section>

      <Section code="00:31" label="On device">
        <FadeUp inView>
          <Heading title="Where it lives" lede="In your browser. Not in ours." />
          <Prose className="mt-6">
            <p>
              Everything the extension records is stored in your browser's local database (IndexedDB), on your laptop. When you open <span className="font-mono text-sm">longhand.app</span>, the web app asks the extension for your essays directly, over a channel Chrome provides between a site and an extension. The replay, your patterns and the draft declaration are all computed in your browser, in JavaScript.
            </p>
            <p>
              That is not a policy we promise to follow. It is how the code is built: there is no endpoint on our server that accepts your text, except the one you use on purpose to export an evidence pack, described below.
            </p>
            <p>
              It also means the record is yours in the plain sense. Export it as JSON any time. Delete your account and the server rows vanish, but your local record stays with you.
            </p>
          </Prose>
        </FadeUp>
      </Section>

      <Section code="00:44" label="The chain">
        <FadeUp inView>
          <Heading title="The chain, in plain words" lede="How a record can show it was not edited after the fact." />
          <Prose className="mt-6">
            <p>Every event the extension writes (a burst of typing, a paste, a deletion) gets a fingerprint: a hash, a short string that changes completely if even one character of the event changes. Each event's fingerprint also includes the previous event's fingerprint. So the events form a chain, like receipts where each one quotes the number of the one before.</p>
            <p>If anyone changed an event in the middle, its fingerprint would change, so the next event's fingerprint would no longer match, and so on to the end. You cannot edit the past without breaking every link after it.</p>
            <p>
              Every ten minutes, the extension sends the fingerprint at the end of the chain to our server. Just that: 64 characters of hash, no text. The server signs it with its private key and the current time, and sends the signature back. That signed fingerprint is a checkpoint. It says: <em>this exact record existed, in this state, at this time.</em>
            </p>
            <p>
              The server keeps a copy of every checkpoint it signs, in a log that is public and append-only. So even we could not quietly sign a different version later. Anyone can compare the checkpoint in your pack with the one in the log.
            </p>
          </Prose>
          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            {[
              ['1', 'Chain', 'Each event fingerprints itself and the one before. Lives on your device.'],
              ['2', 'Checkpoint', 'Every ten minutes the last fingerprint is sent, signed with the time, and returned.'],
              ['3', 'Verify', 'Anyone recomputes the chain, checks the signatures against the public key published at longhand.app, looks each checkpoint up in the public log, and gets a yes or no.'],
            ].map(([n, t, d]) => (
              <Card key={t} className="grid gap-2 content-start">
                <span className="font-mono text-sm text-margin">{n}</span>
                <h3 className="text-xl">{t}</h3>
                <p className="text-sm text-ink-soft">{d}</p>
              </Card>
            ))}
          </div>
        </FadeUp>
      </Section>

      <Section code="00:58" label="Server">
        <FadeUp inView>
          <Heading title="What the server sees" lede="The complete list, so you do not have to take our word for it." />
          <dl className="mt-6">
            <Row term="Your email">To send you a login link. No password exists.</Row>
            <Row term="Your plan">Trial, semester, monthly, or expired, and the Stripe customer id that goes with it.</Row>
            <Row term="Checkpoint hashes">The chain fingerprints, with a document id (a random id the extension makes up; not the editor's id, not the title), a sequence number, our signature, and the time.</Row>
            <Row term="Referral code">Yours, and who invited you, if anyone.</Row>
            <Row term="Nothing else">
              No text. No events. No titles. No source sites. The{' '}
              <Link to="/privacy" className="link">
                privacy page
              </Link>{' '}
              lists every table and column.
            </Row>
          </dl>
        </FadeUp>
      </Section>

      <Section code="01:10" label="The pack">
        <FadeUp inView>
          <Heading title="The one exception: exporting an evidence pack" lede="Stated before the click, every time." />
          <Prose className="mt-6">
            <p>An evidence pack is a folder with your record, the analysis, the signed checkpoints and a report anyone can open. Building it needs the server's signature over the whole pack, so when you click Export, your browser sends the record to the server for that one request. The server builds the pack in memory, signs it, returns it, and keeps nothing: it is never written to disk or to a log. Our tests check that by searching the database and logs for a sentence from the record after an export.</p>
            <p>
              The pack is a normal <span className="font-mono text-sm">.longhand.tar.gz</span> file. You keep it. You decide who sees it.
            </p>
          </Prose>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <Badge kind="neutral">the only time text transits the server</Badge>
            <Badge kind="neutral">built in memory, never stored</Badge>
          </div>
        </FadeUp>
      </Section>

      <Section code="01:22" label="Verify">
        <FadeUp inView>
          <Heading title="Verifying without trusting us" lede="For professors, and for you." />
          <Prose className="mt-6">
            <p>
              Drop a pack on{' '}
              <Link to="/verify" className="link">
                longhand.app/verify
              </Link>
              . Your browser recomputes every hash and every chain link, checks every signature against the public key it fetches from longhand.app/v1/public-key (never the copy inside the pack), looks each checkpoint up in our public log, and reports each check as pass or fail. Nothing is uploaded. The small Python script inside every pack repeats the hash and signature checks offline; only the log lookup needs the site.
            </p>
            <p>What verification shows: this record existed in this state at these times and was not changed afterwards. What it does not prove: who was at the keyboard, or that text typed by hand was not copied from a screen. Longhand says this in every pack.</p>
          </Prose>
          <div className="flex flex-wrap gap-3 mt-8">
            <ButtonLink to={CHROME_STORE_URL} external size="lg">
              Add to Chrome
            </ButtonLink>
            <ButtonLink to="/privacy" variant="ghost" size="lg">
              Read the privacy page
            </ButtonLink>
          </div>
        </FadeUp>
      </Section>
    </>
  );
}
