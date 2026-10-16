import { forwardRef, type ButtonHTMLAttributes, type ComponentType, type MouseEventHandler, type ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './icons';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
/** older names still accepted: default → secondary, ghost → quiet */
export type ButtonVariantInput = ButtonVariant | 'default' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

/** What `linkAs` must accept: react-router's Link fits. */
export type LinkComponent = ComponentType<{ to: string; className?: string; children?: ReactNode; 'aria-current'?: 'page'; onClick?: MouseEventHandler<HTMLAnchorElement> }>;

const variantOf = (v?: ButtonVariantInput): ButtonVariant => (v === 'default' || !v ? 'secondary' : v === 'ghost' ? 'quiet' : v);

export function buttonClass({ variant, size = 'md', icon, ring, className }: { variant?: ButtonVariantInput; size?: ButtonSize; icon?: boolean; ring?: boolean; className?: string }) {
  const v = variantOf(variant);
  return cx('btn', `btn-${v}`, size !== 'md' && `btn-${size}`, icon && 'btn-icon', ring && 'btn-ring', className);
}

type Common = {
  variant?: ButtonVariantInput;
  size?: ButtonSize;
  /** leading icon */
  icon?: IconName;
  /** a trailing arrow that nudges right on hover */
  arrow?: boolean;
  /** emphasis ring (the default action of a form) */
  ring?: boolean;
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & Common;

/** The pill. Springs up 2 % on hover, settles to 98 % on press; still under reduced motion. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ variant, size, icon, arrow, ring, className, children, type = 'button', ...rest }, ref) => (
  <button ref={ref} type={type} className={buttonClass({ variant, size, ring, className })} {...rest}>
    {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
    {children}
    {arrow && <Icon name="arrow" size={16} className="btn-arrow" />}
  </button>
));
Button.displayName = 'Button';

/** A square-ish round icon button; `label` is required and becomes the accessible name. */
export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'icon' | 'arrow' | 'children'> & { icon: IconName; label: string }>(({ icon, label, size = 'sm', variant = 'quiet', className, type = 'button', ...rest }, ref) => (
  <button ref={ref} type={type} aria-label={label} title={label} className={buttonClass({ variant, size, icon: true, className })} {...rest}>
    <Icon name={icon} size={size === 'lg' ? 22 : 18} />
  </button>
));
IconButton.displayName = 'IconButton';

export type ButtonLinkProps = Common & {
  to: string;
  /** open in a new tab (only for absolute URLs) */
  external?: boolean;
  /** pass react-router's Link for in-app routes; a plain <a> otherwise */
  linkAs?: LinkComponent;
  className?: string;
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function ButtonLink({ to, external, linkAs: L, variant, size, icon, arrow, ring, className, children, onClick }: ButtonLinkProps) {
  const cls = buttonClass({ variant, size, ring, className });
  const inner = (
    <>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
      {arrow && <Icon name="arrow" size={16} className="btn-arrow" />}
      {external && <span className="sr-only"> (opens in a new tab)</span>}
    </>
  );
  if (L && !external && to.startsWith('/'))
    return (
      <L to={to} className={cls} onClick={onClick}>
        {inner}
      </L>
    );
  return (
    <a href={to} className={cls} onClick={onClick} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
      {inner}
    </a>
  );
}
