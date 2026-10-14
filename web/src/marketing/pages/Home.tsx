import { Link } from 'react-router-dom';
import { Badge, Bullet, ButtonLink, CHROME_STORE_URL, Desk, Eyebrow, Heading, Prose, Section, Stat, useTitle } from '../../design/components';
import { DesktopIcon, Dialog, ProgressBar } from '../../design/desktop';
import { useSiteConfig } from '../../lib/config';
import { WaitlistCard } from './Install';
import { ReplayHero } from '../../design/ReplayHero';
import { TypedHeadline } from '../../design/TypedHeadline';
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

export default function Home() {
  useTitle();
  const cfg = useSiteConfig();
  const icons = (
    <>
      <DesktopIcon icon="folder" label="Essays" to="/app" linkAs={Link} />
      <DesktopIcon icon="magnifier" label="Verify" to="/verify" linkAs={Link} />
      <DesktopIcon icon="disk" label="Install" to="/install" linkAs={Link} />
    </>
  );
  return (
    <Desk icons={icons}>
      {/* ------------------------------------------------------------ hero */}
      <Section label="See how you write." code="00:00" titleAs="div" open>
        <div className="grid gap-6">
          <div className="grid gap-4">
            <Eyebrow>A free Chrome extension for students</Eyebrow>
            <TypedHeadline />
          </div>
          <p className="text-lg text-ink-soft max-w-md">Trail keeps your own record of how each essay gets written. Replay it. Learn your patterns. And if anyone ever questions your work, the record is already there.</p>
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink to="/demo" variant="primary" size="lg">
              Watch a real essay replay
            </ButtonLink>
            <ButtonLink to={CHROME_STORE_URL} external size="lg">
              Add to Chrome
            </ButtonLink>
          </div>
          <p className="text-sm text-ink-soft">{cfg.freeAccess ? 'Free during early access. No card, no clock. Recording never locks.' : 'Free for 14 days, no card. Then $12 a semester. Recording never locks.'} Chrome Web Store listing in review; install today or get notified.</p>
        </div>
      </Section>

      {/* ---------------------------------------------------- the player */}
      <div className="grid gap-2 min-w-0 min-[701px]:mt-10">
        <ReplayHero />
        <ul className="bevel-out on-chrome px-3 py-1 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs" aria-label="Legend">
          <li>
            <span aria-hidden className="inline-block w-2.5 h-2.5 bg-ink mr-1.5 align-[-1px]" />
            typed, in your hand
          </li>
          <li>
            <span aria-hidden className="inline-block w-2.5 h-2.5 mr-1.5 align-[-1px]" style={{ background: 'var(--paste-wash)', outline: '1px solid var(--paste)' }} />
            pasted, with its source
          </li>
          <li>
            <span aria-hidden className="inline-block w-[3px] h-2.5 bg-margin mr-1.5 align-[-1px]" />
            time skipped
          </li>
        </ul>
      </div>

      {/* ---------------------------------------------------- replay */}
      <Section label="Replay" code="00:12">
        <Heading eyebrow="Replay your essay" title="Watch 2,000 words happen." lede="Your essay at 40 seconds a session. The sentence you rewrote four times. The paragraph that showed up at one in the morning. The paste from a source you then took apart." />
        <Prose className="mt-6">
          <p>Most writing tools keep your final version. Trail keeps the whole thing: what you typed, what you pasted, what you deleted, and when. Scrub it like a video, or just watch it once before you hand it in.</p>
        </Prose>
      </Section>
      <Section label="Sessions" icon="clock" code="4 sessions, 2h 55m" offset>
        <p className="text-xs text-ink-soft">Each bar is one sitting: when it started and how many active minutes it lasted. Example record.</p>
        <ol className="grid gap-2 mt-3 font-mono text-xs tabular">
          {SESSIONS.map((s) => (
            <li key={s.day + s.time} className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-3">
              <span>
                {s.day} {s.time}
              </span>
              <ProgressBar value={s.w / 100} tone="ink" label={`${s.day} ${s.time}: ${s.min} active minutes`} />
              <span className="text-right text-ink-soft">{s.min} min</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-ink-soft mt-4">Time between sessions is skipped in the replay. Idle minutes inside a session do not count.</p>
      </Section>

      {/* -------------------------------------------------- patterns */}
      <Section label="Patterns" icon="magnifier" code="00:31" wide chrome>
        <Heading eyebrow="Know your patterns" title="You already have a process. Now you can see it." lede="When you actually write, how long you last, how much you rewrite. Numbers about you, for you. Nothing is sent anywhere." />
        <div className="grid gap-2 mt-6 grid-cols-[repeat(auto-fit,minmax(128px,1fr))]">
          <Stat label="Best hour" value="11 pm" detail="most words per minute" info="The hour of the day, in your local time, in which you add the most words per active minute across all your essays." />
          <Stat label="Median session" value="42 min" detail="before a break" info="The middle value of your sessions' active minutes. A session ends after a long silence or when the editor is closed." />
          <Stat label="Typed share" value="91%" detail="of final text, in your hand" tone="typed" info="Characters typed one at a time that survive in the final text, divided by the final length, across all your essays." />
          <Stat label="Deleted" value="1.4k" detail="characters per page" info="Characters typed or pasted and later removed, per 500 words of final text. Rewriting shows up here." />
        </div>
        <p className="font-mono text-[11px] text-ink-soft mt-3">Example numbers. Yours come from your own record after a few sessions.</p>
      </Section>

      {/* ------------------------------------------------- time */}
      <Section label="Time" icon="clock" code="00:40">
        <Heading eyebrow="Screen time for homework" title="How long school actually took this week." lede="Active minutes on your school sites and editors, by class and by assignment, with when you did them. Counted on your computer, shown to you, and to nobody else." />
        <Prose className="mt-6">
          <p>Tracked only on the school sites and editors Trail already records, only while that tab is in front and you are doing something, and only on your computer. Course and assignment names never leave the device. There is no teacher view, no limit and no sharing.</p>
        </Prose>
      </Section>
      <Section label="By class" icon="clock" code="this week, 7h 20m" offset>
        <p className="text-xs text-ink-soft">Each bar is one class: active minutes and how many items you touched. Example numbers.</p>
        <ol className="grid gap-2 mt-3 font-mono text-xs tabular">
          {CLASS_TIME.map((c) => (
            <li key={c.label} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3">
              <span className="text-ink">{c.label}</span>
              <ProgressBar value={c.min / CLASS_TIME[0].min} tone="typed" label={`${c.label}: ${fmtMin(c.min)}, ${c.items} items`} />
              <span className="text-right whitespace-nowrap text-ink-soft">
                {fmtMin(c.min)} · {c.items} items
              </span>
            </li>
          ))}
        </ol>
        <ul className="grid gap-2 mt-5 pt-4 border-t border-rule text-sm">
          <Bullet>Most of your Tuesday work happened after 11pm.</Bullet>
          <Bullet>Your longest unbroken stretch was 94 minutes on Thursday.</Bullet>
        </ul>
        <p className="text-xs text-ink-soft mt-3">Plain observations from the numbers, each with the rule that produced it. No scolding.</p>
      </Section>

      {/* ----------------------------------------------- declaration */}
      <Section label="Declare" code="00:47">
        <Heading eyebrow="Declare AI use honestly" title="A statement written from what happened, not from memory." lede="More courses now ask you to declare how you used AI. Trail drafts that statement from your record: which tools, how much, what survived. You edit it, you sign it." />
        <Prose className="mt-6">
          <p>It says what the record shows and nothing more. If you retyped something by hand, the record cannot see that, and the statement says so. No detection, no score, no verdict.</p>
        </Prose>
      </Section>
      <Section label="AI-use declaration" icon="document" code="draft" offset bodyClassName="essay">
        <div className="mb-4">
          <Badge kind="neutral">from the record</Badge>
        </div>
        <p className="mb-3">I wrote this essay in Google Docs across four sessions between 12 and 14 October 2026, about 2 hours 55 minutes of active writing.</p>
        <p className="mb-3">
          Two pastes came from outside this document. One quotation from jstor.org (101 characters) remains, edited. One paste from <span className="prov-paste">chatgpt.com (83 characters)</span> was deleted in full within two minutes; none of it remains.
        </p>
        <p>I did not use any AI tool to produce text that remains in the final essay. This record cannot see text retyped by hand.</p>
      </Section>

      {/* ------------------------------------------------- accused */}
      <Section label="If asked" icon="disk" code="01:05" wide>
        <Heading eyebrow="And if you're ever accused" title="You will not have to remember. You will have the record." lede="A false accusation is stressful because there is nothing to show. Trail gives you something: an evidence pack you export in one click, that anyone can check without trusting us." />
        <div className="mt-8">
          <Provenance lines={SAMPLE_LINES} pastes={SAMPLE_PASTES} animate />
          <p className="text-xs text-ink-soft mt-3">Example record. One cell per line of the final essay; the table lists every paste with its source and how much of it survived.</p>
        </div>
        <dl className="grid sm:grid-cols-3 gap-4 mt-8 text-sm">
          <div className="panel on-chrome">
            <dt className="panel-legend">Signed checkpoints</dt>
            <dd>Every 10 minutes the extension sends a fingerprint of your record to our server, which signs it with the time. We never see the text.</dd>
          </div>
          <div className="panel on-chrome">
            <dt className="panel-legend">Drafts</dt>
            <dd>The essay at 25, 50, 75 and 100 percent, with timestamps, so a reader can see it grow.</dd>
          </div>
          <div className="panel on-chrome">
            <dt className="panel-legend">Check it yourself</dt>
            <dd>
              A professor can drop the pack on{' '}
              <Link to="/verify" className="link">
                trail.app/verify
              </Link>{' '}
              and check every hash and signature in their browser.
            </dd>
          </div>
        </dl>
        <p className="text-sm text-ink-soft mt-6 max-w-prose">Whether an institution accepts a pack is up to them. What the pack does is make the conversation about what actually happened.</p>
      </Section>

      {/* ------------------------------------------------- pricing */}
      <Dialog
        title={cfg.freeAccess ? 'Free while we are in early access.' : '$12 a semester. That is the whole price.'}
        className="win-open self-start"
        actions={
          <ButtonLink to="/pricing" ring>
            See plans and rules
          </ButtonLink>
        }
      >
        <Eyebrow>Pricing</Eyebrow>
        <p className="text-sm text-ink-soft">
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
      </Dialog>

      {/* ------------------------------------------------- install */}
      <Dialog
        title="Start your record tonight."
        icon="disk"
        className="win-open self-start min-[701px]:mt-10"
        actions={
          <>
            <ButtonLink to="/demo">Watch the demo first</ButtonLink>
            <ButtonLink to={CHROME_STORE_URL} external ring>
              Add to Chrome
            </ButtonLink>
          </>
        }
      >
        <Eyebrow>Install</Eyebrow>
        <p className="text-sm text-ink-soft">Add the extension, write one paragraph in Google Docs or Notion, and watch it play back. Five minutes, start to first replay.</p>
        <p className="text-sm text-ink-soft">Chrome on a laptop. Works with Google Docs, Notion, Word Online, Canvas, Moodle, Blackboard and Brightspace.</p>
        <WaitlistCard source="home" compact />
      </Dialog>
    </Desk>
  );
}
