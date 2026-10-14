/* DesktopPattern: the dithered desk behind everything, and the icons that sit on it. */
import type { CSSProperties, ElementType, ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import { cx } from './cx';

export type DesktopPatternProps = {
  children?: ReactNode;
  /** Flat paper instead of the 2 px checker (for print, or a very busy page). */
  plain?: boolean;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
};

/** The desk. Only ink goes directly on it; everything else sits in a window or on a label plate. */
export function DesktopPattern({ children, plain, as: Tag = 'div', className, style }: DesktopPatternProps) {
  return (
    <Tag className={cx(plain ? 'desk-plain' : 'desk', className)} style={style}>
      {children}
    </Tag>
  );
}

export type DesktopIconProps = {
  icon: IconName;
  label: string;
  to?: string;
  onOpen?: () => void;
  linkAs?: ElementType;
  size?: 32 | 48;
  className?: string;
};

/** A 32 px pixel icon with its label on a paper plate. Links through `linkAs` or a plain anchor. */
export function DesktopIcon({ icon, label, to, onOpen, linkAs, size = 32, className }: DesktopIconProps) {
  const inner = (
    <>
      <Icon name={icon} size={size} />
      <span className="label-plate">{label}</span>
    </>
  );
  if (to) {
    const L: ElementType = linkAs ?? 'a';
    const p = linkAs ? { to } : { href: to };
    return (
      <L className={cx('desk-icon', className)} {...p}>
        {inner}
      </L>
    );
  }
  return (
    <button type="button" className={cx('desk-icon', className)} onClick={onOpen}>
      {inner}
    </button>
  );
}

export default DesktopPattern;
