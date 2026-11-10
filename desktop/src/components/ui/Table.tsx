import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cx } from './Glass'

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cx('w-full border-collapse text-[13px]', className)} {...props} />
    </div>
  )
}

export function Th({ className, align, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'right' }) {
  return (
    <th
      className={cx(
        'sticky top-0 border-b border-[var(--glass-border)] px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]',
        align === 'right' && 'text-right',
        className,
      )}
      {...props}
    />
  )
}

export function Td({ className, align, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'right' }) {
  return <td className={cx('border-b border-[var(--row-border)] px-3 py-2.5', align === 'right' && 'text-right tabular-nums', className)} {...props} />
}
