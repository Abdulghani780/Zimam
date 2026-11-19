import { t } from '../lib/i18n';

interface BrandProps {
  /** Logo mark height in px; width follows the mark's aspect ratio. */
  size?: number;
  showText?: boolean;
  className?: string;
}

/**
 * ASAAS brand lockup: the official logo mark (auto light/dark via CSS) next to
 * the «زمام» product name. Use this everywhere the app identifies itself.
 */
export function Brand({ size = 40, showText = true, className = '' }: BrandProps) {
  return (
    <span className={`brand-lockup ${className}`}>
      <span
        className="brand-mark"
        style={{ width: Math.round(size * 0.84), height: size }}
        aria-hidden="true"
      />
      {showText && (
        <span className="brand-lockup__text">
          <strong>{t('زمام')}</strong>
          <small>{t('إدارة الخوادم والتحكم')}</small>
        </span>
      )}
    </span>
  );
}

/** Logo mark only (theme-aware), for tight spaces like the mobile drawer. */
export function BrandMark({ size = 30, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`brand-mark ${className}`}
      style={{ width: Math.round(size * 0.84), height: size }}
      aria-hidden="true"
    />
  );
}
