import { useEffect, useRef, type ReactNode } from 'react'
import { Button, cx } from './Glass'
import { Icon } from './Icons'
import { BodyPortal } from './Navbar'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg' | 'xl'
}

const WIDTHS = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-6xl' }

/** macOS "sheet" görünümlü pencere. Esc ile kapanır, açılınca ilk alana odaklanır. */
export function Modal({ open, title, onClose, children, footer, width = 'md' }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('input,select,textarea,button[data-autofocus]')?.focus(), 30)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <BodyPortal>
    <div className="animate-fade fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/25 p-6 pt-[6vh] backdrop-blur-[3px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('animate-pop w-full rounded-[20px] border border-[var(--glass-border)] bg-[var(--modal-bg)] shadow-[var(--shadow-pop)] backdrop-blur-2xl', WIDTHS[width])}
      >
        <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-5 py-3.5">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
          <button onClick={onClose} aria-label="Kapat" className="grid size-7 place-items-center rounded-full bg-[var(--hover)] text-[var(--text-muted)] transition hover:bg-[var(--hover-strong)] hover:text-[var(--text)]"><Icon name="x" size={13} strokeWidth={2.2} /></button>
        </div>
        <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-[var(--glass-border)] px-5 py-3">{footer}</div>}
      </div>
    </div>
    </BodyPortal>
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Sil', danger = true, busy, onConfirm, onClose }: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal open={open} title={title} onClose={onClose} width="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
        <Button data-autofocus variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>{busy ? 'İşleniyor…' : confirmLabel}</Button>
      </>}
    >
      <div className="flex gap-3">
        {danger && <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--critical-bg)] text-[var(--danger)]"><Icon name="trash" size={16} /></span>}
        <div className="text-[13px] leading-relaxed text-[var(--text-2)]">{message}</div>
      </div>
    </Modal>
  )
}
