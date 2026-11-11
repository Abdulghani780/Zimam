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
    style,
    ...props
  },
  ref
) {
  const accessibleName = label || (props['aria-label'] as string | undefined);
  const isIconOnly = size === 'icon' || (!children && Boolean(label));
  const isDisabled = disabled || loading;

  // Modern luxury tactile buttons matching Asaas Sovereign Brand
  const getVariantStyle = () => {
    switch (variant) {
      case 'primary':
        return {
          background: 'linear-gradient(180deg, #d8b36f 0%, #ba9555 50%, #9e7836 100%)',
          color: 'var(--action-primary-fg, var(--on-accent))',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 4px 16px -2px rgba(186, 149, 85, 0.45)',
        };
      case 'danger':
        return {
          background: 'linear-gradient(180deg, #eb574b 0%, #c43227 50%, #9e231a 100%)',
          color: '#ffffff',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 4px 16px -2px rgba(220, 50, 40, 0.45)',
          textShadow: '0 1px 1px rgba(40, 10, 10, 0.3)',
        };
      case 'secondary':
      case 'glass':
        return {
          background: 'var(--glass-tint-strong)',
          color: 'var(--text)',
          border: '1px solid var(--glass-rim)',
          boxShadow: 'inset 0 1px 0 var(--glass-rim), 0 4px 14px -4px var(--shadow-soft)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        };
      case 'outline':
        return {
          background: 'transparent',
          color: 'var(--text)',
          border: '1px solid var(--accent)',
          boxShadow: '0 2px 8px -2px var(--accent-glow)',
        };
      case 'ghost':
      default:
        return {
          background: 'transparent',
          color: 'var(--text-2)',
          border: '1px solid transparent',
        };
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'sm':
        return {
          height: 32,
          padding: isIconOnly ? '0' : '0 12px',
          width: isIconOnly ? 32 : 'auto',
          fontSize: 12,
          gap: 6,
          borderRadius: 999,
        };
      case 'lg':
        return {
          height: 46,
          padding: isIconOnly ? '0' : '0 22px',
          width: isIconOnly ? 46 : 'auto',
          fontSize: 15,
          gap: 10,
          borderRadius: 999,
        };
      case 'icon':
        return {
          height: 38,
          width: 38,
          padding: 0,
          fontSize: 14,
          borderRadius: 999,
        };
      case 'md':
      default:
        return {
          height: 38,
          padding: isIconOnly ? '0' : '0 18px',
          width: isIconOnly ? 38 : 'auto',
          fontSize: 13,
          gap: 8,
          borderRadius: 999,
        };
    }
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-label={accessibleName}
      title={accessibleName}
      className={cx('btn', `btn--${variant}`, isIconOnly && 'btn--icon', className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontFamily: 'var(--font)',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        ...getSizeStyle(),
        ...getVariantStyle(),
        ...style,
      }}
      {...props}
    >
      {/* Loading Spinner */}
      {loading && (
        <span
          className="inline-block animate-spin"
          style={{
            width: 14,
            height: 14,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            flexShrink: 0,
          }}
        />
      )}

      {/* Start Icon */}
      {!loading && iconPosition === 'start' && (
        <>
          {icon && <Icon name={icon} />}
          {iconNode && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{iconNode}</span>}
        </>
      )}

      {/* Button Content */}
      {children && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{children}</span>}

      {/* End Icon */}
      {!loading && iconPosition === 'end' && (
        <>
          {icon && <Icon name={icon} />}
          {iconNode && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{iconNode}</span>}
        </>
      )}
    </button>
  );
});
