import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cx } from './Glass'

const control =
  'h-8 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--input-bg)] px-2.5 text-[13px] outline-none ' +
  'placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/25 disabled:opacity-60'

export function Field({ label, hint, required, children, className }: { label: string; hint?: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={cx('flex flex-col gap-1', className)}>
      <span className="text-[12px] font-medium text-[var(--text-muted)]">
        {label}{required && <span className="text-[var(--danger)]"> *</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-[var(--text-muted)]">{hint}</span>}
    </label>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(control, className)} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(control, 'pr-7', className)} {...props}>{children}</select>
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(control, 'h-auto min-h-16 py-1.5', className)} {...props} />
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>
}

/** Sunucudan gelen doğrulama hatalarını form içinde gösterir. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return <p role="alert" className="mt-3 rounded-lg bg-[var(--critical-bg)] px-3 py-2 text-[12px] text-[var(--critical-text)]">{message}</p>
}

/** "1.234,56" gibi Türkçe yazımı da kabul eden sayı çevirici (form alanları için). */
export function toNumber(value: string): number {
  const v = value.replace(/\s|₺|TL/gi, '')
  if (v === '') return 0
  const normalized = v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v
  const n = Number(normalized)
  return Number.isFinite(n) ? n : NaN
}
