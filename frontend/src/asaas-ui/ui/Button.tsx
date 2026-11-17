import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';
import { kitText } from '../lib/i18n';
import { Icon, type IconName } from './Icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'glass' | 'ghost' | 'danger' | 'secondary' | 'outline';
  size?: 'md' | 'sm';
  icon?: IconName;
  /** Custom icon node (lucide etc.) rendered before the label. */
  iconNode?: ReactNode;
  /** Visible text, or the accessible name when the button is icon-only. */
  label?: string;
  loading?: boolean;
}

export function Button({
  variant = 'glass',
  size = 'md',
  icon,
  iconNode,
  label,
  loading,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  const hasText = Boolean(children) || Boolean(iconNode && label);
  const iconOnly = !hasText && Boolean(label);
  // Aliases kept for pages written against the pre-kit Button API.
  const resolvedVariant = variant === 'secondary' ? 'glass' : variant === 'outline' ? 'ghost' : variant;
  return (
    <button
      type={type}
      className={cx('btn', `btn--${resolvedVariant}`, size === 'sm' && 'btn--sm', iconOnly && 'btn--icon', className)}
      disabled={disabled || loading}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      {...props}
    >
      {iconNode ?? (icon ? <Icon name={icon} /> : null)}
      {loading ? kitText('saving') : (children ?? (iconNode ? label : null))}
    </button>
  );
}
