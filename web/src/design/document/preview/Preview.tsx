/* The reference page behind web/public/document-preview.html. Rendered to static HTML at
   build time (scripts in this folder); the page runs the framework-free runtime, not React.
   Not imported by the app. */
import type { ReactNode } from 'react';
import {
  Button,
  ButtonLink,
  Certificate,
  Checkbox,
  Chip,
  Eyebrow,
  Guilloche,
  Icon,
  Info,
  Nav,
  Note,
  ProvenancePath,
  Radio,
  Reveal,
  Seal,
  Stat,
  Swatch,
  TextField,
  Ticker,
  type ProvenanceNode,
} from '../index';

/** per-minute typed characters for a 46-minute essay session (sample) */
export const SAMPLE_MINUTES = [12, 30, 44, 61, 58, 72, 80, 66, 40, 18, 9, 22, 47, 73, 90, 96, 88, 70, 52, 31, 12, 4, 0, 6, 28, 55, 81, 99, 104, 92, 77, 60, 48, 52, 63, 71, 66, 50, 38, 24, 30, 45, 58, 41, 20, 8];
const HASH = '7f7bf4ea91c2d35e08a4b6f1e2c97d03a5b8e4f6c1d2a3b4c5d6e7f8091a2b3c';
const HASH2 = 'c41a09e2b7d35f6a8e1c0b9d2f4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a';
const SIG = 'ed25519:9a3fc0b1e2d4f6a8';

const PATH: ProvenanceNode[] = [
  { id: 'doc', kind: 'doc', label: 'Hamlet and the cost of waiting', detail: '1,840 words' },
  { id: 'ses', kind: 'session', label: '6 writing sessions', detail: '4 h 12 min typed' },
  { id: 'paste', kind: 'paste', label: '3 pastes, each with its source', detail: 'jstor.org · own notes' },
  { id: 'sig', kind: 'signature', label: 'Signed on your device', detail: 'Nº 7F7B·F4EA' },
  { id: 'log', kind: 'log', label: 'Anchored in the public log', detail: 'entry 48,213' },
];

function Hero({ seed }: { seed: string }) {
  return (
    <div className="pv-hero">
      <div className="pv-hero-bg" aria-hidden="true">
        <Guilloche seed={`${seed}-bg`} variant="waves" intensity="faint" data={SAMPLE_MINUTES} />
      </div>
      <div className="doc-container pv-hero-grid">
        <Reveal className="pv-hero-copy">
          <Eyebrow index="Nº 01">Proof of origin</Eyebrow>
          <h1 className="h-hero">
            Proof of origin for anything you write.
            <span className="pv-hero-sub">Starting with your essays.</span>
          </h1>
          <p className="lede">
            Trail keeps a record of how your writing came to be: the typing, every paste and where it came from, each session. Then it signs the record, so anyone can check it in a browser.
          </p>
          <div className="pv-row">
            <ButtonLink to="#install" variant="primary" size="lg" arrow>
              Get Trail for Chrome
            </ButtonLink>
            <ButtonLink to="#demo" variant="secondary" size="lg" icon="play">
              Watch a replay
            </ButtonLink>
          </div>
          <p className="eyebrow">Free in beta · your writing stays on your device</p>
        </Reveal>
        <figure className="pv-hero-art">
          <div className="pv-plate">
            <span className="eyebrow pv-plate-tl">Series S · 2026</span>
            <span className="serial pv-plate-tr">Nº 7F7B·F4EA</span>
            <div className="pv-rosette">
              <Guilloche seed={seed} data={SAMPLE_MINUTES} intensity="hero" animate drift label="A rosette drawn from one essay's minute-by-minute typing" />
            </div>
            <div className="pv-seal">
              <Seal state="verified" size={150} />
            </div>
            <span className="eyebrow pv-plate-bl">46 min · 1,840 words</span>
          </div>
          <figcaption className="pv-caption">Drawn from one essay's typing, minute by minute. Every record engraves its own.</figcaption>
        </figure>
      </div>
    </div>
  );
}

function PathBand() {
  return (
    <section className="section doc-container">
      <Reveal as="header" className="section-head">
        <Eyebrow index="02">How a record is made</Eyebrow>
        <h2 className="h-section">Every line has a trail.</h2>
        <p className="lede">From the first keystroke to a public log anyone can read, each step is checked against the one before it.</p>
      </Reveal>
      <Note crop frame watermark={false} label="Record chain" serial="7F7B·F4EA" className="pv-path-note">
        <ProvenancePath nodes={PATH} />
      </Note>
    </section>
  );
}

const WHO: Array<{ who: string; series: string; icon: 'students' | 'research' | 'legal' | 'writers'; now?: boolean; body: string }> = [
  { who: 'Students', series: 'S', icon: 'students', now: true, body: 'Show how your essay was written: a replay, every paste with its source, a record your teacher can check.' },
  { who: 'Researchers', series: 'R', icon: 'research', body: 'Drafts and lab notes with a record of origin, for journals that now ask how a text was made.' },
  { who: 'Lawyers', series: 'L', icon: 'legal', body: 'Briefs whose every citation carries where it came from, ready for disclosure rules.' },
  { who: 'Writers', series: 'W', icon: 'writers', body: 'Manuscripts that carry the record of being written, page by page.' },
];

function WhoBand({ ns }: { ns: string }) {
  return (
    <div className="band">
      <section className="section doc-container">
        <Reveal as="header" className="section-head">
          <Eyebrow index="03">Who it's for</Eyebrow>
          <h2 className="h-section">Students now. Everyone who writes, next.</h2>
        </Reveal>
        <Reveal className="pv-who">
          {WHO.map((w) => (
            <Note key={w.who} as="article" crop lift label={`Series ${w.series}`} aside={w.now ? <Chip kind="typed">Now</Chip> : <Chip kind="neutral">Soon</Chip>} title={w.who}>
              <div className="pv-who-icon">
                <Icon name={w.icon} size={22} />
              </div>
              <p className="pv-muted">{w.body}</p>
              {w.now ? (
                <div className="pv-push pv-stack-sm">
                  <span className="field-hint">Free while in beta. Chrome, with Google Docs.</span>
                  <ButtonLink to="#install" variant="primary" arrow className="pv-full">
                    Get Trail for Chrome
                  </ButtonLink>
                </div>
              ) : (
                <form className="pv-push pv-stack-sm" onSubmit={(e) => e.preventDefault()}>
                  <label className="sr-only" htmlFor={`${ns}-wl-${w.series}`}>
                    Email for the {w.who.toLowerCase()} waitlist
                  </label>
                  <input id={`${ns}-wl-${w.series}`} className="field" type="email" placeholder="Email address" />
                  <Button type="submit" variant="secondary" className="pv-full" aria-label={`Join the ${w.who.toLowerCase()} waitlist`}>
                    Join the waitlist
                  </Button>
                </form>
              )}
            </Note>
          ))}
        </Reveal>
      </section>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="pv-dl-row">
      <dt className="eyebrow">{k}</dt>
      <dd className={mono ? 'mono pv-hash' : undefined}>{v}</dd>
    </div>
  );
}

function VerifyBand({ ns }: { ns: string }) {
  return (
    <section className="section doc-container">
      <Reveal as="header" className="section-head">
        <Eyebrow index="04">Verify</Eyebrow>
        <h2 className="h-section">Inspect a record like a certificate.</h2>
        <p className="lede">Drop the file in. Fourteen checks run in your browser; nothing is uploaded.</p>
      </Reveal>
      <div className="pv-verify">
        <Certificate
          hash={HASH}
          hashes={[HASH2, SIG]}
          data={SAMPLE_MINUTES}
          label="Certificate of origin"
          title="Hamlet and the cost of waiting"
          footer={
            <>
              <span className="mono pv-hash pv-trunc">sha256 {HASH}</span>
              <Button size="sm" variant="quiet" icon="copy">
                Copy
              </Button>
            </>
          }
        >
          <div className="pv-cert-body">
            <dl className="pv-dl">
              <Row k="Author" v="m.okafor@pomona.edu" />
              <Row k="Written" v="6 sessions, 12–19 Oct 2026" />
              <Row k="Typed" v={<span style={{ color: 'var(--typed)' }}>94 % of the final text</span>} />
              <Row k="Pasted" v={<span style={{ color: 'var(--paste)' }}>3 passages · jstor.org, own notes</span>} />
              <Row k="Signature" v={SIG} mono />
              <Row k="Checks" v="14 of 14 passed" />
            </dl>
            <div className="pv-cert-seal">
              <Seal state="verified" size={136} />
              <Chip kind="signed">Signature valid</Chip>
            </div>
          </div>
        </Certificate>
        <div className="pv-seals" id={`${ns}-seals`}>
          {(
            [
              ['verified', 'Verified', 'Foil, engraved. The only place foil appears.'],
              ['pending', 'Pending', 'Ink only; the outer ring turns while checks run.'],
              ['broken', 'Broken', 'Seal red, cracked through. The chain was altered.'],
            ] as const
          ).map(([s, name, line]) => (
            <figure key={s} className="pv-seal-fig">
              <Seal state={s} size={112} />
              <figcaption>
                <span className="eyebrow">{name}</span>
                <span className="pv-muted pv-small">{line}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Kit({ ns }: { ns: string }) {
  return (
    <section className="section doc-container">
      <Reveal as="header" className="section-head">
        <Eyebrow index="05">Components</Eyebrow>
        <h2 className="h-section">The kit.</h2>
      </Reveal>
      <div className="pv-kit">
        <Note crop label="Buttons" serial="BTN·0001">
          <div className="pv-row">
            <Button variant="primary" arrow>
              Get Trail
            </Button>
            <Button variant="secondary">Watch a replay</Button>
            <Button variant="quiet">Log in</Button>
          </div>
          <div className="pv-row">
            <Button variant="danger" icon="cross">
              Delete record
            </Button>
            <Button size="sm" variant="secondary" icon="upload">
              Upload
            </Button>
            <Button size="lg" variant="primary">
              Sign and export
            </Button>
            <Button disabled>Disabled</Button>
          </div>
        </Note>
        <Note crop label="Fields" serial="FLD·0002">
          <TextField id={`${ns}-email`} label="School email" type="email" placeholder="you@school.edu" hint="We send one link. No password." />
          <TextField id={`${ns}-code`} label="Invite code" defaultValue="TRAIL-48" error="That code has already been used." />
          <div className="pv-row">
            <Checkbox label="Include the replay" defaultChecked />
            <Radio name={`${ns}-r`} label="PDF" defaultChecked />
            <Radio name={`${ns}-r`} label="JSON" />
          </div>
        </Note>
        <Note crop label="Provenance" serial="PRV·0003">
          <div className="pv-row">
            <Chip kind="typed">Typed</Chip>
            <Chip kind="pasted">Pasted</Chip>
            <Chip kind="pasted-edited">Pasted, edited</Chip>
            <Chip kind="signed">Signed</Chip>
            <Chip kind="mixed">Mixed</Chip>
            <Chip kind="unobserved">Unobserved</Chip>
            <Chip kind="seal">Chain broken</Chip>
          </div>
          <p className="essay">
            Hamlet's delay is not cowardice but a kind of scruple.{' '}
            <span className="prov-paste" title="Pasted from jstor.org">
              "The readiness is all," he says, having stopped asking whether readiness is enough.
            </span>{' '}
            What he waits for is certainty<span className="caret" aria-hidden="true" />
          </p>
          <div className="prov-strip" aria-label="Where each line came from: mostly typed, one paste">
            {['typed', 'typed', 'typed', 'pasted', 'typed', 'typed', 'pasted-edited', 'typed', 'typed', 'mixed', 'typed', 'typed'].map((k, i) => (
              <span key={i} className={`is-${k}`} />
            ))}
          </div>
          <div className="pv-row pv-small">
            <span><Swatch kind="typed" /> typed</span>
            <span><Swatch kind="pasted" /> pasted</span>
            <span><Swatch kind="mixed" /> mixed</span>
          </div>
        </Note>
        <Note crop label="Waitlist" serial="WL·0005" guilloche={{ seed: 'waitlist', variant: 'rosette', intensity: 'card' }} watermark={false}>
          <Ticker value={1284} label="students on the waitlist" live />
          <p className="pv-muted">students on the waitlist</p>
          <div className="pv-row">
            <span className="pv-muted pv-small">What counts as a paste?</span>
            <Info text="Text that arrived in one go from the clipboard. Trail records where it came from when the browser can tell." />
          </div>
        </Note>
        <div className="pv-stats">
          <Stat label="Typed" value="94" unit="%" tone="typed" bar={0.94} detail="1,730 of 1,840 words" info="Share of the final text that was typed in this document, not pasted." />
          <Stat label="Pastes" value="3" tone="paste" detail="2 sources" info="Each paste is listed with where it came from." />
          <Stat label="Sessions" value="6" detail="4 h 12 min" />
          <Stat label="Signed" value="14" unit="/14" tone="signed" detail="checks passed" />
        </div>
      </div>
    </section>
  );
}

function Specimen() {
  return (
    <section className="section doc-container">
      <Reveal as="header" className="section-head">
        <Eyebrow index="06">Type</Eyebrow>
        <h2 className="h-section">Archivo, expanded. Fragment Mono for the machine.</h2>
      </Reveal>
      <Note crop frame microprint={[HASH, HASH2]} label="Specimen" serial="TYP·0006">
        <div className="pv-specimen">
          <span className="numeral pv-numeral">48,213</span>
          <span className="display pv-display">Proof of origin</span>
          <span className="h-section">Section heading, Archivo 115 %</span>
          <p>Body text is Archivo at 100 % width, 16 px on 1.55. It reads at length and stays out of the way of the record.</p>
          <span className="mono pv-hash">sha256 {HASH}</span>
          <span className="eyebrow">Mono caps · eyebrows · labels · 11 px · .14em</span>
        </div>
      </Note>
    </section>
  );
}

const DAY_SW = [
  ['paper', '#E8EDE7'],
  ['sheet', '#F6F8F4'],
  ['ink', '#14213D'],
  ['ink-soft', '#3F4B5E'],
  ['guilloche', '#5E8C7A'],
  ['typed', '#1D5C47'],
  ['paste', '#8A4A12'],
  ['signed', '#2546A0'],
  ['seal', '#B3261E'],
] as const;

function Palette() {
  return (
    <section className="section doc-container">
      <Reveal as="header" className="section-head">
        <Eyebrow index="07">Palette</Eyebrow>
        <h2 className="h-section">Banknote paper, engraving ink.</h2>
      </Reveal>
      <div className="pv-palette">
        {DAY_SW.map(([n]) => (
          <div key={n} className="pv-sw">
            <span className="pv-sw-chip" style={{ background: `var(--${n})` }} />
            <span className="eyebrow">{n}</span>
          </div>
        ))}
        <div className="pv-sw">
          <span className="pv-sw-chip pv-foil" />
          <span className="eyebrow">foil (seal only)</span>
        </div>
      </div>
    </section>
  );
}

export function Preview() {
  return (
    <>
      <div data-surface="day" id="daylight">
        <Nav
          items={[
            { label: 'How it works', to: '#how' },
            { label: 'Demo', to: '#demo', current: true },
            { label: 'Verify', to: '#verify' },
            { label: 'Install', to: '#install' },
            { label: 'Pricing', to: '#pricing' },
          ]}
          right={
            <>
              <a href="#night" className="btn btn-quiet btn-sm btn-icon" aria-label="Jump to night vault">
                <Icon name="moon" size={18} />
              </a>
              <a href="#login" className="nav-link hide-phone">
                Log in
              </a>
              <ButtonLink to="#install" variant="primary" size="sm">
                Get Trail
              </ButtonLink>
            </>
          }
        />
        <Hero seed="trail-home" />
        <PathBand />
        <WhoBand ns="d" />
        <VerifyBand ns="d" />
        <Kit ns="d" />
        <Specimen />
        <Palette />
      </div>
      <div data-surface="night" id="night">
        <div className="doc-container pv-vault-head">
          <Eyebrow index="Night">Night vault</Eyebrow>
        </div>
        <Hero seed="trail-home" />
        <PathBand />
        <VerifyBand ns="n" />
        <Kit ns="n" />
      </div>
    </>
  );
}
