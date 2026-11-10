import type { ReactNode } from 'react'
import { cx, Kbd, Segmented } from '../components/ui/Glass'
import { Icon, type IconName } from '../components/ui/Icons'
import { Tooltip } from '../components/ui/Tooltip'
import { usePagesStore } from '../features/builder/usePagesStore'
import { useCompanyStore } from '../stores/useCompanyStore'
import { useConnectionStore } from '../stores/useConnectionStore'
import { useNavStore, type BuiltinPage } from '../stores/useNavStore'
import { useThemeStore, type Theme } from '../stores/useThemeStore'
import { useUiStore } from '../stores/useUiStore'
import { UserMenu } from './UserMenu'
import { session } from '../lib/session'

type NavEntry = { page: BuiltinPage; label: string; icon: IconName; ownerOnly?: boolean }

/** Kenar çubuğu grupları. Komut paleti de bu listeyi kullanır. */
export const NAV_GROUPS: { title: string; items: NavEntry[] }[] = [
  { title: 'Genel', items: [
    { page: 'dashboard', label: 'Genel Bakış', icon: 'dashboard' },
  ] },
  { title: 'İnsan Kaynakları', items: [
    { page: 'employees', label: 'Personel', icon: 'employees' },
    { page: 'shifts', label: 'Vardiya Planı', icon: 'shifts' },
    { page: 'timesheet', label: 'Puantaj', icon: 'timesheet' },
    { page: 'leaves', label: 'İzinler', icon: 'beach' },
    { page: 'payroll', label: 'Bordro', icon: 'payroll' },
  ] },
  { title: 'Finans', items: [
    { page: 'finance', label: 'Gelir ve Gider', icon: 'finance' },
    { page: 'cari', label: 'Cari ve Vade', icon: 'handshake' },
  ] },
  { title: 'Analiz', items: [
    { page: 'datasets', label: 'Veri Kaynakları', icon: 'datasets' },
  ] },
  { title: 'Sistem', items: [
    { page: 'backup', label: 'Yedekleme', icon: 'backup' },
    { page: 'audit', label: 'Değişiklik Kaydı', icon: 'history' },
    { page: 'trash', label: 'Çöp Kutusu', icon: 'trashOpen' },
    { page: 'settings', label: 'Ayarlar', icon: 'gear' },
  ] },
]

export const NAV: NavEntry[] = NAV_GROUPS.flatMap((g) => g.items)

export const companyInitials = (name: string) => {
  const words = name.trim().split(/\s+/)
  const digits = name.match(/\d+/)?.[0]
  return (words.length > 1 ? words[0][0] + (digits ?? words[1][0]) : name.slice(0, 2)).toLocaleUpperCase('tr')
}

export function CompanyMark({ name, color, size = 26 }: { name: string; color: string | null; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-[8px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(0,0,0,0.15)]"
      style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(145deg, color-mix(in srgb, ${color ?? 'var(--accent)'} 82%, #fff), ${color ?? 'var(--accent)'})` }}>
      {companyInitials(name)}
    </span>
  )
}

const THEME_LABEL: Record<Theme, string> = { light: 'Açık', system: 'Sistem', dark: 'Koyu' }
const THEME_ICON: Record<Theme, IconName> = { light: 'sun', system: 'monitor', dark: 'moon' }
const NEXT_THEME: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' }

function Section({ title, collapsed, action, children }: { title: string; collapsed: boolean; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      {collapsed
        ? <div className="mx-auto mb-1.5 h-px w-7 bg-[var(--glass-border)]" aria-hidden />
        : (
          <div className="flex h-6 items-center justify-between px-2.5">
            <p className="text-[11px] font-semibold text-[var(--text-faint)]">{title}</p>
            {action}
          </div>
        )}
      <ul className={cx('flex flex-col gap-px', !collapsed && 'mt-0.5')}>{children}</ul>
    </section>
  )
}

function NavItem({ active, onClick, icon, label, trailing, collapsed, shortcut }: {
  active: boolean; onClick: () => void; icon: ReactNode; label: string; trailing?: ReactNode; collapsed: boolean; shortcut?: string
}) {
  return (
    <li>
      <Tooltip content={label} shortcut={shortcut} side="right" disabled={!collapsed} block>
        <button onClick={onClick} aria-current={active ? 'page' : undefined} aria-label={collapsed ? label : undefined}
          className={cx('group flex h-[32px] w-full items-center rounded-[8px] text-left text-[13px] transition-colors',
            collapsed ? 'justify-center' : 'gap-2.5 px-2.5',
            active ? 'bg-[var(--panel-bg)] font-medium text-[var(--text)] shadow-[0_0_0_0.5px_var(--panel-border),0_1px_2px_rgba(0,0,0,0.06)]'
              : 'text-[var(--text-2)] hover:bg-[var(--hover-strong)] hover:text-[var(--text)]')}>
          <span className={cx('grid w-[18px] place-items-center', active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-2)]')}>{icon}</span>
          {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
          {!collapsed && trailing}
        </button>
      </Tooltip>
    </li>
  )
}

export function Sidebar({ onNewPage, onSearch }: { onNewPage: () => void; onSearch: () => void }) {
  const { companies, activeCompanyId, switchCompany } = useCompanyStore()
  const { page, go } = useNavStore()
  const pages = usePagesStore((s) => s.pages)
  const { theme, setTheme } = useThemeStore()
  const online = useConnectionStore((s) => s.online)
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const isMac = window.api?.platform === 'darwin'
  const mod = isMac ? '⌘' : 'Ctrl+'
  const status = online == null ? 'Bağlanıyor…' : online ? 'Senkronize' : 'Çevrimdışı'

  return (
    <aside className={cx('flex min-h-0 shrink-0 flex-col overflow-hidden transition-[width] duration-200 ease-out', collapsed ? 'w-[76px]' : 'w-[244px]')}>
      {/* Başlık çubuğu yüksekliği navbar ile aynı: pencere buradan sürüklenir, macOS trafik ışıkları burada durur */}
      <div className={cx('drag shrink-0', isMac ? 'h-[52px]' : 'h-3')} />

      <div className={cx('flex items-center pb-3', collapsed ? 'justify-center' : 'gap-2.5 px-4')}>
        <Tooltip content="Mini-ERP · Yönetim ve Finans" side="right" disabled={!collapsed}>
          <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[linear-gradient(145deg,#3a3a3c,#1d1d1f)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_6px_rgba(0,0,0,0.2)]">
            <Icon name="layout" size={16} />
          </span>
        </Tooltip>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="flex items-center gap-1.5 text-[13.5px] font-semibold tracking-[-0.01em]">Mini-ERP
              {session.isDemo && <span className="rounded-[5px] bg-[var(--warning-bg)] px-1.5 py-px text-[9.5px] font-bold tracking-[0.04em] text-[var(--warning-text)]">DEMO</span>}
            </p>
            <p className="truncate text-[11px] text-[var(--text-muted)]">Yönetim ve Finans</p>
          </div>
        )}
      </div>

      <div className={cx('pb-2', collapsed ? 'flex justify-center' : 'px-3')}>
        <Tooltip content="Ara ya da git" shortcut={isMac ? '⌘K' : 'Ctrl K'} side="right" disabled={!collapsed} block={!collapsed}>
          <button onClick={onSearch} aria-label="Ara ya da git"
            className={cx('flex h-8 items-center rounded-[9px] bg-[var(--hover-strong)] text-[12.5px] text-[var(--text-muted)] transition hover:text-[var(--text)]',
              collapsed ? 'w-10 justify-center' : 'w-full gap-2 px-2.5')}>
            <Icon name="search" size={14} />
            {!collapsed && <><span className="flex-1 text-left">Ara ya da git…</span><Kbd>{isMac ? '⌘K' : 'Ctrl K'}</Kbd></>}
          </button>
        </Tooltip>
      </div>

      <div className={cx('min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden pb-3 pt-1', collapsed ? 'px-3' : 'px-2')}>
        <Section title="Şirketler" collapsed={collapsed}>
          {companies.length > 1 && (
            <NavItem collapsed={collapsed} active={page === 'consolidated'} onClick={() => go('consolidated')} label="Tüm Şirketler"
              icon={<span className="grid size-5 place-items-center rounded-[6px] bg-[var(--hover-strong)] text-[var(--text-2)]"><Icon name="buildings" size={13} /></span>} />
          )}
          {companies.map((c, i) => (
            <NavItem key={c.id} collapsed={collapsed} active={c.id === activeCompanyId && page !== 'consolidated'} onClick={() => { switchCompany(c.id); if (page === 'consolidated') go('dashboard') }} label={c.name}
              shortcut={i < 9 ? `${mod}${i + 1}` : undefined}
              icon={<CompanyMark name={c.name} color={c.accentColor} size={collapsed ? 24 : 20} />}
              trailing={i < 9 && <span className="text-[10.5px] text-[var(--text-faint)] opacity-0 transition group-hover:opacity-100">{mod}{i + 1}</span>} />
          ))}
        </Section>

        {NAV_GROUPS.filter((g) => g.title !== 'Sistem').map((g) => (
          <Section key={g.title} title={g.title} collapsed={collapsed}>
            {g.items.map((n) => <NavItem key={n.page} collapsed={collapsed} active={page === n.page} onClick={() => go(n.page)} label={n.label} icon={<Icon name={n.icon} size={17} />} />)}
          </Section>
        ))}

        <Section title="Sayfalarım" collapsed={collapsed} action={
          <Tooltip content="Yeni sayfa" side="right">
            <button onClick={onNewPage} aria-label="Yeni sayfa" className="grid size-5 place-items-center rounded-md text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"><Icon name="plus" size={14} strokeWidth={2} /></button>
          </Tooltip>
        }>
          <NavItem collapsed={collapsed} active={page === 'gallery'} onClick={() => go('gallery')} label="Örnek Sayfalar" icon={<Icon name="gallery" size={17} />} />
          {pages.map((p) => (
            <NavItem key={p.id} collapsed={collapsed} active={page === `custom:${p.id}`} onClick={() => go(`custom:${p.id}`)} label={p.title}
              icon={<span className="text-[14px] leading-none">{p.icon ?? '📊'}</span>} />
          ))}
          {collapsed && <NavItem collapsed active={false} onClick={onNewPage} label="Yeni sayfa" icon={<Icon name="plus" size={16} />} />}
        </Section>

        <Section title="Sistem" collapsed={collapsed}>
          {NAV_GROUPS.find((g) => g.title === 'Sistem')!.items.map((n) => <NavItem key={n.page} collapsed={collapsed} active={page === n.page} onClick={() => go(n.page)} label={n.label} icon={<Icon name={n.icon} size={17} />} />)}
        </Section>
      </div>

      <div className={cx('shrink-0 space-y-2 pb-3 pt-2 shadow-[0_-0.5px_0_var(--glass-border)]', collapsed ? 'flex flex-col items-center px-2' : 'px-2')}>
        <UserMenu collapsed={collapsed} />
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Tooltip content={status} side="right">
              <span className={cx('block size-2.5 rounded-full', online == null ? 'bg-[var(--text-faint)]' : online ? 'bg-[var(--success)]' : 'bg-[var(--danger)]')} aria-label={status} />
            </Tooltip>
            <Tooltip content={`Tema: ${THEME_LABEL[theme]} · tıklayınca ${THEME_LABEL[NEXT_THEME[theme]]}`} side="right">
              <button onClick={() => setTheme(NEXT_THEME[theme])} aria-label="Temayı değiştir" className="grid size-8 place-items-center rounded-[9px] text-[var(--text-muted)] hover:bg-[var(--hover-strong)] hover:text-[var(--text)]">
                <Icon name={THEME_ICON[theme]} size={16} />
              </button>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center justify-between px-2">
            <Tooltip content={online ? 'Sunucuya bağlı, veriler güncel' : 'Sunucuya ulaşılamıyor'}>
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--text-muted)]">
                <span className={cx('size-2 rounded-full', online == null ? 'bg-[var(--text-faint)]' : online ? 'bg-[var(--success)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--success)_20%,transparent)]' : 'bg-[var(--danger)]')} />
                {status}
              </span>
            </Tooltip>
            <Segmented<Theme> size="sm" value={theme} onChange={setTheme} options={(['light', 'system', 'dark'] as Theme[]).map((t) => ({
              value: t, label: <Icon name={THEME_ICON[t]} size={13} />, title: `${THEME_LABEL[t]} tema`,
            }))} />
          </div>
        )}
      </div>
    </aside>
  )
}
