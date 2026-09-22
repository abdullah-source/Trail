import { Link } from 'react-router-dom';
import { Heading, Prose, Row, Section, useTitle } from '../../design/components';

/*
 * The server-side schema, as shown to students. STORED_TABLES is generated from the live
 * SQLAlchemy models by `python -m trail.server.gen_schema` (tests/test_privacy.py fails when it
 * is stale), so this page can only ever list what the database actually has.
 */
import { STORED_TABLES } from './schema.generated';
export type { StoredColumn, StoredTable } from './schema.generated';
export { STORED_TABLES };

export const NOT_STORED = ['The text of anything you write', 'Recorder events (typing, pastes, deletions)', 'Document titles', "The editor's document ids or URLs (the extension makes up a random id per document and keeps the mapping on your device)", 'Sites you had open while writing', 'Paste sources', 'Card numbers (Stripe holds those)', 'IP addresses in any table. Our access log records method, path, status and duration, never query strings or request bodies; our host, Railway, keeps those log lines for its own retention window.'];

export default function Privacy() {
  useTitle('Privacy');
  return (
    <>
      <Section flush code="00:00" label="Privacy">
        <Heading as="h1" eyebrow="Privacy" title="What we store, listed as tables, not adjectives." lede="Trail is built so that your writing never reaches our server. This page lists every table and every column that does. Last updated 21 September 2026." />
      </Section>

      <Section code="00:05" label="Short version">
        <Prose>
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
      </Section>

      <Section code="00:12" label="Stored">
        <Heading title="Every table on the server" lede="If it is not here, we do not have it." />
        <div className="grid gap-10 mt-8">
          {STORED_TABLES.map((t) => (
            <div key={t.table}>
              <div className="flex items-baseline gap-3 flex-wrap">
                <h3 className="font-mono text-base text-ink">{t.table}</h3>
                <span className="text-sm text-ink-soft">{t.why}</span>
              </div>
              <dl className="mt-2">
                {t.columns.map((c) => (
                  <Row key={c.name} term={c.name}>
                    {c.what}
                  </Row>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </Section>

      <Section code="00:24" label="Not stored">
        <Heading title="What is not on the server" />
        <ul className="mt-6 grid gap-2 max-w-prose">
          {NOT_STORED.map((n) => (
            <li key={n} className="flex gap-3 border-t border-rule py-3">
              <span aria-hidden className="mt-[0.65em] inline-block w-3 h-px bg-margin shrink-0" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-ink-soft mt-6 max-w-prose">Our test suite posts a record containing a marker sentence, exports a pack, then searches the database, the data directory and the captured logs for that sentence. The build fails if it is found anywhere.</p>
      </Section>

      <Section code="00:33" label="On your device">
        <Heading title="What is on your device" />
        <Prose className="mt-6">
          <p>The extension keeps, in your browser's local database: the events it records in supported editors (text, timing, pastes with source host, deletions), a snapshot of the document text every three minutes, session starts and stops, host names of sites open while writing, document titles, the editor's document id next to the random id we use for it, and the checkpoints the server returned. You can export all of it as JSON from the app, on any plan, at any time.</p>
          <p>Uninstalling the extension deletes this database, as Chrome does for any extension. Export first if you want to keep it.</p>
        </Prose>
      </Section>

      <Section code="00:40" label="Services">
        <Heading title="Who else touches anything" />
        <dl className="mt-6">
          <Row term="Stripe">Payments. They see your email and card. We see a customer id and a plan.</Row>
          <Row term="Resend">Sends login links and renewal reminders to your email.</Row>
          <Row term="Railway">Hosts the server and the database, in the United States.</Row>
          <Row term="Fonts">Served from trail.app itself. Nothing on this site loads from Google or any other third party.</Row>
          <Row term="Nobody else">No analytics scripts, no ad pixels, no error tracker unless we turn one on, and then it is configured to drop request bodies.</Row>
        </dl>
      </Section>

      <Section code="00:48" label="Rights">
        <Heading title="Your rights, and how to use them" />
        <dl className="mt-6">
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
        <p className="text-sm text-ink-soft mt-8 max-w-prose">
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
