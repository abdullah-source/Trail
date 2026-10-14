import { forwardRef, useEffect, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  Bevel,
  Button as KitButton,
  ButtonLink as KitButtonLink,
  Chip,
  cx,
  DesktopPattern,
  Icon,
  IconButton,
  Info,
  MenuBar,
  Panel,
  StatTile,
  Window,
  type ButtonLinkProps as KitButtonLinkProps,
  type ButtonProps as KitButtonProps,
  type IconName,
  type MenuItem,
} from './desktop';

/* Trail design system components, built on the desktop kit (src/design/desktop).
   See web/DESIGN-desktop.md. Every marketing section is a Window; the page is a Desk. */

export { cx, Info };
/** The Web Store listing once it exists (VITE_CHROME_STORE_URL); until then the install page. */
export const CHROME_STORE_URL: string = ((import.meta as any).env?.VITE_CHROME_STORE_URL as string | undefined) || '/install';

/* ------------------------------------------------------------------ Button */

export type ButtonVariant = 'primary' | 'default' | 'quiet' | 'ghost';
const kitVariant = (v?: ButtonVariant): 'primary' | 'default' | 'quiet' => (v === 'ghost' || !v ? 'default' : v);

export type ButtonProps = Omit<KitButtonProps, 'variant'> & { variant?: ButtonVariant };

/** A bevelled face. `primary` is inverse (ink), `default` is chrome, `ghost` is kept as an alias of default. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ variant, ...rest }, ref) => <KitButton ref={ref} variant={kitVariant(variant)} {...rest} />);
Button.displayName = 'Button';

export type ButtonLinkProps = Omit<KitButtonLinkProps, 'variant' | 'linkAs'> & { variant?: ButtonVariant };

export function ButtonLink({ to, variant, external, ...rest }: ButtonLinkProps) {
  const opensTab = !!external && !to.startsWith('/');
  return <KitButtonLink to={to} variant={kitVariant(variant)} external={opensTab} linkAs={opensTab ? undefined : Link} {...rest} />;
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
    </a>
  );
}

/* ------------------------------------------------------------- Typography */

/** Mono caps label. `tick` is accepted for old callers; the desktop draws no pen stroke. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string; tick?: boolean }) {
  return <span className={cx('marginal inline-flex items-center gap-2', className)}>{children}</span>;
}

/* ------------------------------------------------------------ Wordmark */

/** The mark: a pixel l with a signed-blue caret. */
export function Mark({ size = 16, className }: { size?: number; className?: string }) {
  return <Icon name="mark" size={size >= 48 ? 48 : size >= 32 ? 32 : 16} className={className} />;
}

export function Wordmark({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link to={to} aria-label="Trail home" className={cx('inline-flex items-center gap-2 text-ink display text-base font-semibold', className)}>
      <Icon name="mark" />
      Trail
    </Link>
  );
}

/* ------------------------------------------------------------ Theme toggle */

type Pref = 'system' | 'light' | 'dark';
const THEME_KEY = 'trail.theme';

function applyTheme(pref: Pref) {
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

/** Sun/moon pixel icon. Cycles light and dark; shares its storage key with index.html's first-paint script.
 *  `menu` renders it as a 24 px menu-bar item; otherwise it is a bevelled IconButton. */
export function ThemeToggle({ className, menu }: { className?: string; menu?: boolean }) {
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
  // What is on screen right now decides what the button offers: dark → offer light, and vice versa.
  const isDark = pref === 'dark' || (pref === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
  const next: Pref = isDark ? 'light' : 'dark';
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
  const onClick = () => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
    setPref(next);
  };
  if (menu)
    return (
      <button type="button" className={cx('menubar-item', className)} aria-label={label} title={label} onClick={onClick}>
        <Icon name={isDark ? 'sun' : 'moon'} />
      </button>
    );
  return <IconButton icon={isDark ? 'sun' : 'moon'} label={label} className={className} onClick={onClick} />;
}

/* ---------------------------------------------------------------- Nav */

const LINKS = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/demo', label: 'Live demo' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/verify', label: 'Verify' },
];

/** The menu bar: 24 px of chrome along the top of every marketing page. */
export function Nav() {
  const { pathname } = useLocation();
  const here = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const items: MenuItem[] = LINKS.map((l) => ({ label: l.label, to: l.to, current: here(l.to) }));
  return (
    <header className="sticky top-0 z-40">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-8 focus:left-2 focus:z-50 inverse px-3 py-2 font-mono text-sm">
        Skip to content
      </a>
      <MenuBar
        items={items}
        linkAs={Link}
        brandTo="/"
        right={
          <>
            <ThemeToggle menu />
            <Link to="/login" className="menubar-item hide-phone" aria-current={here('/login') ? 'page' : undefined}>
              Log in
            </Link>
            <span className="inline-flex items-center px-2">
              <StoreLink className="btn btn-primary btn-sm h-5 px-2 text-xs">Get Trail</StoreLink>
            </span>
          </>
        }
      />
    </header>
  );
}

/* ------------------------------------------------------------------ Footer */

/** A small bevelled status strip at the foot of the desk. */
export function Footer() {
  const a = 'link';
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 sm:px-6 pb-8 pt-2">
      <Bevel className="on-chrome px-3 py-2 grid gap-1 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="mark" />
            2026 Trail. Built for students, not against them.
          </span>
          <nav aria-label="Footer" className="ml-auto flex flex-wrap gap-x-4 gap-y-1">
            <Link className={a} to="/how-it-works">
              How it works
            </Link>
            <Link className={a} to="/demo">
              Live demo
            </Link>
            <Link className={a} to="/pricing">
              Pricing
            </Link>
            <Link className={a} to="/verify">
              Verify a record
            </Link>
            <Link className={a} to="/privacy">
              Privacy
            </Link>
            <Link className={a} to="/terms">
              Terms
            </Link>
            <a className={a} href="mailto:hello@trail.app">
              hello@trail.app
            </a>
            <Link className={a} to="/login">
              Log in
            </Link>
            <StoreLink className={a}>Get Trail</StoreLink>
          </nav>
        </div>
        <p className="text-ink-soft">See how you write. Your record stays on your device. Our server only ever holds hashes, signatures and your email.</p>
      </Bevel>
    </footer>
  );
}

/** Fonts are self-hosted (src/design/fonts.css and src/design/desktop/fonts.css); nothing is fetched
 *  from Google. Kept as a no-op so callers need no change. */
export const FONTS_HREF = '/fonts/';
export function useFonts() {
  /* self-hosted: nothing to inject */
}

/** The desk: menu bar + <main id="main"> + status strip around an <Outlet/>. */
export function MarketingLayout() {
  useFonts();
  return (
    <DesktopPattern className="min-h-dvh flex flex-col text-ink">
      <Nav />
      <main id="main" className="flex-1 min-w-0">
        <Outlet />
      </main>
      <Footer />
    </DesktopPattern>
  );
}

/* -------------------------------------------------------------------- Desk */

export type DeskWidth = 'wide' | 'reading' | 'narrow';

/**
 * The page container: windows in a two-column grid (24 px gap) that stacks at 700 px, with an
 * optional column of desktop icons at the right edge (112 px) that becomes a three-across row
 * above the windows on phones.
 */
export function Desk({ children, icons, columns = 2, width = 'wide', className }: { children: ReactNode; icons?: ReactNode; columns?: 1 | 2; width?: DeskWidth; className?: string }) {
  const max = width === 'wide' ? 'max-w-6xl' : width === 'reading' ? 'max-w-4xl' : 'max-w-3xl';
  return (
    <div className={cx('mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 grid gap-6 items-start', max, !!icons && 'min-[701px]:grid-cols-[minmax(0,1fr)_112px]', className)}>
      <div className={cx('grid gap-6 items-start grid-cols-[minmax(0,1fr)] min-w-0', columns === 2 && 'min-[701px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]')}>{children}</div>
      {icons && (
        <nav aria-label="Shortcuts" className="grid gap-2 justify-items-center max-[700px]:order-first max-[700px]:grid-cols-3 min-[701px]:sticky min-[701px]:top-8">
          {icons}
        </nav>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- Section */

export type SectionProps = {
  /** mono text at the right of the title bar, e.g. the old margin timecode "00:12" */
  code?: ReactNode;
  /** the window title, e.g. "Replay" */
  label?: ReactNode;
  id?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** accepted for old callers; windows have no hairline between them */
  flush?: boolean;
  /** span both desk columns */
  wide?: boolean;
  /** drop the window 40 px at desktop width so the desk looks used */
  offset?: boolean;
  icon?: IconName;
  /** chrome body: a control panel rather than paper */
  chrome?: boolean;
  titleAs?: 'h1' | 'h2' | 'h3' | 'div';
  inactive?: boolean;
  /** play the 180 ms zoom-open once on mount */
  open?: boolean;
  resizable?: boolean;
};

/** A marketing section is a window: the label is its title, the timecode sits at the right of the title bar. */
export function Section({ code, label = 'Trail', id, children, className, bodyClassName, wide, offset, icon, chrome, titleAs, inactive, open, resizable }: SectionProps) {
  return (
    <Window
      as="section"
      id={id}
      title={label}
      icon={icon}
      right={code}
      titleAs={titleAs}
      chrome={chrome}
      inactive={inactive}
      open={open}
      resizable={resizable}
      className={cx(wide && 'min-[701px]:col-span-2', offset && 'min-[701px]:mt-10', className)}
      bodyClassName={bodyClassName}
    >
      {children}
    </Window>
  );
}

/* ---------------------------------------------------------------- Surfaces */

/** A raised chrome panel (16 px padding) with an optional mono-caps legend. */
export function Card({ children, className, as: Tag = 'div', legend }: { children: ReactNode; className?: string; as?: 'div' | 'article' | 'li' | 'section'; legend?: ReactNode }) {
  return (
    <Panel as={Tag} legend={legend} className={className}>
      {children}
    </Panel>
  );
}

/* ------------------------------------------------------------------- Stat */

/** A bevelled stat tile: mono caps label, display value on a paper plate, mono detail, "?" affordance. */
export function Stat({ label, value, detail, tone, className, info }: { label: string; value: ReactNode; detail?: ReactNode; tone?: 'typed' | 'paste' | 'accent'; className?: string; info?: string }) {
  return <StatTile label={label} value={value} detail={detail} tone={tone} info={info} className={className} />;
}

export type BadgeKind = 'typed' | 'pasted' | 'ai' | 'mixed' | 'unobserved' | 'neutral' | 'accent';

/** A framed mono chip on a paper plate. */
export function Badge({ kind = 'neutral', children, className }: { kind?: BadgeKind; children: ReactNode; className?: string }) {
  return (
    <Chip kind={kind} className={className}>
      {children}
    </Chip>
  );
}

/* --------------------------------------------------------------- Bullet */

/** A list item with a square pixel bullet. */
export function Bullet({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <li className={cx('flex gap-2.5', className)}>
      <span aria-hidden className="mt-[0.55em] inline-block w-1.5 h-1.5 bg-margin shrink-0" />
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

/** A plan as a control-panel group: legend, price on a paper plate, points, button, note. */
export function PriceCard({ name, price, per, equivalent, points, cta, highlighted, note }: PriceCardProps) {
  return (
    <article className="panel on-chrome grid gap-4 content-start" aria-label={`${name} plan`}>
      <div className="panel-legend flex items-center justify-between gap-3 !mb-0">
        <span>{name}</span>
        {highlighted && <Chip kind="accent">Most students</Chip>}
      </div>
      <div className="grid gap-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="stat-value">{price}</span>
          <span className="font-mono text-sm text-ink-soft">{per}</span>
        </div>
        {equivalent && <p className="font-mono text-xs text-ink-soft tabular">{equivalent}</p>}
      </div>
      <ul className="grid gap-2 text-sm">
        {points.map((p) => (
          <Bullet key={p}>{p}</Bullet>
        ))}
      </ul>
      <div className="grid">{cta}</div>
      {note && <p className="font-mono text-[11px] text-ink-soft">{note}</p>}
    </article>
  );
}

/* --------------------------------------------------------- Small helpers */

/** Heading group: eyebrow + title + lede, left aligned. Pixel display face. */
export function Heading({ eyebrow, title, lede, as: Tag = 'h2', className }: { eyebrow?: string; title: ReactNode; lede?: ReactNode; as?: 'h1' | 'h2' | 'h3'; className?: string }) {
  const size = Tag === 'h1' ? 'text-[clamp(32px,9vw,48px)]' : Tag === 'h2' ? 'text-2xl' : 'text-xl';
  return (
    <header className={cx('grid gap-3', className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Tag className={size}>{title}</Tag>
      {lede && <p className="text-lg text-ink-soft max-w-prose">{lede}</p>}
    </header>
  );
}

/** Body copy block with comfortable measure. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('grid gap-4 text-base leading-relaxed max-w-prose [&_strong]:font-semibold [&_a]:link', className)}>{children}</div>;
}

/** A definition row: term on the left in mono, plain-English description on the right. */
export function Row({ term, children }: { term: ReactNode; children: ReactNode }) {
  return (
    <div className="grid sm:grid-cols-[11rem_1fr] gap-1 sm:gap-6 py-3 border-t border-rule">
      <dt className="font-mono text-sm text-ink">{term}</dt>
      <dd className="text-ink-soft">{children}</dd>
    </div>
  );
}

/** FAQ / disclosure item. States switch instantly: no rotation, no fade. */
export function Disclosure({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group border-t border-rule py-3">
      <summary className="cursor-pointer list-none flex items-start justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
        <span>{q}</span>
        <span aria-hidden className="font-mono text-ink-soft group-open:hidden">
          +
        </span>
        <span aria-hidden className="font-mono text-ink-soft hidden group-open:inline">
          −
        </span>
      </summary>
      <div className="pt-3 text-ink-soft grid gap-3 max-w-prose">{children}</div>
    </details>
  );
}

/** Sets document.title as "Page · Trail" (or the tagline on the home page). */
export function useTitle(page?: string) {
  useEffect(() => {
    document.title = page ? `${page} · Trail` : 'Trail — See how you write.';
  }, [page]);
}
