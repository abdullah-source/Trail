import { Link } from 'react-router-dom';
import { Bullet, Prose, Row, Section, useTitle } from '../../design/components';
import { Note, Reveal } from '../../design/document';

/*
 * The server-side schema, as shown to students. STORED_TABLES is generated from the live
 * SQLAlchemy models by `python -m trail.server.gen_schema` (tests/test_privacy.py fails when it
 * is stale), so this page can only ever list what the database actually has.
 */
import { STORED_TABLES } from './schema.generated';
export type { StoredColumn, StoredTable } from './schema.generated';
export { STORED_TABLES };

export const NOT_STORED = ['The text of anything you write', 'Recorder events (typing, pastes, deletions)', 'Document titles', 'Your homework time log: which school sites, courses and assignments you spent time on, and when', "The editor's document ids or URLs (the extension makes up a random id per document and keeps the mapping on your device)", 'Sites you had open while writing', 'Paste sources', 'Card numbers (Stripe holds those)', 'IP addresses in any table. Our access log records method, path, status and duration, never query strings or request bodies; our host, Railway, keeps those log lines for its own retention window.'];

export default function Privacy() {
  useTitle('Privacy');
  return (
    <>
      <Section className="mk-first" titleAs="h1" index="Nº 01" eyebrow="Privacy" title="What we store, listed as tables, not adjectives." lede="Trail is built so that your writing never reaches our server. This page lists every table and every column that does. Last updated 15 October 2026." />

      <Section band index="02" eyebrow="Short version" title="The short version" className="mk-reading">
        <Reveal>
        <Prose>
          <p>
            <strong>What Trail is for.</strong> Trail keeps a private, on-device record of how you write in supported editors, so you can replay it, see your patterns, and prove where your work came from. That is the extension's single purpose. It records nothing until you press Start recording, in the extension or on the welcome page, and you can stop it from the toolbar button at any time.
          </p>
          <p>
            <strong>Your text stays on your device.</strong> The extension stores your writing record in your browser. The web app reads it from the extension directly. Replay, patterns and the declaration are computed in your browser.
          </p>
          <p>
            <strong>Our server stores your email, your plan, and signed fingerprints.</strong> Every ten minutes the extension sends the hashes at the head of your record's chains, under a random document id. We sign them with the time and keep the hashes and the signature. A hash cannot be turned back into text.
          </p>
          <p>
            <strong>One exception, on purpose.</strong> When you export an evidence pack, your browser sends the record to the server for that single request, so the server can sign the pack. It is built in memory, returned to you, and never written to disk or logs. The app tells you this before the click.
          </p>
          <p>
            <strong>No selling, no sharing, no analytics on your writing.</strong> We do not sell data, share it with institutions, or run any analysis on the server. We have nothing to analyse.
          </p>
        </Prose>
        </Reveal>
      </Section>

      <Section index="03" eyebrow="Stored" title="Every table on the server" lede="If it is not here, we do not have it." className="mk-reading">
        <div className="grid gap-12">
          {STORED_TABLES.map((t) => (
            <Note key={t.table} as="section" label="Table" watermark={false} aria-labelledby={`tbl-${t.table}`}>
              <div className="grid gap-1.5">
                <h3 id={`tbl-${t.table}`} className="mono text-base text-ink">
                  {t.table}
                </h3>
                <p className="text-sm text-ink-soft">{t.why}</p>
              </div>
              <div className="scroll" role="region" aria-label={`Columns of ${t.table}`} tabIndex={0}>
                <table className="mk-table min-w-[28rem]">
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>What it holds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.columns.map((c) => (
                      <tr key={c.name}>
                        <td className="mono text-[13px] whitespace-nowrap text-ink">{c.name}</td>
                        <td className="text-sm text-ink-soft min-w-[18rem]">{c.what}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Note>
          ))}
        </div>
      </Section>

      <Section band index="04" eyebrow="Not stored" title="What is not on the server" className="mk-reading">
        <ul className="grid gap-2 max-w-prose">
          {NOT_STORED.map((n) => (
            <Bullet key={n} className="border-t border-rule pt-2">
              {n}
            </Bullet>
          ))}
        </ul>
        <p className="text-sm text-ink-soft max-w-prose">Our test suite posts a record containing a marker sentence, exports a pack, then searches the database, the data directory and the captured logs for that sentence. The build fails if it is found anywhere.</p>
      </Section>

      <Section index="05" eyebrow="On your device" title="What is on your device" className="mk-reading">
        <Prose>
          <p>The extension keeps, in your browser's local database: the events it records in supported editors (text, timing, pastes with source host, deletions), a snapshot of the document text every three minutes, session starts and stops, host names of sites open while writing, document titles, the editor's document id next to the random id we use for it, and the checkpoints the server returned. You can export all of it as JSON from the app, on any plan, at any time.</p>
          <p>
            It also keeps a <strong>homework time log</strong>: for the school sites and editors it already records, the minutes a tab was in front and you were active, with the course and assignment names it read from the page. This powers the Time page in the app, for you alone. Course and assignment names never leave the device: there is no server endpoint that accepts them, and no teacher or institution view exists. You can export or delete the log from Settings.
          </p>
          <p>
            <strong>Time on AI sites.</strong> While a document is open in a supported editor, the extension notes which site is in front and for how long: the host name (for example chatgpt.com) and the minutes, with a flag when it is a known AI site. Never the address of the page, its title or anything on it. This lets your record show, honestly, that you looked something up or used an AI tool between two paragraphs.
          </p>
          <p>
            <strong>Where pastes come from, and the optional all-sites setting.</strong> To say where a paste came from, the extension notes, when you copy, the site's host name and a fingerprint (a SHA-256 hash) of what you copied. It never keeps the copied text itself; when you paste into a recorded document, it compares fingerprints. By default this happens only on the supported editor and school sites. If you turn on "Know where pastes come from" in the extension, Chrome asks you to allow access to all sites, and the same fingerprinting runs on every site so a paste from anywhere can be attributed. Turning it off, or removing the permission in Chrome, stops it immediately. Without it, a paste copied from another site is recorded as coming from an unknown source.
          </p>
          <p>Uninstalling the extension deletes this database, as Chrome does for any extension. Export first if you want to keep it.</p>
          <p>The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.</p>
        </Prose>
      </Section>

      <Section band index="06" eyebrow="Services" title="Who else touches anything" className="mk-reading">
        <dl>
          <Row term="Stripe">Payments. They see your email and card. We see a customer id and a plan.</Row>
          <Row term="Clerk">Sign-in, when enabled: they hold your email and how you signed in (Google or a code). They never see anything about your writing; we only ask them who you are.</Row>
          <Row term="Resend">Sends login links and renewal reminders to your email.</Row>
          <Row term="Railway">Hosts the server and the database, in the United States.</Row>
          <Row term="Fonts">Served from trail.app itself. Nothing on this site loads from Google or any other third party.</Row>
          <Row term="Nobody else">No analytics scripts, no ad pixels, no error tracker unless we turn one on, and then it is configured to drop request bodies.</Row>
        </dl>
      </Section>

      <Section index="07" eyebrow="Rights" title="Your rights, and how to use them" className="mk-reading">
        <dl>
          <Row term="See your data">Settings shows your email, plan, invite progress and extension status. Every other row about you is a hash or a timestamp in the tables above; email us for a complete copy. Your local record is in the app.</Row>
          <Row term="Export">Raw JSON from the app; an evidence pack from any essay.</Row>
          <Row term="Delete">Settings has a Delete account button. It removes every server row listed above within minutes, except transparency-log entries, which contain only hashes. Your local record is not touched.</Row>
          <Row term="Ask">
            Email{' '}
            <a href="mailto:privacy@trail.app" className="link">
              privacy@trail.app
            </a>
            . A person answers.
          </Row>
        </dl>
        <p className="text-sm text-ink-soft max-w-prose">
          Changes to this page are announced by email before they take effect. The{' '}
          <Link to="/terms" className="link">
            terms
          </Link>{' '}
          are the other document that applies.
        </p>
      </Section>
    </>
  );
}
