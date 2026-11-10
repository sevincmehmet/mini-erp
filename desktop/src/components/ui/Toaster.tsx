import { useToastStore } from '../../stores/useToastStore'
import { cx } from './Glass'
import { Icon } from './Icons'

export function Toaster() {
  const { toasts, dismiss } = useToastStore()
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-96 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'animate-toast pointer-events-auto flex items-start gap-2.5 rounded-[14px] border border-[var(--glass-border)] bg-[var(--tooltip-bg)] px-3.5 py-3 text-[13px] shadow-[var(--shadow-pop)] backdrop-blur-xl',
          )}
        >
          <span className={cx('grid size-5 shrink-0 place-items-center rounded-full text-white',
            t.tone === 'success' && 'bg-[var(--success)]', t.tone === 'error' && 'bg-[var(--danger)]', t.tone === 'info' && 'bg-[var(--accent)]')}>
            <Icon name={t.tone === 'success' ? 'check' : t.tone === 'error' ? 'x' : 'info'} size={12} strokeWidth={2.4} />
          </span>
          <p className="flex-1 leading-snug">{t.message}</p>
          <button onClick={() => dismiss(t.id)} aria-label="Kapat" className="text-[var(--text-faint)] hover:text-[var(--text)]"><Icon name="x" size={13} /></button>
        </div>
      ))}
    </div>
  )
}
