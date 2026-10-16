import type { ReactNode } from 'react';
import { cx } from './cx';
import { Reveal } from './Reveal';

/** Mono caps eyebrow: an index in guilloche green, a short rule, a few words. */
export function Eyebrow({ index, children, className }: { index?: string; children: ReactNode; className?: string }) {
  return (
    <span className={cx('eyebrow', className)}>
      {index && <span className="eyebrow-index">{index}</span>}
      {index && <span className="eyebrow-rule" aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}

export type SectionProps = {
  id?: string;
  /** "Who it's for" */
  eyebrow?: ReactNode;
  /** "02" */
  index?: string;
  title?: ReactNode;
  titleAs?: 'h1' | 'h2' | 'h3';
  lede?: ReactNode;
  align?: 'start' | 'center';
  /** a full-bleed band in the deeper paper, hairlines above and below */
  band?: boolean;
  /** rise the head in (default true) */
  reveal?: boolean;
  className?: string;
  children?: ReactNode;
};

/** A page section: eyebrow + expanded display heading + lede, then the content. 96 px rhythm. */
export function Section({ id, eyebrow, index, title, titleAs: T = 'h2', lede, align = 'start', band, reveal = true, className, children }: SectionProps) {
  const head =
    eyebrow != null || title != null || lede != null ? (
      reveal ? (
        <Reveal as="header" className="section-head">
          {eyebrow != null && <Eyebrow index={index}>{eyebrow}</Eyebrow>}
          {title != null && <T className={T === 'h1' ? 'h-hero' : 'h-section'}>{title}</T>}
          {lede != null && <p className="lede">{lede}</p>}
        </Reveal>
      ) : (
        <header className="section-head">
          {eyebrow != null && <Eyebrow index={index}>{eyebrow}</Eyebrow>}
          {title != null && <T className={T === 'h1' ? 'h-hero' : 'h-section'}>{title}</T>}
          {lede != null && <p className="lede">{lede}</p>}
        </header>
      )
    ) : null;
  const inner = (
    <section id={id} className={cx('section doc-container', className)} data-align={align}>
      {head}
      {children}
    </section>
  );
  return band ? <div className="band">{inner}</div> : inner;
}
