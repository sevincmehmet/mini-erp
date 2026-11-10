import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cx, Kbd, Avatar } from '../components/ui/Glass'
import { Icon } from '../components/ui/Icons'
import { api } from '../lib/apiClient'
import type { Employee } from '../lib/types'
import { normText } from '../features/import/normalize'
import { usePagesStore } from '../features/builder/usePagesStore'
import { useCompanyStore } from '../stores/useCompanyStore'
import { useNavStore } from '../stores/useNavStore'
import { useTourStore } from '../stores/useTourStore'
import { useThemeStore } from '../stores/useThemeStore'
import { useUiStore } from '../stores/useUiStore'
import { CompanyMark, NAV } from './Sidebar'

interface Item {
  id: string
  group: string
  label: string
  hint?: string
  icon: ReactNode
  keywords?: string
  run: () => void
}

/** ⌘K: sayfalara, şirketlere, çalışanlara ve sık işlemlere klavyeden ulaşım. */
export function CommandPalette({ open, onClose, onNewPage }: { open: boolean; onClose: () => void; onNewPage: () => void }) {
  const [q, setQ] = useState('')
  const [index, setIndex] = useState(0)
  const [employees, setEmployees] = useState<Employee[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const go = useNavStore((s) => s.go)
  const pages = usePagesStore((s) => s.pages)
  const { companies, switchCompany, activeCompanyId } = useCompanyStore()
  const { theme, setTheme } = useThemeStore()

  useEffect(() => {
    if (!open) return
    setQ('')
    setIndex(0)
    setTimeout(() => inputRef.current?.focus(), 10)
    api<Employee[]>('/api/employees').then(setEmployees).catch(() => setEmployees([]))
  }, [open, activeCompanyId])

  const items = useMemo<Item[]>(() => {
    const close = (fn: () => void) => () => { fn(); onClose() }
    return [
      ...NAV.map((n) => ({ id: `nav-${n.page}`, group: 'Sayfalar', label: n.label, icon: <Icon name={n.icon} size={16} />, run: close(() => go(n.page)) })),
      ...pages.map((p) => ({ id: `page-${p.id}`, group: 'Sayfalarım', label: p.title, icon: <span className="text-[14px]">{p.icon ?? '📊'}</span>, run: close(() => go(`custom:${p.id}`)) })),
      { id: 'tour', group: 'Yardım', label: 'Uygulama tanıtımı', icon: <Icon name="help" size={16} />, keywords: 'yardim tanitim nasil kullanilir ozellikler demo', run: close(() => useTourStore.getState().show()) },
      { id: 'nav-consolidated', group: 'Sayfalar', label: 'Tüm Şirketler (konsolide)', icon: <Icon name="buildings" size={16} />, keywords: 'konsolide toplam butun sirketler', run: close(() => go('consolidated')) },
      { id: 'nav-gallery', group: 'Sayfalar', label: 'Örnek Sayfalar', icon: <Icon name="gallery" size={16} />, keywords: 'sablon ornek galeri excel', run: close(() => go('gallery')) },
      { id: 'act-new-page', group: 'İşlemler', label: 'Yeni sayfa oluştur', icon: <Icon name="plus" size={16} />, keywords: 'olustur sayfa ekle', run: close(onNewPage) },
      { id: 'act-excel', group: 'İşlemler', label: "Excel'den veri yükle", icon: <Icon name="excel" size={16} />, keywords: 'excel yukle veri kumesi', run: close(() => go('datasets')) },
      { id: 'act-backup', group: 'İşlemler', label: 'Yedek al', icon: <Icon name="backup" size={16} />, keywords: 'yedek json', run: close(() => go('backup')) },
      { id: 'act-payroll', group: 'İşlemler', label: 'Bordroyu hesapla', icon: <Icon name="calculator" size={16} />, keywords: 'maas bordro hesapla', run: close(() => go('payroll')) },
      { id: 'act-sidebar', group: 'İşlemler', label: 'Kenar çubuğunu aç / kapat', hint: '⌘\\', icon: <Icon name="sidebar" size={16} />, keywords: 'menu daralt genislet', run: close(() => useUiStore.getState().toggleSidebar()) },
      { id: 'act-theme', group: 'İşlemler', label: theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç', icon: <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />, keywords: 'tema karanlik aydinlik', run: close(() => setTheme(theme === 'dark' ? 'light' : 'dark')) },
      ...companies.map((c, i) => ({ id: `co-${c.id}`, group: 'Şirketler', label: c.name, hint: c.id === activeCompanyId ? 'Aktif' : `⌘${i + 1}`, icon: <CompanyMark name={c.name} color={c.accentColor} size={20} />, run: close(() => switchCompany(c.id)) })),
      ...employees.map((e) => ({
        id: `emp-${e.id}`, group: 'Çalışanlar', label: `${e.firstName} ${e.lastName}`, hint: e.position ?? undefined,
        keywords: `${e.employeeNumber ?? ''} ${e.position ?? ''}`, icon: <Avatar name={`${e.firstName} ${e.lastName}`} size={20} />,
        run: close(() => go('employees', null, `${e.firstName} ${e.lastName}`)),
      })),
    ]
  }, [pages, companies, employees, activeCompanyId, theme, go, onClose, onNewPage, setTheme, switchCompany])

  const filtered = useMemo(() => {
    const term = normText(q)
    if (!term) return items.filter((i) => i.group !== 'Çalışanlar')
    return items
      .map((i) => {
        const hay = normText(`${i.label} ${i.keywords ?? ''} ${i.hint ?? ''}`)
        const score = hay.startsWith(term) ? 0 : hay.split(' ').some((w) => w.startsWith(term)) ? 1 : hay.includes(term) ? 2 : -1
        return { i, score }
      })
      .filter((x) => x.score >= 0)
      // Gruplar bir arada kalsın: en iyi eşleşmesi olan grup önce, grup içinde en iyi eşleşme önce
      .sort((a, b) => a.score - b.score)
      .reduce((groups, x) => {
        const g = groups.find((y) => y.name === x.i.group)
        if (g) g.items.push(x.i)
        else groups.push({ name: x.i.group, items: [x.i] })
        return groups
      }, [] as { name: string; items: Item[] }[])
      .flatMap((g) => g.items)
      .slice(0, 40)
  }, [items, q])

  useEffect(() => setIndex(0), [q])
  useEffect(() => { listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' }) }, [index])

  if (!open) return null

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(filtered.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[index]?.run() }
    else if (e.key === 'Escape') onClose()
  }

  let lastGroup = ''
  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[14vh] backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label="Komut paleti" className="animate-pop w-full max-w-xl overflow-hidden rounded-[18px] border border-[var(--glass-border)] bg-[var(--modal-bg)] shadow-[var(--shadow-pop)] backdrop-blur-2xl">
        <div className="flex items-center gap-2.5 border-b border-[var(--glass-border)] px-4">
          <Icon name="search" size={17} className="text-[var(--text-muted)]" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Sayfa, çalışan, şirket ya da işlem ara…"
            className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--text-faint)]" />
          <Kbd>esc</Kbd>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
          {filtered.length === 0 && <p className="px-3 py-8 text-center text-[13px] text-[var(--text-muted)]">Sonuç yok</p>}
          {filtered.map((it, i) => {
            const header = it.group !== lastGroup ? (lastGroup = it.group) : null
            return (
              <div key={it.id}>
                {header && <p className="px-2.5 pb-1 pt-2.5 text-[11px] font-semibold text-[var(--text-faint)]">{header}</p>}
                <button data-index={i} onMouseMove={() => setIndex(i)} onClick={it.run}
                  className={cx('flex h-9 w-full items-center gap-3 rounded-[10px] px-2.5 text-left text-[13.5px]', i === index ? 'bg-[var(--accent)] text-white' : 'text-[var(--text)]')}>
                  <span className={cx('grid w-5 place-items-center', i === index ? 'text-white' : 'text-[var(--text-muted)]')}>{it.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{it.label}</span>
                  {it.hint && <span className={cx('truncate text-[12px]', i === index ? 'text-white/80' : 'text-[var(--text-faint)]')}>{it.hint}</span>}
                  {i === index && <Icon name="chevronRight" size={14} />}
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-3 border-t border-[var(--glass-border)] px-4 py-2 text-[11px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> gezin</span>
          <span className="inline-flex items-center gap-1"><Kbd>↵</Kbd> aç</span>
        </div>
      </div>
    </div>
  )
}
