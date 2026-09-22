import { Link } from 'react-router-dom';
import { Heading, Prose, Section, useTitle } from '../../design/components';

const SECTIONS: { code: string; label: string; title: string; body: React.ReactNode }[] = [
  {
    code: '00:03',
    label: 'Service',
    title: 'What Longhand is',
    body: (
      <>
        <p>Longhand is a browser extension and a web app that keep a record of how you write, on your device, and sign fingerprints of that record on our server. The details of what is stored where are on the <Link to="/privacy" className="link">privacy page</Link> and the <Link to="/how-it-works" className="link">how it works page</Link>; both are part of these terms.</p>
        <p>Longhand does not detect AI writing, grade your work, or judge its content. The record shows what happened in the editor and nothing else.</p>
      </>
    ),
  },
  {
    code: '00:08',
    label: 'Account',
    title: 'Your account',
    body: (
      <>
        <p>You need an email address and to be at least 16 years old. You log in with a link we email you; keep your inbox secure, because anyone with the link can log in as you until it is used once or 30 minutes pass.</p>
        <p>One account per person. You are responsible for what happens under it.</p>
      </>
    ),
  },
  {
    code: '00:14',
    label: 'Payment',
    title: 'Trial, payment, refunds',
    body: (
      <>
        <p>While Longhand is in early access every account has every feature free, with no card and no trial clock; the pricing page says so whenever that is the case, and we give at least 30 days' notice by email before any charging begins. Once pricing is on, every account starts with a 14-day trial of all features, no card needed. After it, the views (replay, sessions, patterns, declaration, evidence packs) require a paid plan: $12 every four months or $3.99 a month, in US dollars, billed by Stripe. Recording, local storage, raw export and checkpoint signing never require payment.</p>
        <p>Plans renew automatically. We email you seven days before every renewal. You can cancel at any time in one click; your plan then runs to the end of the paid period. Any charge is refunded in full if you ask within 14 days of it, with one click in Settings. We may change prices with 30 days' notice by email; a price change never applies to a period you have already paid for.</p>
        <p>Referral credit (one free semester per three invited friends who complete a first replay, up to three semesters) is added to your account automatically and has no cash value.</p>
      </>
    ),
  },
  {
    code: '00:22',
    label: 'Your data',
    title: 'Your record is yours',
    body: (
      <>
        <p>Everything you write and everything the extension records belongs to you. We claim no licence over it. It lives on your device; we hold only what the privacy page lists.</p>
        <p>When you export an evidence pack, you send the record to our server for that one request so we can sign it. You grant us permission to process it in memory for that purpose only. We keep nothing.</p>
        <p>You can delete your account at any time in Settings. We then delete the server rows about you, except entries in the transparency log, which contain only hashes.</p>
      </>
    ),
  },
  {
    code: '00:29',
    label: 'Use',
    title: 'What you agree not to do',
    body: (
      <>
        <p>Do not use Longhand to record someone else's writing without their knowledge. Do not tamper with the extension, the record or a pack and present it as genuine. Do not attack, probe or overload the service. Do not resell access.</p>
        <p>If you do any of these we may close your account. Your local record still belongs to you.</p>
      </>
    ),
  },
  {
    code: '00:35',
    label: 'Limits',
    title: 'What we do not promise',
    body: (
      <>
        <p>We do not promise that any institution will accept an evidence pack, or that a record will settle a dispute. A pack shows that a record existed at signed times and was not altered afterwards; it cannot show who was at the keyboard or see text retyped by hand. Every pack says this.</p>
        <p>The service is provided as is. We work hard to keep it up and to keep the record intact, but recording can miss events (for example if a page reloads, or an editor changes its structure), and the record marks those gaps as unobserved rather than guessing. To the extent the law allows, our liability to you is limited to the amount you paid us in the twelve months before the claim.</p>
      </>
    ),
  },
  {
    code: '00:41',
    label: 'Changes',
    title: 'Changes, ending, contact',
    body: (
      <>
        <p>We may update these terms. If a change matters to you, we email you at least 14 days before it takes effect, and you can close your account before then with a refund of any unused period. We may stop offering Longhand; if we do, you get at least 60 days' notice, the verification page stays up for at least a year, and your local record and packs keep working, because verification does not depend on us.</p>
        <p>These terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law rules. Questions: <a href="mailto:hello@longhand.app" className="link">hello@longhand.app</a>.</p>
      </>
    ),
  },
];

export default function Terms() {
  useTitle('Terms');
  return (
    <>
      <Section flush code="00:00" label="Terms">
        <Heading as="h1" eyebrow="Terms of service" title="Short, because there is not much to say." lede="These are the terms for using Longhand. Plain English, no surprises. Last updated 21 September 2026." />
      </Section>
      {SECTIONS.map((s) => (
        <Section key={s.code} code={s.code} label={s.label}>
          <Heading title={s.title} />
          <Prose className="mt-6">{s.body}</Prose>
        </Section>
      ))}
    </>
  );
}
