import { Link } from 'react-router-dom';
import { ButtonLink, CHROME_STORE_URL, Disclosure, Heading, PriceCard, Row, Section, useTitle } from '../../design/components';
import { FadeUp } from '../../design/motion';
import { useSiteConfig } from '../../lib/config';

export default function Pricing() {
  useTitle('Pricing');
  const cfg = useSiteConfig();
  if (cfg.freeAccess) return <FreePricing />;
  return (
    <>
      <Section flush code="00:00" label="Plans">
        <Heading as="h1" eyebrow="Pricing" title="Two plans. No tricks." lede="Fourteen days free with every feature and no card. After that, pick one. Either way, recording, local storage, export and checkpoint signing keep working forever." />
        <div className="grid md:grid-cols-2 gap-5 mt-10">
          <PriceCard
            name="Semester"
            price="$12"
            per="every 4 months"
            equivalent="$3 a month, billed once a semester"
            highlighted
            points={['Replay, sessions, patterns, declaration, evidence packs', 'Renews every 4 months; we email you 7 days before', 'Cancel in one click, no retention screen', 'Full refund within 14 days of any charge, one click']}
            cta={
              <ButtonLink to={CHROME_STORE_URL} external className="w-full">
                Start 14 days free
              </ButtonLink>
            }
            note="Price and renewal date are printed on the checkout button."
          />
          <PriceCard
            name="Monthly"
            price="$3.99"
            per="a month"
            equivalent="Same features, month to month"
            points={['Everything in Semester', 'Renews monthly; we email you 7 days before', 'Cancel in one click, no retention screen', 'Full refund within 14 days of any charge, one click']}
            cta={
              <ButtonLink to={CHROME_STORE_URL} external variant="ghost" className="w-full">
                Start 14 days free
              </ButtonLink>
            }
            note="Prices in USD. Stripe shows your local currency at checkout."
          />
        </div>
      </Section>

      <Section code="00:14" label="Never locks">
        <FadeUp inView>
          <Heading title="What never locks" lede="Your record is yours whether you pay or not. Holding it hostage would make the whole thing pointless." />
          <dl className="mt-6">
            <Row term="Recording">The extension keeps recording after the trial. It never stops because of billing.</Row>
            <Row term="Local storage">Your record stays in your browser, readable by the extension, for as long as you keep it.</Row>
            <Row term="Raw export">Export the full record as JSON at any time, on any plan, including expired.</Row>
            <Row term="Checkpoint signing">The server keeps signing your fingerprints every ten minutes, paid or not, so the chain stays verifiable.</Row>
            <Row term="What does lock">The views: replay, sessions, patterns, the draft declaration, and the one-click evidence pack. That is what you pay for.</Row>
          </dl>
        </FadeUp>
      </Section>

      <Section code="00:26" label="Referral">
        <FadeUp inView>
          <Heading title="Invite three friends, get a semester" lede="Simple rule, no fine print hidden elsewhere." />
          <dl className="mt-6">
            <Row term="The rule">Invite three people. When each of them installs Longhand and finishes their first replay, you get one free semester (4 months) added to your account.</Row>
            <Row term="Stacking">Up to three free semesters in total, so nine successful invites.</Row>
            <Row term="Counting">An invite counts when your friend completes a first replay, not when they sign up. Your progress (0 of 3) is on the Invite page.</Row>
            <Row term="Your friends">They get the same 14-day trial as everyone. No discount either way; we would rather keep one price.</Row>
          </dl>
        </FadeUp>
      </Section>

      <Section code="00:38" label="Refunds">
        <FadeUp inView>
          <Heading title="Refunds and cancelling" lede="The rules we would want as students." />
          <dl className="mt-6">
            <Row term="Refund">Any charge, refunded in full, within 14 days of the charge. One button in Settings, no questions, no email to write. Stripe returns the money to the same card.</Row>
            <Row term="Cancel">One click, through Stripe's customer portal. No "are you sure" flow, no offers to make you stay. Your plan runs to the end of the period you paid for.</Row>
            <Row term="Renewal">We email you seven days before every renewal with the amount and the date. Miss the email and change your mind? The 14-day refund still applies.</Row>
            <Row term="Trial">Starts when you play your first replay, not when you sign up. No card. No countdown timers on your essays.</Row>
          </dl>
        </FadeUp>
      </Section>

      <Section code="00:50" label="Questions">
        <FadeUp inView>
          <Heading title="Questions" />
          <div className="mt-6">
            <Disclosure q="Why is there no free plan?">
              <p>Because the free part is the important part: the record itself is free, always. The views are what cost us money to run and support, and $3 a month is the least we can charge while staying independent. No ads, no selling anything, no institutional deals that would put us on the wrong side of the table.</p>
            </Disclosure>
            <Disclosure q="Why no annual plan?">
              <p>Semesters are how students think. Paying for the summer feels bad. We may add one later if enough people ask.</p>
            </Disclosure>
            <Disclosure q="Do I need a .edu email?">
              <p>No. Half of the students we built this for are at universities that do not use .edu. Any email works.</p>
            </Disclosure>
            <Disclosure q="What happens to my data if I stop paying?">
              <p>Nothing. It is on your device, and it stays there. The extension keeps recording, and you can export the raw record whenever you want. If you come back, every essay you wrote in the meantime is already in your replay list.</p>
            </Disclosure>
            <Disclosure q="Can my university pay for it?">
              <p>Not in this version. Longhand is on the student's side and we want the billing to reflect that. If your department wants to reimburse you, Stripe emails a receipt for every charge, and your invoices are in the billing portal, one click from Settings.</p>
            </Disclosure>
            <Disclosure q="What does the server know about my payment?">
              <p>
                Only your plan and a Stripe customer id. Card details go to Stripe and never touch us. The full list of what we store is on the{' '}
                <Link to="/privacy" className="link">
                  privacy page
                </Link>
                .
              </p>
            </Disclosure>
          </div>
        </FadeUp>
      </Section>
    </>
  );
}

/** Shown while the server runs with FREE_ACCESS (no Stripe): the true, current terms. */
function FreePricing() {
  return (
    <>
      <Section flush code="00:00" label="Plans">
        <Heading as="h1" eyebrow="Pricing" title="Free while we are in early access." lede="Every feature, every essay, no card and no trial clock. Nothing is charged, and there is nothing to cancel." />
        <div className="grid md:grid-cols-2 gap-5 mt-10">
          <PriceCard
            name="Early access"
            price="$0"
            per="for now"
            equivalent="Everything, for every student who installs it"
            highlighted
            points={['Replay, sessions, patterns, declaration, evidence packs', 'Signed checkpoints and the public verifier', 'No card, no trial, no countdown', 'Recording, local storage and export never lock, now or later']}
            cta={
              <ButtonLink to={CHROME_STORE_URL} external className="w-full">
                Add to Chrome
              </ButtonLink>
            }
            note="When pricing switches on you will hear it from us first, with notice."
          />
          <div className="border border-rule rounded-lg p-6 grid gap-3 self-start">
            <span className="marginal">Later, when we charge</span>
            <p className="text-sm text-ink-soft">
              The plan is $12 a semester (four months) or $3.99 a month, with 14 days free first and no card. Cancel in one click, full refund within 14 days of any charge. Invites you make now still count: three friends who each finish a first replay bank you a free semester.
            </p>
            <p className="text-sm text-ink-soft">Whatever the price becomes, the record itself stays free: recording, local storage, raw export and checkpoint signing never lock.</p>
          </div>
        </div>
      </Section>

      <Section code="00:14" label="Never locks">
        <FadeUp inView>
          <Heading title="What never locks" lede="Your record is yours whether you ever pay or not. Holding it hostage would make the whole thing pointless." />
          <dl className="mt-6">
            <Row term="Recording">The extension keeps recording. It never stops because of billing.</Row>
            <Row term="Local storage">Your record stays in your browser, readable by the extension, for as long as you keep it.</Row>
            <Row term="Raw export">Export the full record as JSON at any time.</Row>
            <Row term="Checkpoint signing">The server keeps signing your fingerprints every ten minutes, so the chain stays verifiable.</Row>
          </dl>
        </FadeUp>
      </Section>

      <Section code="00:26" label="Questions">
        <FadeUp inView>
          <Heading title="Questions" />
          <div className="mt-6">
            <Disclosure q="Why is it free?">
              <p>Because we are early and want students using it, telling us what is confusing, and finding the bugs. The record itself will always be free; the views may cost a few dollars a semester later, and $3 a month is the least we could charge while staying independent. No ads, no selling anything, no institutional deals that would put us on the wrong side of the table.</p>
            </Disclosure>
            <Disclosure q="Do I need a .edu email?">
              <p>No. Half of the students we built this for are at universities that do not use .edu. Any email works.</p>
            </Disclosure>
            <Disclosure q="What happens to my data if pricing switches on and I do not pay?">
              <p>Nothing. It is on your device, and it stays there. The extension keeps recording, and you can export the raw record whenever you want. Only the views (replay, patterns, declaration, evidence pack) would need a plan.</p>
            </Disclosure>
            <Disclosure q="What does the server know about me?">
              <p>
                Your email, hashes and signatures. Never your text. The full list of what we store is on the{' '}
                <Link to="/privacy" className="link">
                  privacy page
                </Link>
                .
              </p>
            </Disclosure>
          </div>
        </FadeUp>
      </Section>
    </>
  );
}
