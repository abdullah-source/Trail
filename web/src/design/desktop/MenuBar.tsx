/* MenuBar: replaces the margin rail in the app and the nav on marketing pages. */
import { useEffect, useId, useState, type ElementType, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import { cx } from './cx';

export type MenuItem = {
  label: ReactNode;
  /** Route or href. Rendered through `linkAs` (e.g. react-router's Link) or a plain <a>. */
  to?: string;
  onSelect?: () => void;
  current?: boolean;
  disabled?: boolean;
  icon?: IconName;
};

export type MenuBarProps = {
  items: MenuItem[];
  /** Left slot. Defaults to the Trail mark and wordmark. */
  brand?: ReactNode;
  brandTo?: string;
  /** Right slot: clock, theme toggle, account. Stays visible on phones. */
  right?: ReactNode;
  /** Component that takes `to`, e.g. react-router-dom's Link. Plain anchors otherwise. */
  linkAs?: ElementType;
  label?: string;
  className?: string;
};

function Item({ item, linkAs, onPick }: { item: MenuItem; linkAs?: ElementType; onPick?: () => void }) {
  const inner = (
    <>
      {item.icon && <Icon name={item.icon} />}
      {item.label}
    </>
  );
  const common = { className: 'menubar-item', 'aria-current': item.current ? ('page' as const) : undefined, 'aria-disabled': item.disabled || undefined };
  if (item.to && !item.disabled) {
    const L: ElementType = linkAs ?? 'a';
    const linkProps = linkAs ? { to: item.to } : { href: item.to };
    return (
      <L {...common} {...linkProps} onClick={onPick}>
        {inner}
      </L>
    );
  }
  return (
    <button
      type="button"
      {...common}
      disabled={item.disabled}
      onClick={() => {
        item.onSelect?.();
        onPick?.();
      }}
    >
      {inner}
    </button>
  );
}

/**
 * The menu bar: 24 px of chrome along the top. Items invert when hovered, focused or
 * current. Below 700 px the items fold into a pull-down behind a "Menu" button; the
 * brand and the right slot stay.
 */
export function MenuBar({ items, brand, brandTo = '/', right, linkAs, label = 'Site', className }: MenuBarProps) {
  const [open, setOpen] = useState(false);
  const sheetId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const B: ElementType = linkAs ?? 'a';
  const brandProps = linkAs ? { to: brandTo } : { href: brandTo };
  return (
    <nav className={cx('menubar on-chrome', className)} aria-label={label}>
      <B className="menubar-item menubar-brand" aria-label="Trail home" {...brandProps}>
        {brand ?? (
          <>
            <Icon name="mark" />
            Trail
          </>
        )}
      </B>
      <div className="menubar-items" style={{ display: undefined }}>
        {items.map((it, i) => (
          <Item key={i} item={it} linkAs={linkAs} />
        ))}
      </div>
      <button type="button" className="menubar-item menubar-toggle" aria-expanded={open} aria-controls={sheetId} onClick={() => setOpen((o) => !o)}>
        {open ? 'Close' : 'Menu'}
      </button>
      {right && <div className="menubar-right">{right}</div>}
      {open && (
        <div id={sheetId} className="menubar-sheet">
          {items.map((it, i) => (
            <Item key={i} item={it} linkAs={linkAs} onPick={() => setOpen(false)} />
          ))}
        </div>
      )}
    </nav>
  );
}

export default MenuBar;
