import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../components/ui/Glass'
import { Icon } from '../components/ui/Icons'
import { Tooltip } from '../components/ui/Tooltip'
import { api } from '../lib/apiClient'
import { useAuthStore } from '../stores/useAuthStore'
import { useCompanyStore } from '../stores/useCompanyStore'
import { useNavStore, type BuiltinPage } from '../stores/useNavStore'
import { CompanyMark } from './Sidebar'

interface Notice {
  key: string
  companyId: string
  companyName: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  detail: string
  page: BuiltinPage
  count: number
}

const TONE = {
  critical: { dot: 'var(--danger)', bg: 'var(--critical-bg)', text: 'var(--critical-text)', label: 'Acil' },
  warning: { dot: 'var(--warning-text)', bg: 'var(--warning-bg)', text: 'var(--warning-text)', label: 'Uyarı' },
  info: { dot: 'var(--info-text)', bg: 'var(--info-bg)', text: 'var(--info-text)', label: 'Bilgi' },
}

const STALE_BACKUP_DAYS = 7

/** Bildirim zili: tüm şirketlerde dikkat isteyen işler; tıklayınca ilgili şirket ve ekrana gider. */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notice[]>([])
  const status = useAuthStore((s) => s.status)
  const { companies, switchCompany } = useCompanyStore()
  const go = useNavStore((s) => s.go)

  useEffect(() => {
    if (status !== 'ready') return
    const load = () => api<Notice[]>('/api/notifications').then((list) => {
      // Bu bilgisayardaki yedek tarihine göre istemci tarafı hatırlatma
      const extra: Notice[] = []
      try {
        const last = JSON.parse(localStorage.getItem('minierp-last-backup') ?? '{}') as Record<string, string>
        for (const c of companies) {
          const at = last[c.id]
          const days = at ? (Date.now() - new Date(at).getTime()) / 86400000 : Infinity
          if (days > STALE_BACKUP_DAYS) extra.push({ key: `backup-${c.id}`, companyId: c.id, companyName: c.name, severity: 'warning', title: at ? 'Son yedek bir haftadan eski' : 'Bu bilgisayarda yedek yok', detail: 'Yedekleme ekranından tek tıkla yedek alın.', page: 'backup', count: 1 })
        }
      } catch { /* depolama kapalı */ }
      setItems([...list, ...extra])
    }).catch(() => {})
    void load()
    const t = setInterval(load, 120_000)
    return () => clearInterval(t)
  }, [status, companies])

  const urgent = items.filter((i) => i.severity !== 'info').length

  return (
    <>
      <Tooltip content="Bildirimler" side="bottom">
        <button onClick={() => setOpen((o) => !o)} aria-label={`Bildirimler (${items.length})`} aria-expanded={open}
          className={cx('relative grid size-8 place-items-center rounded-[9px] text-[var(--text-muted)] transition hover:bg-[var(--hover-strong)] hover:text-[var(--text)]', open && 'bg-[var(--hover-strong)] text-[var(--text)]')}>
          <Icon name="bell" size={17} />
          {items.length > 0 && (
            <span className={cx('absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-[var(--base-bg)]', urgent ? 'bg-[var(--danger)]' : 'bg-[var(--accent)]')}>
              {items.length}
            </span>
          )}
        </button>
      </Tooltip>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="animate-pop fixed right-4 top-[52px] z-[61] w-[380px] overflow-hidden rounded-[16px] border border-[var(--glass-border)] bg-[var(--modal-bg)] shadow-[var(--shadow-pop)] backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-4 py-3">
              <p className="text-[14px] font-semibold">Bildirimler</p>
              <span className="text-[11.5px] text-[var(--text-muted)]">{companies.length} şirket</span>
            </div>
            <ul className="max-h-[60vh] overflow-y-auto p-1.5">
              {items.length === 0 && (
                <li className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <span className="grid size-10 place-items-center rounded-full bg-[var(--good-bg)] text-[var(--good-text)]"><Icon name="check" size={18} strokeWidth={2.2} /></span>
                  <p className="text-[13px] font-medium">Her şey yolunda</p>
                  <p className="text-[12px] text-[var(--text-muted)]">Dikkat isteyen bir iş yok.</p>
                </li>
              )}
              {items.map((n) => {
                const t = TONE[n.severity]
                const co = companies.find((c) => c.id === n.companyId)
                return (
                  <li key={n.key}>
                    <button onClick={() => { switchCompany(n.companyId); go(n.page); setOpen(false) }}
                      className="flex w-full items-start gap-3 rounded-[12px] px-3 py-2.5 text-left transition hover:bg-[var(--hover)]">
                      <CompanyMark name={n.companyName} color={co?.accentColor ?? null} size={26} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="size-1.5 shrink-0 rounded-full" style={{ background: t.dot }} />
                          <p className="truncate text-[13px] font-medium">{n.title}</p>
                        </div>
                        <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{n.companyName} · {n.detail}</p>
                      </div>
                      <Icon name="chevronRight" size={14} className="mt-1 text-[var(--text-faint)]" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
