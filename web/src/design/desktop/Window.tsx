/* Window and TitleBar: the unit of the desktop. See web/DESIGN-desktop.md §4. */
import { useId, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import { cx } from './cx';

export type TitleBarProps = {
  title: ReactNode;
  /** Pixel icon drawn before the title. */
  icon?: IconName;
  /** Close box at the left. Without it a blank plate keeps the title centred. */
  onClose?: () => void;
  closeLabel?: string;
  /** Zoom box at the right: the "resizable look". */
  zoom?: boolean;
  onZoom?: () => void;
  /** Mono text right of the title, e.g. a timecode or a count. */
  right?: ReactNode;
  /** No stripes, soft title: a window that is not in front. */
  inactive?: boolean;
  /** Element for the title text. h2 by default so a page of windows reads as an outline. */
  as?: 'h1' | 'h2' | 'h3' | 'div';
  id?: string;
  className?: string;
};

export function TitleBar({ title, icon, onClose, closeLabel = 'Close', zoom, onZoom, right, inactive, as: Tag = 'h2', id, className }: TitleBarProps) {
  return (
    <div className={cx('win-title', inactive && 'win-inactive', className)}>
      {onClose ? <button type="button" className="win-box win-box-close" aria-label={closeLabel} onClick={onClose} /> : <span className="win-box-spacer" aria-hidden />}
      <Tag id={id} className="win-title-text">
        {icon && <Icon name={icon} />}
        <span>{title}</span>
        {right != null && <span className="win-title-right tabular">{right}</span>}
      </Tag>
      {zoom ? <button type="button" className="win-box win-box-zoom" aria-label="Zoom" onClick={onZoom} /> : <span className="win-box-spacer" aria-hidden />}
    </div>
  );
}

export type WindowProps = Omit<TitleBarProps, 'as' | 'id' | 'className'> & {
  children: ReactNode;
  /** Outer element; section by default. */
  as?: ElementType;
  titleAs?: TitleBarProps['as'];
  id?: string;
  className?: string;
  bodyClassName?: string;
  /** Chrome-coloured body for control panels; paper (sheet) otherwise. */
  chrome?: boolean;
  /** Draws the grow box in the bottom-right corner. */
  resizable?: boolean;
  /** Plays the 180 ms zoom-open once when mounted. Honours reduced motion via tokens.css. */
  open?: boolean;
  style?: CSSProperties;
};

/**
 * A window: striped title bar with close and zoom boxes, 1 px frame, the System 7 drop
 * shadow, and a paper body. `aria-labelledby` points at the title so the region is named.
 */
export function Window({ children, as: Tag = 'section', titleAs, id, className, bodyClassName, chrome, resizable, open, style, title, icon, onClose, closeLabel, zoom, onZoom, right, inactive }: WindowProps) {
  const auto = useId();
  const titleId = `${id ?? auto}-title`;
  return (
    <Tag id={id} className={cx('win', inactive && 'win-inactive', resizable && 'win-resizable', open && 'win-open', className)} aria-labelledby={titleId} style={style}>
      <TitleBar title={title} icon={icon} onClose={onClose} closeLabel={closeLabel} zoom={zoom ?? resizable} onZoom={onZoom} right={right} inactive={inactive} as={titleAs} id={titleId} />
      <div className={cx('win-body', chrome && 'win-body-chrome', bodyClassName)}>{children}</div>
      {resizable && (
        <span className="win-grip" aria-hidden>
          <Icon name="grow" />
        </span>
      )}
    </Tag>
  );
}

export default Window;
