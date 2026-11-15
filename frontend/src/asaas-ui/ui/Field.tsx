import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from 'react';
import { CURRENCY } from '../lib/format';
import { cx } from '../lib/cx';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  /** Shows a required marker next to the label. */
  required?: boolean;
  /** Marks the field invalid; passed to children as the second render arg. */
  error?: boolean;
  children: (id: string, isError: boolean) => ReactNode;
}

export function Field({ label, hint, required, error, children }: FieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true" style={{ color: 'var(--unpaid)' }}> *</span>}
      </label>
      {children(id, Boolean(error))}
      {hint && <div className="field__hint">{hint}</div>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function TextInput({ error, className, ...props }: InputProps) {
  return <input className={cx('input', error && 'input--error', className)} aria-invalid={error || undefined} {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="input" {...props} />;
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className="input" {...props}>
      {children}
    </select>
  );
}

interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | null;
  onChange: (value: number | null) => void;
}

/** Whole-rial amount with live thousands separators. */
export function MoneyInput({ value, onChange, ...props }: MoneyInputProps) {
  return (
    <div className="input-affix">
      <input
        className="input num"
        dir="ltr"
        inputMode="numeric"
        autoComplete="off"
        value={value === null ? '' : value.toLocaleString('en-US')}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d٠-٩]/g, '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660));
          onChange(digits ? Number(digits) : null);
        }}
        {...props}
      />
      <span className="input-affix__suffix">{CURRENCY}</span>
    </div>
  );
}

export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return <div className="form-error">{error instanceof Error ? error.message : String(error)}</div>;
}
