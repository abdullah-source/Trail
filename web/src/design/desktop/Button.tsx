/* Button and ButtonLink: bevelled faces that invert when pressed. */
import { forwardRef, type ButtonHTMLAttributes, type ElementType, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import { cx } from './cx';

export type ButtonVariant = 'default' | 'primary' | 'quiet';
export type ButtonSize = 'sm' | 'md' | 'lg';

const cls = (variant: ButtonVariant, size: ButtonSize, ring?: boolean, className?: string) =>
  cx('btn', variant === 'primary' && 'btn-primary', variant === 'quiet' && 'btn-quiet', size === 'lg' && 'btn-lg', size === 'sm' && 'btn-sm', ring && 'btn-ring', className);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** The thick ring of a dialog's default button (Enter). One per dialog. */
  ring?: boolean;
  icon?: IconName;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ variant = 'default', size = 'md', ring, icon, className, type = 'button', children, ...rest }, ref) => (
  <button ref={ref} type={type} className={cls(variant, size, ring, className)} {...rest}>
    {icon && <Icon name={icon} />}
    {children}
  </button>
));
Button.displayName = 'Button';

/** A 24 px square button holding one pixel icon: transport controls, title-bar tools. */
export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'icon' | 'children' | 'size'> & { icon: IconName; label: string }>(({ icon, label, className, variant = 'default', type = 'button', ...rest }, ref) => (
  <button ref={ref} type={type} className={cx('btn btn-icon', variant === 'primary' && 'btn-primary', className)} aria-label={label} title={label} {...rest}>
    <Icon name={icon} />
  </button>
));
IconButton.displayName = 'IconButton';

export type ButtonLinkProps = {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  ring?: boolean;
  icon?: IconName;
  className?: string;
  children: ReactNode;
  /** Opens in a new tab with rel="noreferrer". */
  external?: boolean;
  /** Component that takes `to`, e.g. react-router-dom's Link. Plain anchors otherwise. */
  linkAs?: ElementType;
};

export function ButtonLink({ to, variant = 'default', size = 'md', ring, icon, className, children, external, linkAs }: ButtonLinkProps) {
  const c = cls(variant, size, ring, className);
  const body = (
    <>
      {icon && <Icon name={icon} />}
      {children}
    </>
  );
  if (external || !linkAs)
    return (
      <a href={to} className={c} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
        {body}
      </a>
    );
  const L: ElementType = linkAs;
  return (
    <L to={to} className={c}>
      {body}
    </L>
  );
}

export default Button;
