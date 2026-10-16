import { Link } from 'react-router-dom';
import { Badge, ButtonLink, CHROME_STORE_URL, Prose, Row, Section, useTitle } from '../../design/components';
import { Note, Reveal } from '../../design/document';

const RECORDED: [string, string][] = [
  ['Text you type', 'The characters, where they went, and the gaps between keystrokes. This is what makes the replay and the rhythm.'],
  ['Text you paste', 'The pasted text, plus the site it was copied from (the host name only, like jstor.org or chatgpt.com), or "this document" if you copied from your own draft.'],
  ['Deletions', 'What was removed and when, so the replay can show you rewriting.'],
  ['Sessions', 'When you started and stopped, and which editor you were in.'],
  ['Sites open while writing', 'Host names and minutes, for the sources list. Never the page content, never the URL.'],
  ['Text snapshots', 'Every three minutes, a copy of the document as the editor shows it, kept only on your device so the record can be checked against the real text.'],
  ['Time on school sites', 'On the same sites and editors, the minutes a tab was in front and you were active, with the course and assignment name on the page. It feeds the Time page (screen time for homework), computed on your computer, for you only. Never sent to our server, never shown to a teacher.'],
];

const NOT_RECORDED: [string, string][] = [
  ['Anything outside a supported editor', 'Trail only wakes up on Google Docs, Notion, Word Online and your LMS editor. Email, chat, banking, search: not seen.'],
  ['Passwords or form fields', 'The recorder attaches to the document body of the editor, not to inputs.'],
  ['Screenshots, camera, microphone', 'None. The extension does not ask for those permissions.'],
  ['Anything while paused', 'Pause any site from the popup. Paused means paused; there is no "we still collect a little".'],
  ['What you copied, on the source site', 'On other sites the extension only notes the host name when you copy, so a later paste can be attributed. It does not read the page.'],
];

export default function HowItWorks() {
  useTitle('How it works');
  return (
    <>
      <Section className="mk-first" titleAs="h1" index="Nº 01" eyebrow="How it works" title="A record you keep. A fingerprint we sign." lede="Trail is two small things: an extension that keeps a record of your writing on your own device, and a server that puts a signed timestamp on a fingerprint of that record every ten minutes. Here is exactly what each one sees." />

      <Section band index="02" eyebrow="Recorded" title="What is recorded" lede="Only inside the editor, only while recording is on.">
        <Reveal as="div">
          <dl>
            {RECORDED.map(([t, d]) => (
              <Row key={t} term={t}>
                {d}
              </Row>
            ))}
          </dl>
        </Reveal>
      </Section>

      <Section index="03" eyebrow="Not recorded" title="What is not recorded" lede="The list that matters more.">
        <Reveal className="grid gap-6">
          <dl>
            {NOT_RECORDED.map(([t, d]) => (
              <Row key={t} term={t}>
                {d}
              </Row>
            ))}
          </dl>
          <p className="text-sm text-ink-soft max-w-prose">The extension asks Chrome for access to the editor domains, plus a small copy-tracking script on other sites that stores only the host name. The full list is in the Chrome Web Store listing, and you can read the source.</p>
        </Reveal>
      </Section>

      <Section band index="04" eyebrow="On device" title="Where it lives" lede="In your browser. Not in ours.">
        <Reveal>
          <Prose>
            <p>
              Everything the extension records is stored in your browser's local database (IndexedDB), on your laptop. When you open <span className="mono text-sm">trail.app</span>, the web app asks the extension for your essays directly, over a channel Chrome provides between a site and an extension. The replay, your patterns and the draft declaration are all computed in your browser, in JavaScript.
            </p>
            <p>That is not a policy we promise to follow. It is how the code is built: there is no endpoint on our server that accepts your text, except the one you use on purpose to export an evidence pack, described below.</p>
            <p>It also means the record is yours in the plain sense. Export it as JSON any time. Delete your account and the server rows vanish, but your local record stays with you.</p>
          </Prose>
        </Reveal>
      </Section>

      <Section index="05" eyebrow="The chain" title="The chain, in plain words" lede="How a record can show it was not edited after the fact.">
        <Reveal>
          <Prose>
            <p>Every event the extension writes (a burst of typing, a paste, a deletion) gets a fingerprint: a hash, a short string that changes completely if even one character of the event changes. Each event's fingerprint also includes the previous event's fingerprint. So the events form a chain, like receipts where each one quotes the number of the one before.</p>
            <p>If anyone changed an event in the middle, its fingerprint would change, so the next event's fingerprint would no longer match, and so on to the end. You cannot edit the past without breaking every link after it.</p>
            <p>
              Every ten minutes, the extension sends the fingerprint at the end of the chain to our server. Just that: 64 characters of hash, no text. The server signs it with its private key and the current time, and sends the signature back. That signed fingerprint is a checkpoint. It says: <em>this exact record existed, in this state, at this time.</em>
            </p>
            <p>The server keeps a copy of every checkpoint it signs, in a log that is public and append-only. So even we could not quietly sign a different version later. Anyone can compare the checkpoint in your pack with the one in the log.</p>
          </Prose>
        </Reveal>
        <Reveal as="ol" className="mk-grid-3">
          {[
            ['01', 'Chain', 'Each event fingerprints itself and the one before. Lives on your device.'],
            ['02', 'Checkpoint', 'Every ten minutes the last fingerprint is sent, signed with the time, and returned.'],
            ['03', 'Verify', 'Anyone recomputes the chain, checks the signatures against the public key published at trail.app, looks each checkpoint up in the public log, and gets a yes or no.'],
          ].map(([n, t, d]) => (
            <Note key={t} as="li" label={`Step ${n}`} title={t}>
              <p className="text-sm text-ink-soft">{d}</p>
            </Note>
          ))}
        </Reveal>
      </Section>

      <Section band index="06" eyebrow="Server" title="What the server sees" lede="The complete list, so you do not have to take our word for it.">
        <Reveal>
          <dl>
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
        </Reveal>
      </Section>

      <Section index="07" eyebrow="The pack" title="The one exception: exporting an evidence pack" lede="Stated before the click, every time.">
        <Reveal className="grid gap-6">
          <Prose>
            <p>An evidence pack is a folder with your record, the analysis, the signed checkpoints and a report anyone can open. Building it needs the server's signature over the whole pack, so when you click Export, your browser sends the record to the server for that one request. The server builds the pack in memory, signs it, returns it, and keeps nothing: it is never written to disk or to a log. Our tests check that by searching the database and logs for a sentence from the record after an export.</p>
            <p>
              The pack is a normal <span className="mono text-sm">.trail.tar.gz</span> file. You keep it. You decide who sees it.
            </p>
          </Prose>
          <div className="flex flex-wrap items-center gap-3">
            <Badge kind="neutral">the only time text transits the server</Badge>
            <Badge kind="neutral">built in memory, never stored</Badge>
          </div>
        </Reveal>
      </Section>

      <Section band index="08" eyebrow="Verify" title="Verifying without trusting us" lede="For professors, and for you.">
        <Reveal className="grid gap-8">
          <Prose>
            <p>
              Drop a pack on{' '}
              <Link to="/verify" className="link">
                trail.app/verify
              </Link>
              . Your browser recomputes every hash and every chain link, checks every signature against the public key it fetches from trail.app/v1/public-key (never the copy inside the pack), looks each checkpoint up in our public log, and reports each check as pass or fail. Nothing is uploaded. The small Python script inside every pack repeats the hash and signature checks offline; only the log lookup needs the site.
            </p>
            <p>What verification shows: this record existed in this state at these times and was not changed afterwards. What it does not prove: who was at the keyboard, or that text typed by hand was not copied from a screen. Trail says this in every pack.</p>
          </Prose>
          <div className="mk-btns">
            <ButtonLink to={CHROME_STORE_URL} external variant="primary" size="lg" arrow>
              Add to Chrome
            </ButtonLink>
            <ButtonLink to="/privacy" variant="secondary" size="lg">
              Read the privacy page
            </ButtonLink>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
