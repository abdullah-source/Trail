import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bullet, ButtonLink, CHROME_STORE_URL, DEMO_RECORD, Prose, Section, Stat, useTitle } from '../../design/components';
import { Chip, Eyebrow, Guilloche, Icon, Note, ProvenancePath, Reveal, Seal, serialOf, type IconName, type ProvenanceNode } from '../../design/document';
import { useSiteConfig } from '../../lib/config';
import { WaitlistCard } from '../../components/Waitlist';
import { ReplayHero } from '../../design/ReplayHero';
import { Provenance, type ProvenanceLine, type ProvenancePaste } from '../../design/Provenance';

/* Sample data for the evidence-pack section. Shapes match lib/analysis output. */
const SAMPLE_LINES: ProvenanceLine[] = (
  ['typed', 'typed', 'typed', 'typed', 'pasted-edited', 'typed', 'typed', 'typed', 'mixed', 'typed', 'typed', 'typed', 'typed', 'pasted', 'typed', 'typed', 'typed', 'typed', 'typed', 'typed', 'typed', 'typed'] as const
).map((label, index) => ({ index, label }));

const SAMPLE_PASTES: ProvenancePaste[] = [
  { ts: '2026-10-12T22:58:00Z', chars: 101, source_kind: 'web', source_host: 'jstor.org', surviving_ratio: 0.61 },
  { ts: '2026-10-13T00:14:00Z', chars: 83, source_kind: 'ai', source_host: 'chatgpt.com', surviving_ratio: 0 },
  { ts: '2026-10-14T21:40:00Z', chars: 212, source_kind: 'self', source_host: null, from_self: true, surviving_ratio: 1 },
];

/* Example numbers for the homework-time section. Shapes match lib/homework output. */
const CLASS_TIME = [
  { label: 'BIO 101', min: 164, items: 3 },
  { label: 'ENGL 101', min: 121, items: 2 },
  { label: 'HIST 210', min: 97, items: 2 },
  { label: 'MATH 140', min: 58, items: 2 },
];

const SESSIONS = [
  { day: 'Tue', time: '22:41', min: 48, w: 62 },
  { day: 'Wed', time: '23:10', min: 72, w: 100 },
  { day: 'Thu', time: '00:05', min: 19, w: 26 },
  { day: 'Sat', time: '15:02', min: 36, w: 48 },
];

const fmtMin = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min} min`);

const SERIAL = serialOf(DEMO_RECORD.hash);

/** The demo record's chain, as the provenance path draws it. Every value is from the record. */
const CHAIN: ProvenanceNode[] = [
  { id: 'doc', kind: 'doc', label: DEMO_RECORD.title, detail: `${DEMO_RECORD.words} words · ${DEMO_RECORD.editor}` },
  { id: 'ses', kind: 'session', label: `${DEMO_RECORD.sessions} writing sessions`, detail: `${DEMO_RECORD.activeMinutes} active minutes` },
  { id: 'paste', kind: 'paste', label: '1 paste, with its source', detail: `${DEMO_RECORD.paste.host} · ${DEMO_RECORD.paste.chars} chars` },
  { id: 'sig', kind: 'signature', label: 'Chain head signed by Trail', detail: `Nº ${SERIAL}` },
  { id: 'log', kind: 'log', label: 'Anchored in the public log', detail: 'checked at /verify' },
];

type Who = { who: string; series: string; icon: IconName; source?: string; body: string };
const WHO: Who[] = [
  { who: 'Students', series: 'S', icon: 'students', body: 'Show how your essay was written: a replay, every paste with its source, a record anyone can check.' },
  { who: 'Researchers', series: 'R', icon: 'research', source: 'research', body: 'NIH no longer accepts applications substantially developed by AI.' },
  { who: 'Lawyers', series: 'L', icon: 'legal', source: 'legal', body: 'California will require lawyers to disclose AI use in court filings from 1 January 2027.' },
  { who: 'Writers', series: 'W', icon: 'writers', source: 'writers', body: 'Publishers and clients now ask how a piece was written.' },
];

function Bar({ value, tone, label }: { value: number; tone: 'typed' | 'ink'; label: string }) {
  return (
    <span className={`progress progress-${tone}`} role="img" aria-label={label} style={{ ['--p' as string]: Math.min(1, Math.max(0, value)) }}>
      <span className="progress-fill" />
    </span>
  );
}

export default function Home() {
  useTitle();
  const cfg = useSiteConfig();
  return (
    <>
      <Hero freeAccess={cfg.freeAccess} />

      {/* --------------------------------------------- how a record is made */}
      <Section index="02" eyebrow="How a record is made" title="Every line has a trail." lede="From the first keystroke to a public log anyone can read, each step is checked against the one before it.">
        <Reveal>
          <Note frame watermark={false} label="Record chain" serial={SERIAL} className="min-[701px]:py-10">
            <ProvenancePath nodes={CHAIN} label="How the demo record was made" />
          </Note>
          <p className="text-sm text-ink-soft mt-6">
            The demo record, from the first keystroke to the log.{' '}
            <Link to={`/verify?demo=${DEMO_RECORD.id}`} className="link">
              Check it yourself on the verify page
            </Link>
            .
          </p>
        </Reveal>
      </Section>

      {/* ---------------------------------------------------- replay */}
      <Section band index="03" eyebrow="Replay your essay" title="Watch 2,000 words happen." lede="Your essay at 40 seconds a session. The sentence you rewrote four times. The paragraph that showed up at one in the morning. The paste from a source you then took apart.">
        <div className="mk-split" data-lean="left">
          <div className="grid gap-3 min-w-0">
            <ReplayHero />
            <ul className="mk-legend px-1" aria-label="Legend">
              <li>
                <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full bg-ink mr-1.5 align-[-1px]" />
                typed, in your hand
              </li>
              <li>
                <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-[-1px]" style={{ background: 'var(--paste-wash)', boxShadow: 'inset 0 0 0 1px var(--paste)' }} />
                pasted, with its source
              </li>
              <li>
                <span aria-hidden className="inline-block w-[3px] h-2.5 bg-guilloche mr-1.5 align-[-1px]" />
                time skipped
              </li>
            </ul>
          </div>
          <Reveal className="grid gap-8 min-w-0">
            <Prose>
              <p>Most writing tools keep your final version. Trail keeps the whole thing: what you typed, what you pasted, what you deleted, and when. Scrub it like a video, or just watch it once before you hand it in.</p>
            </Prose>
            <Note label="Sessions" aside={<span className="mono text-xs text-ink-soft">4 sessions, 2h 55m</span>}>
              <p className="text-sm text-ink-soft">Each bar is one sitting: when it started and how many active minutes it lasted. Example record.</p>
              <ol className="mk-bars">
                {SESSIONS.map((s) => (
                  <li key={s.day + s.time}>
                    <span>
                      {s.day} {s.time}
                    </span>
                    <Bar value={s.w / 100} tone="ink" label={`${s.day} ${s.time}: ${s.min} active minutes`} />
                    <span className="text-right text-ink-soft">{s.min} min</span>
                  </li>
                ))}
              </ol>
              <p className="text-sm text-ink-soft">Time between sessions is skipped in the replay. Idle minutes inside a session do not count.</p>
            </Note>
            <div>
              <ButtonLink to="/demo" variant="secondary" icon="play">
                Watch a real essay replay
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ---------------------------------------------------- who it's for */}
      <Section index="04" eyebrow="Who it's for" title="Students now. Everyone who writes, next.">
        <Reveal className="mk-grid-4 mk-who">
          {WHO.map((w) => (
            <Note key={w.who} as="article" lift label={`Series ${w.series}`} aside={w.source ? <Chip kind="neutral">Joining soon</Chip> : <Chip kind="typed">Now</Chip>} title={w.who}>
              <div className="mk-who-icon">
                <Icon name={w.icon} size={22} />
              </div>
              <p className="text-ink-soft">{w.body}</p>
              {w.source ? (
                <div className="mk-push mk-who-wait">
                  <WaitlistCard source={w.source} compact />
                </div>
              ) : (
                <div className="mk-push grid gap-3">
                  <span className="field-hint">Free while in beta. Chrome, with Google Docs, Notion, Word Online and your LMS.</span>
                  <ButtonLink to={CHROME_STORE_URL} external variant="primary" arrow className="w-full">
                    Get Trail for Chrome
                  </ButtonLink>
                </div>
              )}
            </Note>
          ))}
        </Reveal>
      </Section>

      {/* -------------------------------------------------- patterns */}
      <Section band index="05" eyebrow="Know your patterns" title="You already have a process. Now you can see it." lede="When you actually write, how long you last, how much you rewrite. Numbers about you, for you. Nothing is sent anywhere.">
        <Reveal className="grid gap-4">
          <div className="mk-stats">
            <Stat label="Best hour" value="11 pm" detail="most words per minute" info="The hour of the day, in your local time, in which you add the most words per active minute across all your essays." />
            <Stat label="Median session" value="42" unit="min" detail="before a break" info="The middle value of your sessions' active minutes. A session ends after a long silence or when the editor is closed." />
            <Stat label="Typed share" value="91" unit="%" detail="of final text, in your hand" tone="typed" bar={0.91} info="Characters typed one at a time that survive in the final text, divided by the final length, across all your essays." />
            <Stat label="Deleted" value="1.4k" detail="characters per page" info="Characters typed or pasted and later removed, per 500 words of final text. Rewriting shows up here." />
          </div>
          <p className="mono text-2xs text-ink-soft">Example numbers. Yours come from your own record after a few sessions.</p>
        </Reveal>
      </Section>

      {/* ------------------------------------------------- time */}
      <Section index="06" eyebrow="Screen time for homework" title="How long school actually took this week." lede="Active minutes on your school sites and editors, by class and by assignment, with when you did them. Counted on your computer, shown to you, and to nobody else.">
        <div className="mk-split">
          <Reveal>
            <Prose>
              <p>Tracked only on the school sites and editors Trail already records, only while that tab is in front and you are doing something, and only on your computer. Course and assignment names never leave the device. There is no teacher view, no limit and no sharing.</p>
            </Prose>
          </Reveal>
          <Reveal>
            <Note label="By class" aside={<span className="mono text-xs text-ink-soft">this week, 7h 20m</span>}>
              <p className="text-sm text-ink-soft">Each bar is one class: active minutes and how many items you touched. Example numbers.</p>
              <ol className="mk-bars">
                {CLASS_TIME.map((c) => (
                  <li key={c.label}>
                    <span className="text-ink">{c.label}</span>
                    <Bar value={c.min / CLASS_TIME[0].min} tone="typed" label={`${c.label}: ${fmtMin(c.min)}, ${c.items} items`} />
                    <span className="text-right whitespace-nowrap text-ink-soft">
                      {fmtMin(c.min)} · {c.items} items
                    </span>
                  </li>
                ))}
              </ol>
              <ul className="grid gap-2 pt-4 border-t border-rule text-sm">
                <Bullet>Most of your Tuesday work happened after 11pm.</Bullet>
                <Bullet>Your longest unbroken stretch was 94 minutes on Thursday.</Bullet>
              </ul>
              <p className="text-sm text-ink-soft">Plain observations from the numbers, each with the rule that produced it. No scolding.</p>
            </Note>
          </Reveal>
        </div>
      </Section>

      {/* ----------------------------------------------- declaration */}
      <Section band index="07" eyebrow="Declare AI use honestly" title="A statement written from what happened, not from memory." lede="More courses now ask you to declare how you used AI. Trail drafts that statement from your record: which tools, how much, what survived. You edit it, you sign it.">
        <div className="mk-split">
          <Reveal>
            <Prose>
              <p>It says what the record shows and nothing more. If you retyped something by hand, the record cannot see that, and the statement says so. No detection, no score, no verdict.</p>
            </Prose>
          </Reveal>
          <Reveal>
            <Note frame label="AI-use declaration" aside={<Chip kind="neutral">Draft</Chip>}>
              <div className="essay grid gap-3">
                <p>I wrote this essay in Google Docs across four sessions between 12 and 14 October 2026, about 2 hours 55 minutes of active writing.</p>
                <p>
                  Two pastes came from outside this document. One quotation from jstor.org (101 characters) remains, edited. One paste from <span className="prov-paste">chatgpt.com (83 characters)</span> was deleted in full within two minutes; none of it remains.
                </p>
                <p>I did not use any AI tool to produce text that remains in the final essay. This record cannot see text retyped by hand.</p>
              </div>
              <p className="mono text-2xs text-ink-soft">Drafted from the record.</p>
            </Note>
          </Reveal>
        </div>
      </Section>

      {/* ------------------------------------------------- if asked */}
      <Section index="08" eyebrow="And if you're ever accused" title="You will not have to remember. You will have the record." lede="A false accusation is stressful because there is nothing to show. Trail gives you something: an evidence pack you export in one click, that anyone can check without trusting us.">
        <Reveal className="grid gap-10">
          <Note label="Evidence pack" aside={<Chip kind="neutral">Example record</Chip>}>
            <Provenance lines={SAMPLE_LINES} pastes={SAMPLE_PASTES} />
            <p className="text-sm text-ink-soft">Example record. One cell per line of the final essay; the table lists every paste with its source and how much of it survived.</p>
          </Note>
          <dl className="mk-grid-3">
            <Note label="Signed checkpoints">
              <dd className="m-0 text-ink-soft">Every 10 minutes the extension sends a fingerprint of your record to our server, which signs it with the time. We never see the text.</dd>
            </Note>
            <Note label="Drafts">
              <dd className="m-0 text-ink-soft">The essay at 25, 50, 75 and 100 percent, with timestamps, so a reader can see it grow.</dd>
            </Note>
            <Note label="Check it yourself">
              <dd className="m-0 text-ink-soft">
                A professor can drop the pack on{' '}
                <Link to="/verify" className="link">
                  trail.app/verify
                </Link>{' '}
                and check every hash and signature in their browser.
              </dd>
            </Note>
          </dl>
          <p className="text-ink-soft max-w-prose">Whether an institution accepts a pack is up to them. What the pack does is make the conversation about what actually happened.</p>
        </Reveal>
      </Section>

      {/* ------------------------------------------------- pricing + install */}
      <Section band index="09" eyebrow="Pricing and install" title="Start your record tonight.">
        <Reveal className="mk-grid-2">
          <Note as="article" lift label="Pricing" title={cfg.freeAccess ? 'Free while we are in early access.' : '$12 a semester. That is the whole price.'}>
            <p className="text-ink-soft">
              {cfg.freeAccess
                ? 'Every feature, every essay, no card and no trial clock. When pricing switches on it will be $12 a semester, you will hear it from us first, and nothing you recorded will lock.'
                : 'Four months for the price of one coffee a month. Or $3.99 monthly if you prefer. Fourteen days free first, no card.'}
            </p>
            <ul className="grid gap-2 text-sm">
              {(cfg.freeAccess
                ? ['Recording, local storage and export never lock, now or later.', 'No card, no trial, nothing to cancel.', 'Invite three friends who each finish a first replay and a free semester is banked for you.']
                : ['Recording, local storage and export never lock, paid or not.', 'Cancel in one click. Refund in one click within 14 days.', 'Invite three friends who each finish a first replay, get a free semester.']
              ).map((t) => (
                <Bullet key={t}>{t}</Bullet>
              ))}
            </ul>
            <div className="mk-push">
              <ButtonLink to="/pricing" variant="secondary" arrow>
                See plans and rules
              </ButtonLink>
            </div>
          </Note>
          <Note as="article" lift label="Install" title="Five minutes to your first replay.">
            <p className="text-ink-soft">Add the extension, write one paragraph in Google Docs or Notion, and watch it play back. Five minutes, start to first replay.</p>
            <p className="text-sm text-ink-soft">Chrome on a laptop. Works with Google Docs, Notion, Word Online, Canvas, Moodle, Blackboard and Brightspace.</p>
            <div className="mk-push mk-btns">
              <ButtonLink to={CHROME_STORE_URL} external variant="primary" arrow>
                Add to Chrome
              </ButtonLink>
              <ButtonLink to="/demo" variant="secondary">
                Watch the demo first
              </ButtonLink>
            </div>
          </Note>
        </Reveal>
      </Section>
    </>
  );
}

/* ------------------------------------------------------------------ hero */

function Hero({ freeAccess }: { freeAccess: boolean }) {
  const [plate, setPlate] = useState<HTMLDivElement | null>(null);
  return (
    <div className="mk-hero">
      <div className="mk-hero-bg" aria-hidden="true">
        <Guilloche seed={`${DEMO_RECORD.hash}-bg`} variant="waves" intensity="faint" data={[...DEMO_RECORD.minutes]} fill />
      </div>
      <div className="doc-container mk-hero-grid">
        <Reveal className="mk-hero-copy">
          <Eyebrow index="Nº 01">Proof of origin</Eyebrow>
          <h1 className="h-hero">
            Proof of origin for anything you write.
            <span className="mk-hero-sub">Starting with your essays.</span>
          </h1>
          <p className="lede">Trail keeps your own record of how each essay gets written. Replay it. Learn your patterns. And if anyone ever questions your work, the record is already there.</p>
          <div className="mk-btns">
            <ButtonLink to={CHROME_STORE_URL} external variant="primary" size="lg" arrow>
              Get Trail for Chrome
            </ButtonLink>
            <ButtonLink to="/demo" variant="secondary" size="lg" icon="play">
              Watch a replay
            </ButtonLink>
          </div>
          <p className="text-sm text-ink-soft max-w-[34rem]">{freeAccess ? 'Free during early access. No card, no clock. Recording never locks.' : 'Free for 14 days, no card. Then $12 a semester. Recording never locks.'} Coming to the Chrome Web Store; install it today or join the waitlist.</p>
          <div className="w-full max-w-[36rem]">
            <WaitlistCard source="home" compact />
          </div>
        </Reveal>
        <figure className="mk-hero-art">
          <div className="mk-plate" ref={setPlate}>
            <span className="eyebrow mk-plate-tl">Series S · 2026</span>
            <span className="serial mk-plate-tr">
              <span aria-hidden="true">Nº </span>
              <span className="sr-only">Serial </span>
              {SERIAL}
            </span>
            <div className="mk-rosette">
              <Guilloche seed={DEMO_RECORD.hash} data={[...DEMO_RECORD.minutes]} intensity="hero" animate drift label="A rosette drawn from one essay's minute-by-minute typing" />
            </div>
            <div className="mk-seal">
              <Seal state="verified" size={156} zone={plate} />
            </div>
            <span className="eyebrow mk-plate-bl">
              {Math.round(DEMO_RECORD.activeMinutes)} min · {DEMO_RECORD.words} words
            </span>
          </div>
          <figcaption className="mk-caption">Drawn from one essay's typing, minute by minute. Every record engraves its own.</figcaption>
        </figure>
      </div>
    </div>
  );
}

