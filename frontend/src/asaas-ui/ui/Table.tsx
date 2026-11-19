import {
  forwardRef,
  type HTMLAttributes,
  type TableHTMLAttributes,
  type ThHTMLAttributes,
  type TdHTMLAttributes,
  type ReactNode,
} from 'react';
import { cx } from '../lib/cx';
import { Inbox } from 'lucide-react';

export const TableContainer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function TableContainer({ className, children, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cx(
          'w-full overflow-x-auto rounded-xl border border-border-hairline shadow-md',
          className
        )}
        style={{
          width: '100%',
          overflowX: 'auto',
          borderRadius: '12px',
          border: '1px solid var(--hairline)',
          backgroundColor: 'var(--surface-container-low, var(--glass-tint))',
          boxShadow: 'var(--glass-shadow)',
          scrollbarWidth: 'thin',
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

export const Table = forwardRef<HTMLTableElement, TableHTMLAttributes<HTMLTableElement>>(
  function Table({ className, children, style, ...props }, ref) {
    return (
      <table
        ref={ref}
        className={cx('w-full border-collapse text-right text-sm', className)}
        style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          textAlign: 'start',
          fontSize: '13.5px',
          color: 'var(--text)',
          ...style,
        }}
        {...props}
      >
        {children}
      </table>
    );
  }
);

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  function TableHeader({ className, children, style, ...props }, ref) {
    return (
      <thead
        ref={ref}
        className={cx('select-none', className)}
        style={{
          backgroundColor: 'var(--surface-container-high, var(--glass-tint-strong))',
          borderBottom: '1px solid var(--hairline)',
          userSelect: 'none',
          ...style,
        }}
        {...props}
      >
        {children}
      </thead>
    );
  }
);

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  function TableBody({ className, children, style, ...props }, ref) {
    return (
      <tbody
        ref={ref}
        className={cx('bg-transparent', className)}
        style={{
          backgroundColor: 'transparent',
          ...style,
        }}
        {...props}
      >
        {children}
      </tbody>
    );
  }
);

export const TableFooter = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  function TableFooter({ className, children, style, ...props }, ref) {
    return (
      <tfoot
        ref={ref}
        className={cx(className)}
        style={{
          borderTop: '1px solid var(--hairline)',
          backgroundColor: 'var(--surface-container, var(--glass-tint))',
          fontWeight: 500,
          ...style,
        }}
        {...props}
      >
        {children}
      </tfoot>
    );
  }
);

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
}

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  function TableRow({ className, selected, children, style, ...props }, ref) {
    return (
      <tr
        ref={ref}
        data-selected={selected}
        className={cx(
          'transition-colors duration-150',
          className
        )}
        style={{
          borderBottom: '1px solid var(--hairline)',
          transition: 'background-color 0.15s ease',
          backgroundColor: selected ? 'var(--accent-soft)' : 'transparent',
          ...style,
        }}
        {...props}
      >
        {children}
      </tr>
    );
  }
);

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  function TableHead({ className, children, style, ...props }, ref) {
    return (
      <th
        ref={ref}
        scope="col"
        className={cx(className)}
        style={{
          padding: '12px 16px',
          fontSize: '12px',
          fontWeight: 700,
          color: 'var(--text-2)',
          letterSpacing: '0.03em',
          display: 'table-cell',
          textAlign: 'start',
          whiteSpace: 'nowrap',
          borderBottom: '1px solid var(--hairline)',
          ...style,
        }}
        {...props}
      >
        {children}
      </th>
    );
  }
);

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  function TableCell({ className, children, style, ...props }, ref) {
    return (
      <td
        ref={ref}
        className={cx(className)}
        style={{
          display: 'table-cell',
          padding: '12px 16px',
          fontSize: '13.5px',
          verticalAlign: 'middle',
          color: 'var(--text)',
          whiteSpace: 'nowrap',
          borderBottom: '1px solid var(--hairline)',
          ...style,
        }}
        {...props}
      >
        {children}
      </td>
    );
  }
);

export interface TableEmptyProps extends HTMLAttributes<HTMLTableRowElement> {
  colSpan: number;
  message?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}

export function TableEmpty({
  colSpan,
  message = 'لا توجد بيانات متاحة حالياً',
  icon,
  action,
  className,
  style,
  ...props
}: TableEmptyProps) {
  return (
    <tr className={cx('table-empty-row', className)} style={style} {...props}>
      <td
        colSpan={colSpan}
        style={{
          padding: '48px 16px',
          textAlign: 'center',
          color: 'var(--text-2)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: 'var(--glass-inset)',
              border: '1px solid var(--hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-2)',
            }}
          >
            {icon || <Inbox size={22} />}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{message}</div>
          {action && <div style={{ marginTop: 8 }}>{action}</div>}
        </div>
      </td>
    </tr>
  );
}

export const TableCaption = forwardRef<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(
  function TableCaption({ className, children, style, ...props }, ref) {
    return (
      <caption
        ref={ref}
        className={cx('text-xs text-muted mt-2', className)}
        style={{
          captionSide: 'bottom',
          padding: '8px 16px',
          textAlign: 'start',
          color: 'var(--text-2)',
          fontSize: '12px',
          ...style,
        }}
        {...props}
      >
        {children}
      </caption>
    );
  }
);
