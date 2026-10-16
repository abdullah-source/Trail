import { useEffect, useId, useState, type ReactNode } from 'react';
import { type LinkComponent } from './Button';
import { cx } from './cx';
import { Icon, Mark } from './icons';

export type NavItem = { label: string; to: string; current?: boolean };

function A({ to, linkAs: L, className, current, children, onClick }: { to: string; linkAs?: LinkComponent; className?: string; current?: boolean; children: ReactNode; onClick?: () => void }) {
  if (L && to.startsWith('/'))
    return (
      <L to={to} className={className} aria-current={current ? 'page' : undefined} onClick={onClick}>
        {children}
      </L>
    );
  return (
    <a href={to} className={className} aria-current={current ? 'page' : undefined} onClick={onClick}>
      {children}
    </a>
  );
}

/** The crop-mark logo and the name, set expanded. */
export function Wordmark({ to = '/', linkAs, className }: { to?: string; linkAs?: LinkComponent; className?: string }) {
  return (
    <A to={to} linkAs={linkAs} className={cx('nav-brand', className)}>
      <Mark size={22} />
      <span>Trail</span>
      <span className="sr-only"> home</span>
    </A>
  );
}

type Pref = 'system' | 'light' | 'dark';
const THEME_KEY = 'trail.theme';
const sysDark = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
function applyTheme(pref: Pref) {
  const dark = pref === 'dark' || (pref === 'system' && sysDark());
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

/** Daylight / night vault. Same storage key and first-paint contract as before ('trail.theme'). */
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
  const isDark = pref === 'dark' || (pref === 'system' && sysDark());
  const label = isDark ? 'Switch to daylight' : 'Switch to night vault';
  return (
    <button
      type="button"
      className={cx('btn btn-quiet btn-sm btn-icon', className)}
      aria-label={label}
      title={label}
      onClick={() => {
        const next: Pref = isDark ? 'light' : 'dark';
        try {
          localStorage.setItem(THEME_KEY, next);
        } catch {
          /* private mode: the choice lasts for this page only */
        }
        setPref(next);
      }}
    >
      <Icon name={isDark ? 'sun' : 'moon'} size={18} />
    </button>
  );
}

export type NavProps = {
  items: NavItem[];
  /** react-router's Link */
  linkAs?: LinkComponent;
  brandTo?: string;
  /** the right side: ThemeToggle, Log in, the primary pill */
  right?: ReactNode;
  label?: string;
  className?: string;
};

/** The frosted bar: crop-mark logo, links as quiet pills, a menu sheet under 860 px. */
export function Nav({ items, linkAs, brandTo = '/', right, label = 'Main', className }: NavProps) {
  const [open, setOpen] = useState(false);
  const sheet = useId();
  return (
    <header className={cx('nav', className)}>
      <div className="doc-container nav-row">
        <Wordmark to={brandTo} linkAs={linkAs} />
        <nav aria-label={label} className="nav-links">
          {items.map((i) => (
            <A key={i.to} to={i.to} linkAs={linkAs} current={i.current} className="nav-link">
              {i.label}
            </A>
          ))}
        </nav>
        <div className="nav-right">
          {right}
          <button type="button" className="btn btn-quiet btn-sm btn-icon nav-toggle" aria-expanded={open} aria-controls={sheet} aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((o) => !o)}>
            <Icon name={open ? 'close' : 'menu'} size={18} />
          </button>
        </div>
      </div>
      <nav id={sheet} aria-label={`${label} (menu)`} className="doc-container nav-sheet" hidden={!open}>
        {items.map((i) => (
          <A key={i.to} to={i.to} linkAs={linkAs} current={i.current} className="nav-link" onClick={() => setOpen(false)}>
            {i.label}
          </A>
        ))}
      </nav>
    </header>
  );
}
