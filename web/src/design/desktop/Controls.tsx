/* Checkbox, Radio, TextField: native inputs skinned with pixel glyphs from tokens.css. */
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from './cx';

type Choice = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode; description?: ReactNode };

export const Checkbox = forwardRef<HTMLInputElement, Choice>(({ label, description, className, ...rest }, ref) => (
  <label className={cx('choice', className)}>
    <input ref={ref} type="checkbox" className="chk" {...rest} />
    <span>
      {label}
      {description && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--ink-soft)' }}>{description}</span>}
    </span>
  </label>
));
Checkbox.displayName = 'Checkbox';

export const Radio = forwardRef<HTMLInputElement, Choice>(({ label, description, className, ...rest }, ref) => (
  <label className={cx('choice', className)}>
    <input ref={ref} type="radio" className="radio" {...rest} />
    <span>
      {label}
      {description && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--ink-soft)' }}>{description}</span>}
    </span>
  </label>
));
Radio.displayName = 'Radio';

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & { id: string; label: ReactNode; hint?: ReactNode };

/** A sunken text field with its label above and an optional hint below. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(({ id, label, hint, className, ...rest }, ref) => (
  <div className={cx(className)} style={{ display: 'grid', gap: 4 }}>
    <label htmlFor={id} className="field-label">
      {label}
    </label>
    <input ref={ref} id={id} className="field" aria-describedby={hint ? `${id}-hint` : undefined} {...rest} />
    {hint && (
      <p id={`${id}-hint`} style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>
        {hint}
      </p>
    )}
  </div>
));
TextField.displayName = 'TextField';
