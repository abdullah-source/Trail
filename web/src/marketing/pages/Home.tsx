import { Link } from 'react-router-dom';
import { Badge, ButtonLink, Card, CHROME_STORE_URL, Eyebrow, Heading, Prose, Section, Stat, useTitle } from '../../design/components';
import { useSiteConfig } from '../../lib/config';
import { WaitlistCard } from './Install';
import { FadeUp, Stagger, StaggerItem } from '../../design/motion';
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

const SESSIONS = [
  { day: 'Tue', time: '22:41', min: 48, w: 62 },
  { day: 'Wed', time: '23:10', min: 72, w: 100 },
  { day: 'Thu', time: '00:05', min: 19, w: 26 },
  { day: 'Sat', time: '15:02', min: 36, w: 48 },
];

export default function Home() {
  useTitle();
  const cfg = useSiteConfig();
  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <Section flush wide code="00:00" label="Replay">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12 items-start">
          <div className="lg:col-span-5 grid gap-6">
            <div className="grid gap-4">
              <Eyebrow>A free Chrome extension for students</Eyebrow>
              <TypedHeadline />
            </div>
            <p className="text-lg sm:text-xl text-ink-soft max-w-md">
              Trail keeps your own record of how each essay gets written. Replay it. Learn your patterns. And if anyone ever questions your work, the record is already there.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink to="/demo" size="lg">
                Watch a real essay replay
              </ButtonLink>
              <ButtonLink to={CHROME_STORE_URL} external variant="ghost" size="lg">
                Add to Chrome
              </ButtonLink>
            </div>
            <p className="text-sm text-ink-soft">{cfg.freeAccess ? 'Free during early access. No card, no clock. Recording never locks.' : 'Free for 14 days, no card. Then $12 a semester. Recording never locks.'} Chrome Web Store listing in review; install today or get notified.</p>
          </div>
          <div className="lg:col-span-7 grid gap-3">
            <ReplayHero />
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-soft font-mono">
              <li>
                <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-[2px] bg-ink mr-1.5 align-[-1px]" />
                typed, in your hand
              </li>
              <li>
                <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-[2px] mr-1.5 align-[-1px]" style={{ background: 'var(--paste-wash)', outline: '1px solid var(--paste)' }} />
                pasted, with its source
              </li>
              <li>
                <span aria-hidden className="inline-block w-[3px] h-2.5 rounded-sm bg-margin mr-1.5 align-[-1px]" />
                time skipped
              </li>
            </ul>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------- replay */}
      <Section code="00:12" label="Replay">
        <div className="grid gap-10 md:grid-cols-2 md:gap-12 items-start">
          <FadeUp inView>
            <Heading eyebrow="Replay your essay" title="Watch 2,000 words happen." lede="Your essay at 40 seconds a session. The sentence you rewrote four times. The paragraph that showed up at one in the morning. The paste from a source you then took apart." />
            <Prose className="mt-6">
              <p>Most writing tools keep your final version. Trail keeps the whole thing: what you typed, what you pasted, what you deleted, and when. Scrub it like a video, or just watch it once before you hand it in.</p>
            </Prose>
          </FadeUp>
          <FadeUp inView delay={0.1}>
            <Card>
              <div className="flex items-baseline justify-between mb-4">
                <Eyebrow tick={false}>Sessions</Eyebrow>
                <span className="font-mono text-xs text-ink-soft">4 sessions, 2h 55m</span>
              </div>
              <p className="text-xs text-ink-soft mb-3">Each bar is one sitting: when it started and how many active minutes it lasted. Example record.</p>
              <ol className="grid gap-3">
                {SESSIONS.map((s) => (
                  <li key={s.day + s.time} className="grid grid-cols-[3.5rem_1fr_3rem] items-center gap-3 font-mono text-xs text-ink-soft tabular">
                    <span>
                      {s.day} {s.time}
                    </span>
                    <span className="h-3 bg-rule rounded-sm overflow-hidden">
                      <span className="block h-full bg-ink" style={{ width: `${s.w}%` }} />
                    </span>
                    <span className="text-right">{s.min} min</span>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-ink-soft mt-4">Time between sessions is skipped in the replay. Idle minutes inside a session do not count.</p>
            </Card>
          </FadeUp>
        </div>
      </Section>

      {/* -------------------------------------------------- patterns */}
      <Section code="00:31" label="Patterns">
        <FadeUp inView>
          <Heading eyebrow="Know your patterns" title="You already have a process. Now you can see it." lede="When you actually write, how long you last, how much you rewrite. Numbers about you, for you. Nothing is sent anywhere." />
        </FadeUp>
        <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-10">
          <StaggerItem>
            <Stat label="Best hour" value="11 pm" detail="most words per minute" info="The hour of the day, in your local time, in which you add the most words per active minute across all your essays." />
          </StaggerItem>
          <StaggerItem>
            <Stat label="Median session" value="42 min" detail="before a break" info="The middle value of your sessions' active minutes. A session ends after a long silence or when the editor is closed." />
          </StaggerItem>
          <StaggerItem>
            <Stat label="Typed share" value="91%" detail="of final text, in your hand" tone="typed" info="Characters typed one at a time that survive in the final text, divided by the final length, across all your essays." />
          </StaggerItem>
          <StaggerItem>
            <Stat label="Deleted" value="1.4k" detail="characters per page" info="Characters typed or pasted and later removed, per 500 words of final text. Rewriting shows up here." />
          </StaggerItem>
        </Stagger>
        <p className="font-mono text-[11px] text-ink-soft mt-4">Example numbers. Yours come from your own record after a few sessions.</p>
      </Section>

      {/* ----------------------------------------------- declaration */}
      <Section code="00:47" label="Declare">
        <div className="grid gap-10 md:grid-cols-2 md:gap-12 items-start">
          <FadeUp inView>
            <Heading eyebrow="Declare AI use honestly" title="A statement written from what happened, not from memory." lede="More courses now ask you to declare how you used AI. Trail drafts that statement from your record: which tools, how much, what survived. You edit it, you sign it." />
            <Prose className="mt-6">
              <p>It says what the record shows and nothing more. If you retyped something by hand, the record cannot see that, and the statement says so. No detection, no score, no verdict.</p>
            </Prose>
          </FadeUp>
          <FadeUp inView delay={0.1}>
            <Card as="article" className="essay text-[16px]">
              <div className="flex items-center gap-2 mb-4 not-italic">
                <Eyebrow tick={false}>Draft declaration</Eyebrow>
                <Badge kind="neutral">from the record</Badge>
              </div>
              <p className="mb-3">I wrote this essay in Google Docs across four sessions between 12 and 14 October 2026, about 2 hours 55 minutes of active writing.</p>
              <p className="mb-3">
                Two pastes came from outside this document. One quotation from jstor.org (101 characters) remains, edited. One paste from{' '}
                <span className="prov-paste">chatgpt.com (83 characters)</span> was deleted in full within two minutes; none of it remains.
              </p>
              <p>I did not use any AI tool to produce text that remains in the final essay. This record cannot see text retyped by hand.</p>
            </Card>
          </FadeUp>
        </div>
      </Section>

      {/* ------------------------------------------------- accused */}
      <Section code="01:05" label="If asked">
        <FadeUp inView>
          <Heading eyebrow="And if you're ever accused" title="You will not have to remember. You will have the record." lede="A false accusation is stressful because there is nothing to show. Trail gives you something: an evidence pack you export in one click, that anyone can check without trusting us." />
        </FadeUp>
        <FadeUp inView delay={0.1} className="mt-10">
          <Card>
            <Provenance lines={SAMPLE_LINES} pastes={SAMPLE_PASTES} animate />
            <p className="text-xs text-ink-soft mt-3">Example record. One cell per line of the final essay; the table lists every paste with its source and how much of it survived.</p>
            <dl className="grid sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-rule text-sm">
              <div>
                <dt className="marginal">Signed checkpoints</dt>
                <dd className="mt-1 text-ink-soft">Every 10 minutes the extension sends a fingerprint of your record to our server, which signs it with the time. We never see the text.</dd>
              </div>
              <div>
                <dt className="marginal">Drafts</dt>
                <dd className="mt-1 text-ink-soft">The essay at 25, 50, 75 and 100 percent, with timestamps, so a reader can see it grow.</dd>
              </div>
              <div>
                <dt className="marginal">Check it yourself</dt>
                <dd className="mt-1 text-ink-soft">
                  A professor can drop the pack on{' '}
                  <Link to="/verify" className="link">
                    trail.app/verify
                  </Link>{' '}
                  and check every hash and signature in their browser.
                </dd>
              </div>
            </dl>
          </Card>
        </FadeUp>
        <p className="text-sm text-ink-soft mt-6 max-w-prose">Whether an institution accepts a pack is up to them. What the pack does is make the conversation about what actually happened.</p>
      </Section>

      {/* ------------------------------------------------- pricing */}
      <Section code="01:32" label="Price">
        <div className="grid gap-8 md:grid-cols-2 items-start">
          <FadeUp inView>
            {cfg.freeAccess ? (
              <Heading eyebrow="Pricing" title="Free while we are in early access." lede="Every feature, every essay, no card and no trial clock. When pricing switches on it will be $12 a semester, you will hear it from us first, and nothing you recorded will lock." />
            ) : (
              <Heading eyebrow="Pricing" title="$12 a semester. That is the whole price." lede="Four months for the price of one coffee a month. Or $3.99 monthly if you prefer. Fourteen days free first, no card." />
            )}
          </FadeUp>
          <FadeUp inView delay={0.1}>
            <Card className="grid gap-4">
              <ul className="grid gap-2 text-sm">
                {(cfg.freeAccess
                  ? ['Recording, local storage and export never lock, now or later.', 'No card, no trial, nothing to cancel.', 'Invite three friends who each finish a first replay and a free semester is banked for you.']
                  : ['Recording, local storage and export never lock, paid or not.', 'Cancel in one click. Refund in one click within 14 days.', 'Invite three friends who each finish a first replay, get a free semester.']
                ).map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <span aria-hidden className="mt-[0.6em] inline-block w-3 h-px bg-margin shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
              <ButtonLink to="/pricing" variant="ghost">
                See plans and rules
              </ButtonLink>
            </Card>
          </FadeUp>
        </div>
      </Section>

      {/* ------------------------------------------------- install */}
      <Section code="01:40" label="Start">
        <FadeUp inView>
          <Heading eyebrow="Install" title="Start your record tonight." lede="Add the extension, write one paragraph in Google Docs or Notion, and watch it play back. Five minutes, start to first replay." />
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <ButtonLink to={CHROME_STORE_URL} external size="lg">
              Add to Chrome
            </ButtonLink>
            <ButtonLink to="/demo" variant="ghost" size="lg">
              Watch the demo first
            </ButtonLink>
          </div>
          <p className="text-sm text-ink-soft mt-4">Chrome on a laptop. Works with Google Docs, Notion, Word Online, Canvas, Moodle, Blackboard and Brightspace.</p>
          <div className="mt-8 max-w-lg">
            <WaitlistCard source="home" compact />
          </div>
        </FadeUp>
      </Section>
    </>
  );
}
