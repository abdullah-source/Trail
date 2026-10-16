// The app pages' component surface, built on the security-document kit (src/design/document;
// DESIGN-document.md §5 and §13 step 2). Pages import from here rather than from the kit so
// react-router's Link is wired in once, and the few app-only pieces (Marginal, Sheet, Rule,
// SectionHead, EmptyState, ErrorNote, Loading, Skeleton, Field, Caption, StatGrid, ProgressBar,
// ScrollArea, Modal) live next to the re-exports.
import { useEffect, useId, useRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Button as DocButton, ButtonLink as DocButtonLink, Eyebrow, Icon, Note, cx, type ButtonLinkProps as DocButtonLinkProps, type IconName, type LinkComponent } from '../design/document';

/** react-router's Link, typed for the kit's `linkAs` (its `to` also takes objects, which the kit never passes). */
export const RouterLink = Link as unknown as LinkComponent;

export {
  cx,
  Info,
  Chip,
  Swatch,
  Checkbox,
  Radio,
  TextField,
  TextArea,
  Stat,
  StatTile,
  Icon,
  IconButton,
  Note,
  Certificate,
  Serial,
  serialOf,
  Seal,
  Guilloche,
  Microprint,
  ProvenancePath,
  Ticker,
  Reveal,
  Eyebrow,
  ThemeToggle,
  buttonClass,
} from '../design/document';
export type { IconName, ChipKind, ButtonVariant, ButtonSize, ButtonProps, ProvenanceNode, SealState } from '../design/document';

/* ------------------------------------------------------------------ buttons */

/** The pill. `variant` takes primary | secondary | quiet | danger, and the older default | ghost. */
export const Button = DocButton;

export type ButtonLinkProps = Omit<DocButtonLinkProps, 'linkAs'>;

/** Router-aware ButtonLink. `external` opens a new tab unless the target is a site path (the store link
 *  falls back to /install until the Web Store listing exists). */
export function ButtonLink({ to, external, ...rest }: ButtonLinkProps) {
  const ext = Boolean(external && !to.startsWith('/'));
  return <DocButtonLink to={to} external={ext} linkAs={RouterLink} {...rest} />;
}

/* --------------------------------------------------------------------- text */

/** Mono caps label: a note legend, a table head, a definition term. */
export function Marginal({ children, className, as: Tag = 'span' }: { children: ReactNode; className?: string; as?: 'span' | 'div' | 'h2' | 'h3' | 'dt' }) {
  return <Tag className={cx('marginal', className)}>{children}</Tag>;
}

/** One line of mono 12 px explanation under a chart or table. Pass role="status" for a result line. */
export function Caption({ children, className, ...rest }: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode; className?: string }) {
  return (
    <p className={cx('font-mono text-xs leading-relaxed text-ink-soft', className)} {...rest}>
      {children}
    </p>
  );
}

/** A plain sheet: a note without crop marks or watermark, for content set inside another note. */
export function Sheet({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' }) {
  return (
    <Note as={as} crop={false} watermark={false} className={className}>
      {children}
    </Note>
  );
}

/** The engraved double hairline between groups. */
export function Rule({ className }: { className?: string }) {
  return <hr className={cx('rule-engraved', className)} />;
}

/** Stat tiles in a reflowing grid. `compact` sets the numerals smaller for word-like values ("8–11pm"). */
export function StatGrid({ children, className, min = 180, compact }: { children: ReactNode; className?: string; min?: number; compact?: boolean }) {
  return (
    <div className={cx('grid gap-4', compact && '[&_.stat-value]:text-[clamp(1.75rem,3vw,2.5rem)]', className)} style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))` }}>
      {children}
    </div>
  );
}

/**
 * A page or sub-section head: Eyebrow (index in guilloche green, a rule, a few words), the expanded
 * display title (.h-section for a page h1/h2, the note title size for h3), and one lede.
 */
export function SectionHead({ kicker, index, title, lede, aside, className, as: Tag = 'h2' }: { kicker?: ReactNode; index?: string; title: ReactNode; lede?: ReactNode; aside?: ReactNode; className?: string; as?: 'h1' | 'h2' | 'h3' }) {
  return (
    <header className={cx('flex flex-wrap items-end justify-between gap-x-8 gap-y-4', className)}>
      <div className="grid gap-3 max-w-3xl min-w-0">
        {kicker != null && <Eyebrow index={index}>{kicker}</Eyebrow>}
        <Tag className={Tag === 'h3' ? 'note-title' : 'h-section'}>{title}</Tag>
        {lede != null && <p className={Tag === 'h3' ? 'text-sm text-ink-soft max-w-prose' : 'lede'}>{lede}</p>}
      </div>
      {aside != null && <div className="flex flex-wrap items-center gap-3">{aside}</div>}
    </header>
  );
}

/* ------------------------------------------------------------------- states */

/** The signed-blue caret, blinking, and one line of mono text. */
export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="py-12">
      <span className="inline-flex items-center gap-3 font-mono text-xs uppercase tracking-[0.14em] text-ink-soft">
        <span className="caret" aria-hidden />
        <span>{label}…</span>
      </span>
    </div>
  );
}

/** A sunken, empty well where a value will appear. Nothing shimmers. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={cx('bg-well rounded-sm', className)} style={style} />;
}

/** An empty page is one note: an icon, one or two sentences, and the one thing to do next. */
export function EmptyState({ title, body, action, icon = 'document', label, className }: { title: string; body: ReactNode; action?: ReactNode; icon?: IconName; label?: ReactNode; className?: string }) {
  return (
    <Note
      as="section"
      label={
        label ?? (
          <span className="inline-flex items-center gap-2">
            <Icon name={icon} size={16} /> Nothing here yet
          </span>
        )
      }
      className={cx('max-w-2xl', className)}
    >
      <h1 className="note-title">{title}</h1>
      <div className="grid gap-3 text-sm text-ink-soft max-w-prose">{body}</div>
      {action && <div className="flex flex-wrap items-center gap-3">{action}</div>}
    </Note>
  );
}

/** An error is a note with the seal-red edge: the warning icon, the message in mono, and a retry. */
export function ErrorNote({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div role="alert" className="max-w-2xl">
      <Note
        tone="seal"
        label={
          <span className="inline-flex items-center gap-2 text-seal">
            <Icon name="warning" size={16} /> Error
          </span>
        }
        title="Something did not load."
      >
        <p className="font-mono text-xs text-ink-soft break-words">{error.message}</p>
        {retry && (
          <div>
            <Button ring onClick={retry}>
              Try again
            </Button>
          </div>
        )}
      </Note>
    </div>
  );
}

/* ----------------------------------------------------------------- controls */

/** A 6 px pill track (`.progress`), typed green by default. `label` names it for screen readers. */
export function ProgressBar({ value, tone = 'typed', label, className, style }: { value: number; tone?: 'typed' | 'paste' | 'ink' | 'signed'; label?: string; className?: string; style?: CSSProperties }) {
  const p = Math.max(0, Math.min(1, value || 0));
  return (
    <span
      className={cx('progress flex-1 min-w-[48px]', tone !== 'signed' && `progress-${tone}`, className)}
      style={{ ['--p' as string]: p, ...style }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="progress-fill" />
    </span>
  );
}

/** A scrolling region for a table: keyboard-focusable, named, thin scrollbar. */
export function ScrollArea({ children, label, maxHeight, className }: { children: ReactNode; label: string; maxHeight?: number | string; className?: string }) {
  return (
    <div className={cx('scroll', className)} role="region" aria-label={label} tabIndex={0} style={maxHeight != null ? { maxHeight } : undefined}>
      {children}
    </div>
  );
}

/** Table cell classes shared by every ledger in the app. */
export const TH = 'marginal font-normal text-left px-3 py-2 whitespace-nowrap border-b border-rule';
export const TD = 'px-3 py-2.5 whitespace-nowrap align-middle';
export const TABLE = 'w-full font-mono text-xs tabular border-collapse';

/**
 * A modal note: blurred paper behind, a note on top (no crop marks), Escape and the backdrop close it,
 * focus moves in, Tab stays inside, and focus returns to the opener. `role="alertdialog"` for anything irreversible.
 */
export function Modal({ title, label, onClose, children, actions, role = 'dialog', width = 560, tone }: { title: ReactNode; label?: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode; role?: 'dialog' | 'alertdialog'; width?: number; tone?: 'seal' }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const el = box.current;
    const first = el?.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), [data-autofocus], button:not([disabled])');
    (first ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key === 'Tab' && el) {
        const f = Array.from(el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
        if (!f.length) return;
        const a = f[0];
        const z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, []);
  // portalled to <body> so no page transform or stacking context (Reveal, sticky nav) can trap it
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} role={role} aria-modal="true" aria-labelledby={id} tabIndex={-1} className="w-full outline-none" style={{ maxWidth: width }}>
        <Note crop={false} watermark={false} tone={tone} label={label} title={<span id={id}>{title}</span>} titleAs="h2" className="max-h-[calc(100dvh-32px)] overflow-y-auto">
          {children}
          {actions && <div className="flex flex-wrap items-center justify-end gap-3 pt-2">{actions}</div>}
        </Note>
      </div>
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------------- forms */

/** Label above, control, hint below. TextField from the kit covers the common case; this wraps anything else. */
export function Field({ label, hint, children, id }: { label: string; hint?: string; children: ReactNode; id: string }) {
  return (
    <div className="field-wrap">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

/** The 44 px field, for a raw <input> or <select>. */
export const inputCls = 'field';
