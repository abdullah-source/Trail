import { useEffect, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  Button as DocButton,
  ButtonLink as DocButtonLink,
  buttonClass,
  Chip,
  cx,
  Eyebrow,
  Info,
  Mark,
  Nav as DocNav,
  Note,
  Section as DocSection,
  Stat as DocStat,
  ThemeToggle,
  Wordmark as DocWordmark,
  type ButtonLinkProps as DocButtonLinkProps,
  type ButtonProps as DocButtonProps,
  type ChipKind,
  type LinkComponent,
  type SectionProps as DocSectionProps,
  type StatProps,
} from './document';

/* The marketing shell on the security-document kit (src/design/document, DESIGN-document.md §13
   step 3). Pages are document Sections on banknote paper; cards are Notes; badges are Chips. */

export { cx, Info, Eyebrow, Mark, ThemeToggle, Chip, Note, buttonClass };

/** The Web Store listing once it exists (VITE_CHROME_STORE_URL); until then the install page. */
export const CHROME_STORE_URL: string = ((import.meta as any).env?.VITE_CHROME_STORE_URL as string | undefined) || '/install';

const RouterLink = Link as unknown as LinkComponent;

/* ------------------------------------------------------------ the demo record
   One real record, used wherever the marketing pages print a security feature (§10: no fake
   ones). Computed from public/demo/demo-mixed-1.events.json, the essay /verify?demo= checks:
   typed characters per active minute across its three sessions, its record hash (the
   manifest's events_hash), chain head and snapshot hashes. Regenerate if that file changes. */
export const DEMO_RECORD = {
  id: 'demo-mixed-1',
  title: 'European colonial powers in the Caribbean',
  words: 362,
  sessions: 3,
  activeMinutes: 9.3,
  typedShare: 0.92,
  paste: { host: 'en.wikipedia.org', chars: 194 },
  editor: 'Word Online',
  /** typed characters per active minute, sessions laid end to end */
  minutes: [0, 0, 136, 259, 281, 143, 1, 0, 0, 74, 217, 228, 0, 68, 241, 181, 286, 97],
  /** the record hash: a pack manifest's events_hash, what /verify prints as the serial */
  hash: '0ec44e2d96b4297e3fc0e95ea723f399dadec2914344e86e10c61b9d9efaf6be',
  /** the chain head: the last event's hash */
  head: 'c70136e88d1f018599829f51f827fbbd11a842cb1a808a4ae31ed629f895a28e',
  snapshots: ['e2c95260309780c4fa395214eefef0c72f70b98d7a8294d61c4b6fc475c69dbf', 'e0baa66c61f5813cbeb869a5f2e7d3f2c6915fca68e8548cb8c5fdc4bfdbcb30', '2ce0cb55eb258a8141f919a7e093ad3dc61e5682e17e6bf0ad5f73297e9acf4c'],
} as const;

/* ------------------------------------------------------------------ Button */

export type ButtonVariant = DocButtonProps['variant'];
export type ButtonProps = DocButtonProps;
/** The pill: primary (ink), secondary, quiet, danger. `default` and `ghost` still work. */
export const Button = DocButton;

export type ButtonLinkProps = Omit<DocButtonLinkProps, 'linkAs'>;

/** A pill that is a link. In-app paths use the router; `external` opens absolute URLs in a new tab. */
export function ButtonLink({ to, external, ...rest }: ButtonLinkProps) {
  const opensTab = !!external && !to.startsWith('/');
  return <DocButtonLink to={to} external={opensTab} linkAs={RouterLink} {...rest} />;
}

/** A link to the Web Store listing (new tab) or, until it exists, to /install. */
export function StoreLink({ className, children }: { className?: string; children: ReactNode }) {
  if (CHROME_STORE_URL.startsWith('/'))
    return (
      <Link to={CHROME_STORE_URL} className={className}>
        {children}
      </Link>
    );
  return (
    <a href={CHROME_STORE_URL} className={className} target="_blank" rel="noreferrer">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/* ------------------------------------------------------------ Wordmark */

export function Wordmark({ to = '/', className }: { to?: string; className?: string }) {
  return <DocWordmark to={to} linkAs={RouterLink} className={className} />;
}

/* ---------------------------------------------------------------- Nav */

const LINKS = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/demo', label: 'Demo' },
  { to: '/verify', label: 'Verify' },
  { to: '/install', label: 'Install' },
  { to: '/pricing', label: 'Pricing' },
];

/** The frosted bar, with the skip link above it. */
export function Nav() {
  const { pathname } = useLocation();
  const here = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 btn btn-primary btn-sm">
        Skip to content
      </a>
      <DocNav
        items={LINKS.map((l) => ({ ...l, current: here(l.to) }))}
        linkAs={RouterLink}
        right={
          <>
            <ThemeToggle />
            <Link className="nav-link hide-phone" to="/login" aria-current={here('/login') ? 'page' : undefined}>
              Log in
            </Link>
            <StoreLink className={buttonClass({ variant: 'primary', size: 'sm' })}>Get Trail</StoreLink>
          </>
        }
      />
    </>
  );
}

/* ------------------------------------------------------------------ Footer */

/** A quiet note at the foot of every page, its frame engraved with the demo record's hashes. */
export function Footer() {
  return (
    <footer className="doc-container mk-footer">
      <Note crop={false} watermark={false} microprint={[DEMO_RECORD.hash, DEMO_RECORD.head, ...DEMO_RECORD.snapshots]} className="mk-footer-note">
        <div className="mk-footer-row">
          <span className="inline-flex items-center gap-2.5 text-sm">
            <Mark size={18} />
            2026 Trail. Built for students, not against them.
          </span>
          <nav aria-label="Footer" className="mk-footer-links">
            <Link to="/how-it-works">
              How it works
            </Link>
            <Link to="/demo">
              Demo
            </Link>
            <Link to="/pricing">
              Pricing
            </Link>
            <Link to="/verify">
              Verify a record
            </Link>
            <Link to="/install">
              Install
            </Link>
            <Link to="/privacy">
              Privacy
            </Link>
            <Link to="/terms">
              Terms
            </Link>
            <a href="mailto:hello@trail.app">
              hello@trail.app
            </a>
            <Link to="/login">
              Log in
            </Link>
          </nav>
        </div>
        <p className="text-sm text-ink-soft">Your record stays on your device. Our server only ever holds hashes, signatures and your email.</p>
        <p className="mono text-2xs text-ink-faint [overflow-wrap:anywhere]">The border is engraved with the demo record's hashes: record {DEMO_RECORD.hash}.</p>
      </Note>
    </footer>
  );
}

/** Fonts are self-hosted (src/design/document/fonts.css); nothing is fetched from Google. Kept as a
 *  no-op so callers need no change. */
export const FONTS_HREF = '/fonts/';
export function useFonts() {
  /* self-hosted: nothing to inject */
}

/** The page: frosted nav + <main id="main"> + the footer note around an <Outlet/>. */
export function MarketingLayout() {
  return (
    <div className="min-h-dvh flex flex-col bg-paper text-ink">
      <Nav />
      <main id="main" className="flex-1 min-w-0">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

/* -------------------------------------------------------------------- Desk */

export type DeskWidth = 'wide' | 'reading' | 'narrow';

/** A plain container for a single-column page (login, 404): `.doc-container` with page padding. */
export function Desk({ children, width = 'wide', className }: { children: ReactNode; columns?: 1 | 2; width?: DeskWidth; className?: string; icons?: ReactNode }) {
  return (
    <div className={cx('doc-container mk-desk', className)} data-width={width}>
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- Section */

export type SectionProps = DocSectionProps & {
  /** old name for `eyebrow` */
  label?: ReactNode;
  /** old name for `index` */
  code?: string;
};

/** A page section: index, eyebrow, expanded heading, lede, then the content. */
export function Section({ label, code, eyebrow, index, ...rest }: SectionProps) {
  return <DocSection eyebrow={eyebrow ?? label} index={index ?? code} {...rest} />;
}

/* ---------------------------------------------------------------- Surfaces */

/** A note: sheet, hairline, crop marks. `legend` prints as its mono caps label. */
export function Card({ children, className, as, legend }: { children: ReactNode; className?: string; as?: 'div' | 'article' | 'li' | 'section'; legend?: ReactNode }) {
  return (
    <Note as={as} label={legend} className={className}>
      {children}
    </Note>
  );
}

/* ------------------------------------------------------------------- Stat */

/** Expanded banknote numerals, a mono caps label, a mono detail and the "?" affordance. */
export function Stat(props: StatProps) {
  return <DocStat {...props} />;
}

export type BadgeKind = ChipKind;

/** A mono caps chip with a provenance dot. */
export function Badge({ kind = 'neutral', children, className }: { kind?: BadgeKind; children: ReactNode; className?: string }) {
  return (
    <Chip kind={kind} className={className}>
      {children}
    </Chip>
  );
}

/* --------------------------------------------------------------- Bullet */

/** A list item with a 6 px guilloche dot. */
export function Bullet({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <li className={cx('mk-bullet', className)}>
      <span aria-hidden className="mk-dot" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/* --------------------------------------------------------------- PriceCard */

export type PriceCardProps = {
  name: string;
  price: string;
  per: string;
  equivalent?: string;
  points: string[];
  cta: ReactNode;
  highlighted?: boolean;
  note?: string;
};

/** A plan as a lifted note: the price in expanded numerals, the points, the button, the small print. */
export function PriceCard({ name, price, per, equivalent, points, cta, highlighted, note }: PriceCardProps) {
  return (
    <Note as="article" lift label={name} aside={highlighted ? <Chip kind="accent">Most students</Chip> : undefined} className="mk-price">
      <div className="grid gap-1">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="numeral mk-price-num" aria-label={`${price} ${per}`}>
            {price}
          </span>
          <span className="mono text-sm text-ink-soft" aria-hidden>
            {per}
          </span>
        </div>
        {equivalent && <p className="mono text-xs text-ink-soft tabular">{equivalent}</p>}
      </div>
      <ul className="grid gap-2.5 text-sm">
        {points.map((p) => (
          <Bullet key={p}>{p}</Bullet>
        ))}
      </ul>
      <div className="grid mk-push">{cta}</div>
      {note && <p className="mono text-2xs text-ink-soft">{note}</p>}
    </Note>
  );
}

/* --------------------------------------------------------- Small helpers */

/** Heading group: eyebrow + expanded title + lede. h1 uses the hero size, h2 the section size. */
export function Heading({ eyebrow, index, title, lede, as: Tag = 'h2', className }: { eyebrow?: string; index?: string; title: ReactNode; lede?: ReactNode; as?: 'h1' | 'h2' | 'h3'; className?: string }) {
  const size = Tag === 'h1' ? 'h-hero mk-h1' : Tag === 'h2' ? 'h-section' : 'note-title';
  return (
    <header className={cx('grid gap-4', className)}>
      {eyebrow && <Eyebrow index={index}>{eyebrow}</Eyebrow>}
      <Tag className={size}>{title}</Tag>
      {lede && <p className="lede">{lede}</p>}
    </header>
  );
}

/** Body copy with a comfortable measure. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('mk-prose', className)}>{children}</div>;
}

/** A definition row: the term in mono caps on the left, plain English on the right. */
export function Row({ term, children }: { term: ReactNode; children: ReactNode }) {
  return (
    <div className="mk-row">
      <dt className="mk-row-term">{term}</dt>
      <dd className="mk-row-desc">{children}</dd>
    </div>
  );
}

/** FAQ item on an engraved rule. States switch instantly. */
export function Disclosure({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group mk-disclosure">
      <summary className="mk-disclosure-q">
        <span>{q}</span>
        <span aria-hidden className="mono text-ink-soft group-open:hidden">
          +
        </span>
        <span aria-hidden className="mono text-ink-soft hidden group-open:inline">
          −
        </span>
      </summary>
      <div className="pt-3 pb-1 text-ink-soft grid gap-3 max-w-prose">{children}</div>
    </details>
  );
}

/** Sets document.title as "Page · Trail" (or the tagline on the home page). */
export function useTitle(page?: string) {
  useEffect(() => {
    document.title = page ? `${page} · Trail` : 'Trail — Proof of origin for anything you write.';
  }, [page]);
}
