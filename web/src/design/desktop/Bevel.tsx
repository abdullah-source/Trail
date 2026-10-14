/* Bevel and Panel: the raised and sunken surfaces everything else is built from. */
import type { CSSProperties, ElementType, ReactNode } from 'react';
import { cx } from './cx';

export type BevelProps = {
  children?: ReactNode;
  /** Sunken (a well or field) instead of raised (a face). */
  sunken?: boolean;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  id?: string;
};

/** 1 px frame with a white top-left and dark-grey bottom-right highlight (or the reverse when sunken). */
export function Bevel({ children, sunken, as: Tag = 'div', className, style, id }: BevelProps) {
  return (
    <Tag id={id} className={cx(sunken ? 'bevel-in' : 'bevel-out', className)} style={style}>
      {children}
    </Tag>
  );
}

export type PanelProps = {
  children: ReactNode;
  /** Mono caps label at the top of the panel, like a control panel group. */
  legend?: ReactNode;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  id?: string;
};

/** A raised chrome panel with 16 px padding and an optional legend. */
export function Panel({ children, legend, as: Tag = 'div', className, style, id }: PanelProps) {
  return (
    <Tag id={id} className={cx('panel on-chrome', className)} style={style}>
      {legend && <div className="panel-legend">{legend}</div>}
      {children}
    </Tag>
  );
}

export default Bevel;
