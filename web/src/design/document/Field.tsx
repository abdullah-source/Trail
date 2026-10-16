import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cx } from './cx';

/** Label (mono caps) + control + hint or error. Pass the control as children with the same id. */
export function Field({ id, label, hint, error, children, className }: { id: string; label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx('field-wrap', className)}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & { id: string; label: ReactNode; hint?: ReactNode; error?: ReactNode; wrapClassName?: string };

/** A labelled 44 px input. Hint and error are wired to aria-describedby; error sets aria-invalid. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(({ id, label, hint, error, className, wrapClassName, ...rest }, ref) => (
  <Field id={id} label={label} hint={hint} error={error} className={wrapClassName}>
    <input
      ref={ref}
      id={id}
      className={cx('field', className)}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      {...rest}
    />
  </Field>
));
TextField.displayName = 'TextField';

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string; label: ReactNode; hint?: ReactNode; error?: ReactNode; wrapClassName?: string };

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({ id, label, hint, error, className, wrapClassName, ...rest }, ref) => (
  <Field id={id} label={label} hint={hint} error={error} className={wrapClassName}>
    <textarea
      ref={ref}
      id={id}
      className={cx('field', className)}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      {...rest}
    />
  </Field>
));
TextArea.displayName = 'TextArea';

type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode; description?: ReactNode };

function choice(type: 'checkbox' | 'radio') {
  const C = forwardRef<HTMLInputElement, ChoiceProps>(({ label, description, className, ...rest }, ref) => (
    <label className={cx('choice', className)}>
      <input ref={ref} type={type} className={type === 'checkbox' ? 'chk' : 'radio'} {...rest} />
      <span style={{ display: 'grid', gap: 2 }}>
        <span>{label}</span>
        {description && <span className="field-hint">{description}</span>}
      </span>
    </label>
  ));
  C.displayName = type === 'checkbox' ? 'Checkbox' : 'Radio';
  return C;
}

/** Native inputs, restyled; keyboard and screen-reader behaviour are the browser's. */
export const Checkbox = choice('checkbox');
export const Radio = choice('radio');
