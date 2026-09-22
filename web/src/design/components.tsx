import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

/* Longhand design system components. See web/DESIGN.md. */

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');
export const CHROME_STORE_URL = 'https://chromewebstore.google.com/';

/* ------------------------------------------------------------------ Button */

type Variant = 'primary' | 'ghost';
type Size = 'md' | 'lg';
const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-md font-sans font-semibold leading-none whitespace-nowrap select-none transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed';
const btnVariant: Record<Variant, string> = {
  primary: 'bg-ink text-paper hover:bg-accent hover:text-accent-ink',
  ghost: 'border border-rule-strong text-ink hover:border-ink hover:bg-well',
};
const btnSize: Record<Size, string> = { md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' };

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ variant = 'primary', size = 'md', className, type = 'button', ...rest }, ref) => (
  <button ref={ref} type={type} className={cx(btnBase, btnVariant[variant], btnSize[size], className)} {...rest} />
));
Button.displayName = 'Button';

export type ButtonLinkProps = { to: string; variant?: Variant; size?: Size; className?: string; children: ReactNode; external?: boolean };

export function ButtonLink({ to, variant = 'primary', size = 'md', className, children, external }: ButtonLinkProps) {
  const cls = cx(btnBase, btnVariant[variant], btnSize[size], className);
  if (external)
    return (
      <a href={to} className={cls} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  return (
    <Link to={to} className={cls}>
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------- Typography */

/** Mono caps label. `tick` draws the short pen-stroke before it. */
export function Eyebrow({ children, className, tick = true }: { children: ReactNode; className?: string; tick?: boolean }) {
  return (
    <span className={cx('marginal inline-flex items-center gap-2', className)}>
      {tick && <span aria-hidden className="inline-block w-4 h-px bg-margin" />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------ Wordmark */

/** The mark: a cursive l and a text caret. Inherits currentColor. */
export function Mark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={className}>
      <path d="M17 47c2-12 8-32 14-35 5-2 4 9 0 19-3 8-7 15-3 17 3 1 8-3 12-7" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="45" y="27" width="3.5" height="21" rx="1" fill="var(--accent)" />
    </svg>
  );
}

export function Wordmark({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link to={to} aria-label="Longhand home" className={cx('inline-flex items-center gap-2 text-ink', className)}>
      <Mark size={22} />
      <span className="display text-[22px] leading-none">Longhand</span>
    </Link>
  );
}

/* ------------------------------------------------------------ Theme toggle */

type Pref = 'system' | 'light' | 'dark';
const THEME_KEY = 'longhand.theme';

function applyTheme(pref: Pref) {
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

/** Cycles system → light → dark. Shares its storage key with index.html's first-paint script. */
export function ThemeToggle({ className }: { className?: string }) {
  const [pref, setPref] = useState<Pref>(() => {
    try {
      const v = localStorage.getItem(THEME_KEY);
      return v === 'light' || v === 'dark' ? v : 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    applyTheme(pref);
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => pref === 'system' && applyTheme(pref);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [pref]);
  const next: Record<Pref, Pref> = { system: 'light', light: 'dark', dark: 'system' };
  const label: Record<Pref, string> = { system: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' };
  return (
    <button
      type="button"
      className={cx('h-9 px-2.5 rounded-md border border-rule text-xs font-mono text-ink-soft hover:text-ink hover:border-rule-strong', className)}
      aria-label={`${label[pref]}. Switch to ${next[pref]}`}
      title={label[pref]}
      onClick={() => {
        const p = next[pref];
        try {
          localStorage.setItem(THEME_KEY, p);
        } catch {
          /* ignore */
        }
        setPref(p);
      }}
    >
      {pref === 'system' ? 'auto' : pref}
    </button>
  );
}

/* ---------------------------------------------------------------- Nav */

const LINKS = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/verify', label: 'Verify a record' },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const link = ({ isActive }: { isActive: boolean }) => cx('text-sm py-1', isActive ? 'text-ink underline underline-offset-[6px] decoration-margin' : 'text-ink-soft hover:text-ink');
  return (
    <header className="border-b border-rule bg-paper/95 backdrop-blur-sm sticky top-0 z-40">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-ink text-paper px-3 py-2 rounded-md z-50">
        Skip to content
      </a>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center gap-6">
        <Wordmark />
        <nav className="hidden md:flex items-center gap-6 ml-4" aria-label="Site">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={link}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto hidden md:flex items-center gap-3">
          <ThemeToggle />
          <NavLink to="/login" className="text-sm text-ink-soft hover:text-ink">
            Log in
          </NavLink>
          <ButtonLink to={CHROME_STORE_URL} external>
            Add to Chrome
          </ButtonLink>
        </div>
        <button
          type="button"
          className="ml-auto md:hidden h-9 px-3 rounded-md border border-rule text-sm"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" className="md:hidden border-t border-rule px-4 py-4 grid gap-2" aria-label="Site">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)} className="py-2 text-base">
              {l.label}
            </NavLink>
          ))}
          <NavLink to="/login" onClick={() => setOpen(false)} className="py-2 text-base">
            Log in
          </NavLink>
          <div className="flex items-center justify-between pt-3 border-t border-rule">
            <ThemeToggle />
            <ButtonLink to={CHROME_STORE_URL} external>
              Add to Chrome
            </ButtonLink>
          </div>
        </nav>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ Footer */

export function Footer() {
  const col = 'grid gap-2 content-start text-sm';
  const a = 'link text-ink-soft hover:text-ink';
  return (
    <footer className="border-t border-rule mt-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-5 grid gap-3 content-start">
          <Wordmark />
          <p className="text-sm text-ink-soft max-w-xs">See how you write. Your record stays on your device. Our server only ever holds hashes, signatures and your email.</p>
        </div>
        <nav className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-6" aria-label="Footer">
          <div className={col}>
            <Eyebrow tick={false}>Product</Eyebrow>
            <Link className={a} to="/how-it-works">How it works</Link>
            <Link className={a} to="/pricing">Pricing</Link>
            <Link className={a} to="/verify">Verify a record</Link>
          </div>
          <div className={col}>
            <Eyebrow tick={false}>Trust</Eyebrow>
            <Link className={a} to="/privacy">Privacy</Link>
            <Link className={a} to="/terms">Terms</Link>
            <a className={a} href="mailto:hello@longhand.app">hello@longhand.app</a>
          </div>
          <div className={col}>
            <Eyebrow tick={false}>Account</Eyebrow>
            <Link className={a} to="/login">Log in</Link>
            <a className={a} href={CHROME_STORE_URL} target="_blank" rel="noreferrer">Add to Chrome</a>
          </div>
        </nav>
        <p className="md:col-span-12 font-mono text-xs text-ink-soft">2026 Longhand. Built for students, not against them.</p>
      </div>
    </footer>
  );
}

/** Fonts are self-hosted (src/design/fonts.css, files under public/fonts); nothing is fetched from
 *  Google. Kept as a no-op so callers need no change. */
export const FONTS_HREF = '/fonts/';
export function useFonts() {
  /* self-hosted: nothing to inject */
}

/** Nav + <main id="main"> + Footer around an <Outlet/>. Engineering mounts marketing routes inside this. */
export function MarketingLayout() {
  useFonts();
  return (
    <div className="min-h-dvh flex flex-col bg-paper text-ink">
      <Nav />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

/* ----------------------------------------------------------------- Section */

export type SectionProps = {
  /** timecode shown in the margin, e.g. "00:12" */
  code?: string;
  /** short label under the timecode, e.g. "Replay" */
  label?: string;
  id?: string;
  children: ReactNode;
  className?: string;
  /** remove the top hairline (first section on a page) */
  flush?: boolean;
  /** widen content to the full column, e.g. for the hero */
  wide?: boolean;
};

/**
 * The page grid: a notebook margin on the left (timecode + label, red margin
 * rule on md+) and the content column to its right. Nothing is centered.
 */
export function Section({ code, label, id, children, className, flush, wide }: SectionProps) {
  return (
    <section id={id} className={cx(!flush && 'border-t border-rule', className)}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 md:grid md:grid-cols-[6.5rem_1fr] lg:grid-cols-[8rem_1fr]">
        <div className="md:border-r md:border-margin/40 pt-8 md:pt-14 md:pr-4 md:pb-14">
          <div className="flex md:flex-col items-baseline md:items-start gap-x-3 gap-y-1 md:sticky md:top-20">
            {code && <span className="font-mono text-sm text-ink tabular">{code}</span>}
            {label && <span className="marginal">{label}</span>}
          </div>
        </div>
        <div className={cx('pt-6 pb-14 md:pt-14 md:pl-10 lg:pl-14', !wide && 'max-w-3xl')}>{children}</div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Surfaces */

export function Card({ children, className, as: Tag = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'article' | 'li' }) {
  return <Tag className={cx('bg-sheet border border-rule rounded-lg p-5 sm:p-6', className)}>{children}</Tag>;
}

export function Stat({ label, value, detail, tone, className }: { label: string; value: ReactNode; detail?: ReactNode; tone?: 'typed' | 'paste' | 'accent'; className?: string }) {
  return (
    <div className={cx('border-t border-rule-strong pt-3', className)}>
      <span className="marginal">{label}</span>
      <div className={cx('display text-3xl leading-none mt-2 tabular', tone === 'typed' && 'text-typed', tone === 'paste' && 'text-paste', tone === 'accent' && 'text-accent')}>{value}</div>
      {detail && <div className="text-sm text-ink-soft mt-1.5">{detail}</div>}
    </div>
  );
}

export type BadgeKind = 'typed' | 'pasted' | 'ai' | 'mixed' | 'unobserved' | 'neutral' | 'accent';
const badgeTone: Record<BadgeKind, string> = {
  typed: 'text-typed border-typed/50',
  pasted: 'text-paste border-paste/50',
  ai: 'text-paste border-paste/50 bg-paste/10',
  mixed: 'text-mixed border-mixed/50',
  unobserved: 'text-unobserved border-unobserved/50',
  neutral: 'text-ink-soft border-rule-strong',
  accent: 'text-accent border-accent/50',
};

export function Badge({ kind = 'neutral', children, className }: { kind?: BadgeKind; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-sm border px-1.5 py-px font-mono text-[11px] leading-4 whitespace-nowrap', badgeTone[kind], className)}>{children}</span>;
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

export function PriceCard({ name, price, per, equivalent, points, cta, highlighted, note }: PriceCardProps) {
  return (
    <article className={cx('bg-sheet rounded-lg p-6 grid gap-5 content-start border', highlighted ? 'border-ink' : 'border-rule')} aria-label={`${name} plan`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xl">{name}</h3>
        {highlighted && <Badge kind="accent">Most students</Badge>}
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="display text-4xl leading-none tabular">{price}</span>
          <span className="text-ink-soft">{per}</span>
        </div>
        {equivalent && <p className="text-sm text-ink-soft mt-1.5 tabular">{equivalent}</p>}
      </div>
      <ul className="grid gap-2 text-sm">
        {points.map((p) => (
          <li key={p} className="flex gap-2.5">
            <span aria-hidden className="mt-[0.6em] inline-block w-3 h-px bg-margin shrink-0" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <div className="pt-1">{cta}</div>
      {note && <p className="font-mono text-[11px] text-ink-soft">{note}</p>}
    </article>
  );
}

/* --------------------------------------------------------- Small helpers */

/** Heading group: eyebrow + h2 + lede, left aligned. */
export function Heading({ eyebrow, title, lede, as: Tag = 'h2', className }: { eyebrow?: string; title: ReactNode; lede?: ReactNode; as?: 'h1' | 'h2' | 'h3'; className?: string }) {
  return (
    <header className={cx('grid gap-3', className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Tag className={Tag === 'h1' ? 'text-4xl sm:text-5xl' : Tag === 'h2' ? 'text-3xl sm:text-4xl' : 'text-xl'}>{title}</Tag>
      {lede && <p className="text-lg text-ink-soft max-w-prose">{lede}</p>}
    </header>
  );
}

/** Body copy block with comfortable measure. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('grid gap-4 text-base sm:text-[17px] leading-relaxed max-w-prose [&_strong]:font-semibold [&_a]:link', className)}>{children}</div>;
}

/** A definition row: term on the left, plain-English description on the right. */
export function Row({ term, children }: { term: ReactNode; children: ReactNode }) {
  return (
    <div className="grid sm:grid-cols-[11rem_1fr] gap-1 sm:gap-6 py-4 border-t border-rule">
      <dt className="font-mono text-sm text-ink">{term}</dt>
      <dd className="text-ink-soft">{children}</dd>
    </div>
  );
}

/** FAQ / disclosure item. */
export function Disclosure({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group border-t border-rule py-4">
      <summary className="cursor-pointer list-none flex items-start justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
        <span>{q}</span>
        <span aria-hidden className="font-mono text-ink-soft group-open:rotate-45 transition-transform">+</span>
      </summary>
      <div className="pt-3 text-ink-soft grid gap-3 max-w-prose">{children}</div>
    </details>
  );
}

/** Sets document.title as "Page · Longhand" (or the tagline on the home page). */
export function useTitle(page?: string) {
  useEffect(() => {
    document.title = page ? `${page} · Longhand` : 'Longhand — See how you write.';
  }, [page]);
}
