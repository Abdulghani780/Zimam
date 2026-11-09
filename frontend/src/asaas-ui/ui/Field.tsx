import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
  useId,
} from 'react';
import { cx } from '../lib/cx';
import { CURRENCY } from '../lib/format';
import { AlertCircle } from 'lucide-react';

export interface FieldProps {
  label?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: (id: string, isError: boolean) => ReactNode;
}

export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const generatedId = useId();
  const id = generatedId;
  const isError = Boolean(error);

  return (
    <div className={cx('flex flex-col gap-1.5 w-full', className)}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs sm:text-sm font-semibold text-title flex items-center justify-between"
        >
          <span>
            {label}
            {required && <span className="text-status-danger mr-1">*</span>}
          </span>
        </label>
      )}

      {children(id, isError)}

      {error ? (
        <div className="text-xs text-status-danger flex items-center gap-1.5 mt-0.5 animate-in fade-in">
          <AlertCircle size={13} className="shrink-0" />
          <span>{error}</span>
        </div>
      ) : hint ? (
        <div className="text-xs text-muted leading-relaxed mt-0.5">{hint}</div>
      ) : null}
    </div>
  );
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className, error, startIcon, endIcon, disabled, ...props },
  ref
) {
  const baseInputClasses =
    'w-full bg-surface-container-lowest/90 text-title placeholder:text-muted ' +
    'border rounded-md text-sm px-3.5 py-2.5 transition-all duration-200 outline-none ' +
    'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary ' +
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-container-low';

  const borderClass = error
    ? 'border-status-danger focus:ring-status-danger focus:border-status-danger'
    : 'border-border-hairline hover:border-border-hairline-strong';

  if (!startIcon && !endIcon) {
    return (
      <input
        ref={ref}
        disabled={disabled}
        aria-invalid={error}
        className={cx('input', baseInputClasses, borderClass, className)}
        {...props}
      />
    );
  }

  return (
    <div className="relative flex items-center w-full">
      {startIcon && (
        <div className="absolute right-3 text-muted pointer-events-none flex items-center justify-center">
          {startIcon}
        </div>
      )}
      <input
        ref={ref}
        disabled={disabled}
        aria-invalid={error}
        className={cx(
          'input',
          baseInputClasses,
          borderClass,
          startIcon && 'pr-9',
          endIcon && 'pl-9',
          className
        )}
        {...props}
      />
      {endIcon && (
        <div className="absolute left-3 text-muted flex items-center justify-center">
          {endIcon}
        </div>
      )}
    </div>
  );
});

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { className, error, disabled, rows = 3, ...props },
  ref
) {
  const baseClasses =
    'w-full bg-surface-container-lowest/90 text-title placeholder:text-muted ' +
    'border rounded-md text-sm p-3.5 transition-all duration-200 outline-none resize-y ' +
    'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary ' +
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-container-low';

  const borderClass = error
    ? 'border-status-danger focus:ring-status-danger focus:border-status-danger'
    : 'border-border-hairline hover:border-border-hairline-strong';

  return (
    <textarea
      ref={ref}
      rows={rows}
      disabled={disabled}
      aria-invalid={error}
      className={cx('input', baseClasses, borderClass, className)}
      {...props}
    />
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, error, disabled, ...props },
  ref
) {
  const baseClasses =
    'w-full bg-surface-container-lowest/90 text-title ' +
    'border rounded-md text-sm px-3.5 py-2.5 transition-all duration-200 outline-none cursor-pointer ' +
    'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary ' +
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-container-low';

  const borderClass = error
    ? 'border-status-danger focus:ring-status-danger focus:border-status-danger'
    : 'border-border-hairline hover:border-border-hairline-strong';

  return (
    <div className="relative flex items-center w-full">
      <select
        ref={ref}
        disabled={disabled}
        aria-invalid={error}
        className={cx('input appearance-none pr-3.5 pl-9', baseClasses, borderClass, className)}
        {...props}
      >
        {children}
      </select>
      <div className="absolute left-3 pointer-events-none text-muted flex items-center">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
});

export interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | null;
  onChange: (value: number | null) => void;
  error?: boolean;
}

/** Whole-rial amount with live thousands separators. */
export function MoneyInput({ value, onChange, error, className, ...props }: MoneyInputProps) {
  return (
    <div className="relative flex items-center w-full">
      <TextInput
        dir="ltr"
        inputMode="numeric"
        autoComplete="off"
        value={value === null ? '' : value.toLocaleString('en-US')}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d٠-٩]/g, '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660));
          onChange(digits ? Number(digits) : null);
        }}
        error={error}
        className={cx('pl-14', className)}
        {...props}
      />
      <span className="absolute left-3 text-muted text-xs font-semibold select-none pointer-events-none">
        {CURRENCY}
      </span>
    </div>
  );
}

export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="p-3 rounded-md bg-status-danger-surface border border-status-danger-border text-status-danger text-xs sm:text-sm flex items-center gap-2">
      <AlertCircle size={16} className="shrink-0" />
      <span>{message}</span>
    </div>
  );
}
