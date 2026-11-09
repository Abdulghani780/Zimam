import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';
import { Icon, type IconName } from './Icon';

interface GlassProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  thick?: boolean;
  pill?: boolean;
}

/** A liquid-glass surface. */
export function Glass({ as: Tag = 'div', thick, pill, className, style, ...props }: GlassProps) {
  return (
    <Tag
      className={cx('glass', thick && 'glass--thick', pill && 'glass--pill', className)}
      style={{
        backgroundColor: '#141312',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        ...style,
      }}
      {...props}
    />
  );
}

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  icon?: IconName;
  actions?: ReactNode;
}

export function Card({ title, icon, actions, children, className, style, ...props }: CardProps) {
  return (
    <section
      className={cx('card', className)}
      style={{
        backgroundColor: '#141312',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '20px 22px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
        boxSizing: 'border-box',
        ...style,
      }}
      {...props}
    >
      {(title || actions) && (
        <header
          className="card__header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <h2
            className="card__title"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 16,
              fontWeight: 700,
              color: '#f0ede6',
              margin: 0,
            }}
          >
            {icon && <Icon name={icon} />}
            {title}
          </h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
