import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Info } from '../design/components';
export { Info };

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');
export { cx };

type Variant = 'primary' | 'secondary' | 'quiet';
const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-sans font-semibold text-sm leading-none whitespace-nowrap transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed';
const variants: Record<Variant, string> = {
  primary: 'bg-ink text-paper hover:bg-ink/85 px-4 h-10',
  secondary: 'border border-rule-strong text-ink hover:border-ink hover:bg-sheet px-4 h-10',
  quiet: 'text-ink-soft hover:text-ink px-2 h-9',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'lg' }>(
  ({ variant = 'primary', size = 'md', className, ...rest }, ref) => (
    <button ref={ref} className={cx(base, variants[variant], size === 'lg' && 'h-12 px-6 text-base', className)} {...rest} />
  ),
);
Button.displayName = 'Button';

export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  className,
  children,
  external,
}: {
  to: string;
  variant?: Variant;
  size?: 'md' | 'lg';
  className?: string;
  children: ReactNode;
  external?: boolean;
}) {
  const cls = cx(base, variants[variant], size === 'lg' && 'h-12 px-6 text-base', className);
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

/** Small mono caps label, the "pencil note in the margin". */
export function Marginal({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('marginal', className)}>{children}</span>;
}

/** A paper card. */
export function Sheet({ children, className, as: Tag = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' }) {
  return <Tag className={cx('bg-sheet border border-rule rounded-lg shadow-sheet', className)}>{children}</Tag>;
}

export function Rule({ className }: { className?: string }) {
  return <hr className={cx('border-0 border-t border-rule', className)} />;
}

const kindColour: Record<string, string> = {
  typed: 'text-typed border-typed/40',
  ai: 'text-paste border-paste/50',
  paste: 'text-paste border-paste/50',
  pasted: 'text-paste border-paste/50',
  'pasted-edited': 'text-paste border-paste/50',
  web: 'text-ink-soft border-rule-strong',
  self: 'text-ink-soft border-rule-strong',
  internal: 'text-ink-soft border-rule-strong',
  search: 'text-ink-soft border-rule-strong',
  unknown: 'text-ink-soft border-rule-strong',
  mixed: 'text-mixed border-mixed/50',
  unobserved: 'text-unobserved border-unobserved/50',
};

export function Chip({ kind = 'unknown', children, className }: { kind?: string; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-sm border px-1.5 py-px font-mono text-[11px] leading-4 whitespace-nowrap', kindColour[kind] || kindColour.unknown, className)}>
      {children}
    </span>
  );
}

export function Swatch({ kind, className }: { kind: 'typed' | 'paste' | 'mixed' | 'unobserved'; className?: string }) {
  const bg = { typed: 'bg-typed', paste: 'bg-paste', mixed: 'bg-mixed', unobserved: 'bg-unobserved' }[kind];
  return <i aria-hidden className={cx('inline-block w-2.5 h-2.5 rounded-[2px] align-middle', bg, className)} />;
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 text-ink-soft text-sm py-10" aria-live="polite">
      <span className="caret !bg-ink-soft" aria-hidden />
      <span>{label}…</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('bg-rule/60 rounded animate-pulse motion-reduce:animate-none', className)} />;
}

export function EmptyState({ title, body, action, glyph = '¶' }: { title: string; body: ReactNode; action?: ReactNode; glyph?: string }) {
  return (
    <div className="border border-dashed border-rule-strong rounded-lg px-6 py-12 sm:px-10 grid gap-3 max-w-xl">
      <span className="display text-4xl text-ink-faint leading-none" aria-hidden>
        {glyph}
      </span>
      <h3 className="text-xl">{title}</h3>
      <div className="text-ink-soft">{body}</div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export function ErrorNote({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div role="alert" className="border border-paste/50 bg-paste/5 rounded-lg px-4 py-3 text-sm max-w-xl">
      <p className="font-semibold">Something did not load.</p>
      <p className="text-ink-soft font-mono text-xs mt-1 break-words">{error.message}</p>
      {retry && (
        <Button variant="secondary" className="mt-3" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Left-aligned heading with an optional marginal above it. */
export function SectionHead({ kicker, title, lede, className }: { kicker?: string; title: ReactNode; lede?: ReactNode; className?: string }) {
  return (
    <header className={cx('grid gap-3 max-w-2xl', className)}>
      {kicker && <Marginal>{kicker}</Marginal>}
      <h2 className="text-3xl sm:text-4xl">{title}</h2>
      {lede && <p className="text-lg text-ink-soft max-w-prose">{lede}</p>}
    </header>
  );
}

export function StatTile({ label, value, detail, tone, info }: { label: string; value: ReactNode; detail?: ReactNode; tone?: 'typed' | 'paste'; info?: string }) {
  return (
    <div className="border-t border-rule pt-3">
      <Marginal className="inline-flex items-center gap-1.5">
        {label}
        {info && <Info text={info} />}
      </Marginal>
      <div className={cx('display text-3xl leading-none mt-2 tabular', tone === 'typed' && 'text-typed', tone === 'paste' && 'text-paste')}>{value}</div>
      {detail && <div className="text-sm text-ink-soft mt-1">{detail}</div>}
    </div>
  );
}

export function Field({ label, hint, children, id }: { label: string; hint?: string; children: ReactNode; id: string }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

export const inputCls = 'h-10 w-full rounded-md border border-rule-strong bg-sheet px-3 text-base placeholder:text-ink-faint focus:border-accent';
