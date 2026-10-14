/* Dialog: the double-framed box. Verify is one, Install is one, Login is one. */
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import { Icon, type IconName, type Ink } from './icons';
import { cx } from './cx';

export type DialogProps = {
  title?: ReactNode;
  /** 32 px pixel icon at the top left: disk for Verify, warning for a broken chain, key for Login. */
  icon?: IconName;
  /** Recolour an ink of the icon, e.g. { w: 'var(--paste)' } for an amber warning. */
  iconFill?: Partial<Record<Ink, string>>;
  children: ReactNode;
  /** Buttons, right-aligned. Give exactly one `ring`. */
  actions?: ReactNode;
  /** Escape calls this when the dialog is modal. */
  onClose?: () => void;
  /** Dithered backdrop over the desk, focus moved into the dialog. */
  modal?: boolean;
  role?: 'dialog' | 'alertdialog';
  width?: number | string;
  className?: string;
  style?: CSSProperties;
  id?: string;
};

export function Dialog({ title, icon, iconFill, children, actions, onClose, modal, role = 'dialog', width, className, style, id }: DialogProps) {
  const auto = useId();
  const titleId = `${id ?? auto}-title`;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!modal) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, onClose]);
  const box = (
    <div ref={ref} id={id} role={role} aria-modal={modal || undefined} aria-labelledby={title ? titleId : undefined} tabIndex={modal ? -1 : undefined} className={cx('dialog', className)} style={{ width, ...style }}>
      <div className="dialog-head">
        {icon && <Icon name={icon} size={32} fill={iconFill} />}
        <div style={{ minWidth: 0, flex: 1, display: 'grid', gap: 12 }}>
          {title && (
            <h2 id={titleId} className="dialog-title">
              {title}
            </h2>
          )}
          {children}
        </div>
      </div>
      {actions && <div className="dialog-actions">{actions}</div>}
    </div>
  );
  return modal ? <div className="dialog-backdrop">{box}</div> : box;
}

export default Dialog;
