import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import { Icon, type IconName } from './Icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'glass' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  icon?: IconName;
  iconNode?: ReactNode;
  iconPosition?: 'start' | 'end';
  label?: string;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'glass',
    size = 'md',
    icon,
    iconNode,
    iconPosition = 'start',
    label,
    loading = false,
    className,
    children,
    disabled = false,
    type = 'button',
    ...props
  },
  ref
) {
  const accessibleName = label || (props['aria-label'] as string | undefined);
  const isIconOnly = size === 'icon' || (!children && Boolean(label));
  const isDisabled = disabled || loading;

  // Base Tailwind utility classes (Accessible Focus Rings, Transitions, Layout)
  const baseClasses =
    'relative inline-flex items-center justify-center font-bold select-none cursor-pointer ' +
    'transition-all duration-200 ease-out outline-none ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas ' +
    'disabled:opacity-45 disabled:pointer-events-none disabled:cursor-not-allowed';

  // Variant mappings driven by 3-Layer Design Tokens
  const variantClasses = {
    primary:
      'bg-gradient-to-r from-primary via-[#f6be39] to-[#ffd700] text-primary-fg ' +
      'shadow-[0_4px_18px_rgba(212,160,23,0.35)] hover:shadow-[0_4px_26px_rgba(246,190,57,0.55)] ' +
      'hover:brightness-105 active:scale-[0.98] border-none',
    secondary:
      'bg-surface-container-high text-title hover:bg-surface-container-highest ' +
      'border border-border-hairline hover:border-border-hairline-strong active:scale-[0.98]',
    glass:
      'bg-surface-glass-tint text-title hover:bg-primary/10 hover:text-primary ' +
      'border border-border-gold-rim hover:border-border-gold-rim-strong ' +
      'shadow-sm active:scale-[0.98] backdrop-blur-md',
    ghost:
      'bg-transparent text-muted hover:text-title hover:bg-surface-glass-tint ' +
      'border-none active:scale-[0.98]',
    danger:
      'bg-status-danger-surface text-status-danger hover:bg-status-danger/25 ' +
      'border border-status-danger-border shadow-[0_2px_12px_rgba(239,68,68,0.2)] ' +
      'active:scale-[0.98]',
    outline:
      'bg-transparent text-title hover:bg-surface-glass-tint ' +
      'border border-border-hairline hover:border-border-gold-rim active:scale-[0.98]',
  }[variant];

  // Size mappings
  const sizeClasses = {
    sm: isIconOnly ? 'w-8 h-8 p-0 rounded-sm' : 'h-8 px-3 text-xs gap-1.5 rounded-sm',
    md: isIconOnly ? 'w-10 h-10 p-0 rounded-sm' : 'h-10 px-4 text-sm gap-2 rounded-sm',
    lg: isIconOnly ? 'w-12 h-12 p-0 rounded-md' : 'h-12 px-6 text-base gap-2.5 rounded-md',
    icon: 'w-10 h-10 p-0 rounded-sm',
  }[size];

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading}
      aria-label={accessibleName}
      title={accessibleName}
      className={cx('btn', `btn--${variant}`, baseClasses, variantClasses, sizeClasses, className)}
      {...props}
    >
      {/* Loading Spinner */}
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}

      {/* Start Icon */}
      {!loading && iconPosition === 'start' && (
        <>
          {icon && <Icon name={icon} />}
          {iconNode && <span className="inline-flex shrink-0">{iconNode}</span>}
        </>
      )}

      {/* Button Content */}
      {children}

      {/* End Icon */}
      {!loading && iconPosition === 'end' && (
        <>
          {icon && <Icon name={icon} />}
          {iconNode && <span className="inline-flex shrink-0">{iconNode}</span>}
        </>
      )}
    </button>
  );
});
