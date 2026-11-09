import { type InputHTMLAttributes, useState, forwardRef } from 'react';
import { kitText } from '../lib/i18n';
import { passwordStrength, strengthLabel } from '../lib/passwordStrength';
import { Eye, EyeOff } from 'lucide-react';
import { cx } from '../lib/cx';

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: boolean;
}

/** Password field with focus ring and a show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { className, error, disabled, ...props },
  ref
) {
  const [visible, setVisible] = useState(false);

  const baseClasses =
    'w-full bg-surface-container-lowest/90 text-title placeholder:text-muted ' +
    'border rounded-md text-sm pr-3.5 pl-10 py-2.5 transition-all duration-200 outline-none ' +
    'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary ' +
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-container-low font-telemetry';

  const borderClass = error
    ? 'border-status-danger focus:ring-status-danger focus:border-status-danger'
    : 'border-border-hairline hover:border-border-hairline-strong';

  return (
    <div className="relative flex items-center w-full">
      <input
        ref={ref}
        dir="ltr"
        type={visible ? 'text' : 'password'}
        disabled={disabled}
        aria-invalid={error}
        className={cx('input', baseClasses, borderClass, className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-label={kitText(visible ? 'hidePassword' : 'showPassword')}
        aria-pressed={visible}
        title={kitText(visible ? 'hide' : 'show')}
        className="absolute left-3 text-muted hover:text-title transition-colors flex items-center justify-center p-1 focus:outline-none"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
});

/** Four-segment strength meter; informative only, never blocks submission. */
export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const level = passwordStrength(password);

  const colors = [
    'bg-status-danger',   // Level 1: Weak
    'bg-status-warning',  // Level 2: Moderate
    'bg-status-info',     // Level 3: Strong
    'bg-status-safe',     // Level 4: Sovereign
  ];

  const activeColor = colors[Math.min(level - 1, 3)] || 'bg-status-danger';

  return (
    <div className="flex flex-col gap-1.5 mt-1.5" aria-live="polite">
      <div className="grid grid-cols-4 gap-1.5 h-1 w-full" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => {
          const isOn = step <= Math.max(level, 1);
          return (
            <div
              key={step}
              className={cx(
                'h-full rounded-full transition-all duration-300',
                isOn ? activeColor : 'bg-surface-container-highest/60'
              )}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-caption text-muted">
        <span>{kitText('passwordStrength')}</span>
        <span className="font-semibold text-title">{strengthLabel(level)}</span>
      </div>
    </div>
  );
}
