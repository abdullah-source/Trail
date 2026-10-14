// The app pages' component surface, built on the desktop kit (src/design/desktop; DESIGN-desktop.md
// §10 and §11). Pages import from here rather than from the kit so react-router's Link is wired in
// once, and the few app-only pieces (Marginal, Sheet, Rule, SectionHead, EmptyState, ErrorNote,
// Loading, Skeleton, Field, Caption, StatGrid) live next to the re-exports.
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bevel, Button as KitButton, ButtonLink as KitButtonLink, Dialog, cx, type ButtonLinkProps as KitButtonLinkProps, type ButtonProps as KitButtonProps, type ButtonVariant, type IconName } from '../design/desktop';

export { cx };
export { Bevel, Panel, Window, TitleBar, MenuBar, IconButton, Dialog, Checkbox, Radio, TextField, ProgressBar, ScrollArea, StatTile, Info, Chip, Swatch, DesktopPattern, DesktopIcon, Icon } from '../design/desktop';
export type { ButtonVariant, ButtonSize, IconName, MenuItem, ChipKind } from '../design/desktop';

/* ------------------------------------------------------------------ buttons */

/** 'secondary' and 'ghost' were the manuscript system's names for the plain bevelled button; they map to
 *  'default' so a caller that has not moved yet still compiles. New code uses default | primary | quiet. */
type LegacyVariant = ButtonVariant | 'secondary' | 'ghost';
const variantOf = (v: LegacyVariant | undefined): ButtonVariant => (v === 'secondary' || v === 'ghost' || v === undefined ? 'default' : v);

export type ButtonProps = Omit<KitButtonProps, 'variant'> & { variant?: LegacyVariant };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ variant, ...rest }, ref) => <KitButton ref={ref} variant={variantOf(variant)} {...rest} />);
Button.displayName = 'Button';

export type ButtonLinkProps = Omit<KitButtonLinkProps, 'linkAs' | 'variant'> & { variant?: LegacyVariant };

/** Router-aware ButtonLink. `external` opens a new tab unless the target is a site path (the store link
 *  falls back to /install until the Web Store listing exists). */
export function ButtonLink({ to, external, variant, ...rest }: ButtonLinkProps) {
  const ext = Boolean(external && !to.startsWith('/'));
  return <KitButtonLink to={to} external={ext} linkAs={Link} variant={variantOf(variant)} {...rest} />;
}

/* --------------------------------------------------------------------- text */

/** Mono caps label: a panel legend, a section name inside a window, a table head. */
export function Marginal({ children, className, as: Tag = 'span' }: { children: ReactNode; className?: string; as?: 'span' | 'div' | 'h2' | 'h3' | 'dt' }) {
  return <Tag className={cx('marginal', className)}>{children}</Tag>;
}

/** One line of mono 12 px explanation under a chart or table. Pass role="status" for a result line. */
export function Caption({ children, className, ...rest }: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode; className?: string }) {
  return (
    <p className={cx('font-mono text-xs text-ink-soft', className)} {...rest}>
      {children}
    </p>
  );
}

/** A sheet of paper set into a window or a panel: a sunken well with a paper face. */
export function Sheet({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' }) {
  return (
    <Bevel sunken as={as} className={cx('bg-sheet', className)}>
      {children}
    </Bevel>
  );
}

/** The dithered hairline between groups, like a menu separator. */
export function Rule({ className }: { className?: string }) {
  return <hr className={cx('hr-dither', className)} />;
}

/** Stat tiles reflow at 128 px (DESIGN-desktop.md §8). */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('grid gap-2', className)} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))' }}>
      {children}
    </div>
  );
}

/**
 * A heading block inside a window body. Where a page is one window its name belongs in the title bar,
 * so this is for a sub-section: kicker as mono caps, a 24 px display title, one lede.
 */
export function SectionHead({ kicker, title, lede, className, as: Tag = 'h2' }: { kicker?: string; title: ReactNode; lede?: ReactNode; className?: string; as?: 'h1' | 'h2' | 'h3' }) {
  return (
    <header className={cx('grid gap-2 max-w-2xl', className)}>
      {kicker && <Marginal>{kicker}</Marginal>}
      <Tag className="text-xl">{title}</Tag>
      {lede && <p className="text-sm text-ink-soft max-w-prose">{lede}</p>}
    </header>
  );
}

/* ------------------------------------------------------------------- states */

/** The caret, blinking, with one line of text on a label plate so it reads on the desk too. */
export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="py-10">
      <span className="label-plate inline-flex items-center gap-2 px-2">
        <span className="caret" aria-hidden />
        <span>{label}…</span>
      </span>
    </div>
  );
}

/** A sunken, empty well where a value will appear. Nothing shimmers (DESIGN-desktop.md §9). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('bevel-in', className)} />;
}

/** An empty page is a dialog with an icon, one or two sentences, and the one thing to do next. */
export function EmptyState({ title, body, action, icon = 'document', className }: { title: string; body: ReactNode; action?: ReactNode; icon?: IconName; className?: string }) {
  return (
    <Dialog title={title} icon={icon} actions={action} className={cx('max-w-xl win-open', className)}>
      <div className="grid gap-2 text-sm text-ink-soft">{body}</div>
    </Dialog>
  );
}

/** An error is a dialog (DESIGN-desktop.md §9): the warning icon filled amber, the message in mono. */
export function ErrorNote({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <Dialog
      role="alertdialog"
      title="Something did not load."
      icon="warning"
      iconFill={{ w: 'var(--paste)' }}
      className="max-w-xl win-open"
      actions={
        retry && (
          <Button ring onClick={retry}>
            Try again
          </Button>
        )
      }
    >
      <p className="font-mono text-xs text-ink-soft break-words">{error.message}</p>
    </Dialog>
  );
}

/* -------------------------------------------------------------------- forms */

/** Label above, control, hint below. TextField from the kit covers the common case; this wraps anything else. */
export function Field({ label, hint, children, id }: { label: string; hint?: string; children: ReactNode; id: string }) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

/** The sunken 32 px field, for a raw <input> or <select>. */
export const inputCls = 'field';
