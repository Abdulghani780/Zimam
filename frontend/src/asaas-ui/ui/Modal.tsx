import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
  forwardRef,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../lib/cx';
import { X } from 'lucide-react';
import { Button } from './Button';

export interface ModalProps {
  open?: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  wide?: boolean;
  className?: string;
}

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export const Modal = forwardRef<HTMLDivElement, ModalProps>(function Modal(
  {
    title,
    subtitle,
    icon,
    onClose,
    children,
    footer,
    size = 'md',
    wide = false,
    className,
    open = true,
  },
  _ref
) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  // Accessible Focus Management & Escape Handler
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const getFocusables = () =>
      Array.from(dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS) ?? []);

    const firstField = dialog?.querySelector<HTMLElement>(`.modal-body :is(${FOCUSABLE_SELECTORS})`);
    if (firstField) {
      firstField.focus();
    } else if (dialog) {
      dialog.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialog) return;

      const items = getFocusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) {
        opener.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  const maxWidthStyle = {
    sm: '480px',
    md: wide ? '760px' : '620px',
    lg: '760px',
    xl: '960px',
    full: '1200px',
  }[size];

  return createPortal(
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'grid',
        placeItems: 'center',
        overflowY: 'auto',
        backgroundColor: 'rgba(5, 5, 6, 0.98)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '24px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? descId : undefined}
        className={cx('relative w-full rounded-2xl outline-none', className)}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: maxWidthStyle,
          margin: 'auto',
          backgroundColor: 'var(--bg, #141312)',
          border: '1px solid var(--accent-border, rgba(212, 160, 23, 0.45))',
          boxShadow: 'var(--glass-shadow)',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 48px)',
          boxSizing: 'border-box',
          animation: 'modal-zoom-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Golden Sovereign Filament Top Highlight */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
            zIndex: 10,
          }}
        />

        {/* Modal Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--hairline)',
            backgroundColor: 'var(--glass-tint-strong)',
            flexShrink: 0,
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {icon && <div style={{ color: 'var(--accent)', display: 'flex', flexShrink: 0 }}>{icon}</div>}
            <div style={{ minWidth: 0 }}>
              <h2
                id={titleId}
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--text)',
                  margin: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {title}
              </h2>
              {subtitle && (
                <p
                  id={descId}
                  style={{
                    fontSize: 12,
                    color: 'var(--text-3)',
                    margin: '3px 0 0',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            style={{
              color: 'var(--text-3)',
              padding: 6,
              borderRadius: 8,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </Button>
        </header>

        {/* Modal Body */}
        <div
          className="modal-body"
          style={{
            padding: '20px',
            overflowY: 'auto',
            flex: 1,
            color: 'var(--text-2)',
            fontSize: '13.5px',
            lineHeight: 1.6,
          }}
        >
          {children}
        </div>

        {/* Modal Action Footer */}
        {footer && (
          <footer
            style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--hairline)',
              backgroundColor: 'var(--glass-tint-strong)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              flexShrink: 0,
            }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
});
