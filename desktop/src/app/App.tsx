import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Toaster } from '../components/ui/Toaster'
import { NavbarSlotContext } from '../components/ui/Navbar'
import { BackupPage } from '../features/backup/BackupPanel'
import { CustomPageView } from '../features/builder/CustomPageView'
import { DatasetsPage } from '../features/builder/DatasetsPage'
import { NewPageDialog } from '../features/builder/NewPageDialog'
import { useDatasetsStore } from '../features/builder/sources'
import { usePagesStore } from '../features/builder/usePagesStore'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { FinancePage } from '../features/finance/FinancePage'
import { EmployeesPage } from '../features/hr/EmployeesPage'
import { PayrollPage } from '../features/payroll/PayrollPage'
import { ShiftsPage } from '../features/shifts/ShiftsPage'
import { TimesheetPage } from '../features/timesheet/TimesheetPage'
import { api } from '../lib/apiClient'
import { useActiveCompany, useCompanyStore, type Company } from '../stores/useCompanyStore'
import { useConnectionStore } from '../stores/useConnectionStore'
import { useNavStore, type BuiltinPage } from '../stores/useNavStore'
import { applyTheme, useThemeStore } from '../stores/useThemeStore'
import { CommandPalette } from './CommandPalette'
import { Sidebar } from './Sidebar'
import { NotificationBell } from './NotificationBell'
import { ProductTour } from '../features/tour/ProductTour'
import { useTourStore } from '../stores/useTourStore'
import { LockScreen, LoginScreen, SetupScreen, useIdleLock } from '../features/auth/AuthScreens'
import { useAuthStore } from '../stores/useAuthStore'
import { useAutoBackup } from '../features/backup/useAutoBackup'
import { ConsolidatedPage } from '../features/consolidated/ConsolidatedPage'
import { CariPage } from '../features/cari/CariPage'
import { LeavesPage } from '../features/leaves/LeavesPage'
import { AuditPage } from '../features/system/AuditPage'
import { TrashPage } from '../features/system/TrashPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { OnboardingWizard } from '../features/auth/OnboardingWizard'
import { useDatasetWatch } from '../features/builder/useDatasetWatch'
import { Icon } from '../components/ui/Icons'
import { Tooltip } from '../components/ui/Tooltip'
import { useUiStore } from '../stores/useUiStore'
import { GalleryPage } from '../features/builder/GalleryPage'

const PAGES: Record<BuiltinPage, () => ReactNode> = {
  dashboard: DashboardPage,
  consolidated: ConsolidatedPage,
  employees: EmployeesPage,
  leaves: LeavesPage,
  cari: CariPage,
  audit: AuditPage,
  trash: TrashPage,
  settings: SettingsPage,
  shifts: ShiftsPage,
  timesheet: TimesheetPage,
  finance: FinancePage,
  payroll: PayrollPage,
  datasets: DatasetsPage,
  gallery: GalleryPage,
  backup: BackupPage,
}

/** Oturum kapısı: kurulum / giriş / kilit ekranları; oturum açıkken uygulama. */
export function App() {
  const status = useAuthStore((s) => s.status)
  const boot = useAuthStore((s) => s.boot)
  const theme = useThemeStore((s) => s.theme)
  useEffect(() => applyTheme(theme), [theme])
  useEffect(() => { if (window.api?.platform === 'darwin') document.documentElement.classList.add('vibrant') }, [])
  useEffect(() => { void boot() }, [boot])

  if (status === 'checking') return <div className="drag grid h-screen place-items-center bg-[var(--base-bg)]"><div className="skeleton size-10 rounded-full" /></div>
  if (status === 'setup') return <SetupScreen />
  if (status === 'login') return <LoginScreen />
  return (
    <>
      <Workspace />
      {status === 'locked' && <LockScreen />}
    </>
  )
}

function Workspace() {
  const setCompanies = useCompanyStore((s) => s.setCompanies)
  const companies = useCompanyStore((s) => s.companies)
  const switchCompany = useCompanyStore((s) => s.switchCompany)
  const company = useActiveCompany()
  const { page, go } = useNavStore()
  const tour = useTourStore()
  const lockMinutes = useUiStore((s) => s.lockMinutes)
  const lock = useAuthStore((s) => s.lock)
  const user = useAuthStore((s) => s.user)
  const onboarded = useUiStore((s) => (user ? !!s.onboarded[user.id] : true))
  useIdleLock(lockMinutes)
  useAutoBackup()
  useDatasetWatch()
  const setOnline = useConnectionStore((s) => s.set)
  const pages = usePagesStore((s) => s.pages)
  const refreshPages = usePagesStore((s) => s.refresh)
  const refreshDatasets = useDatasetsStore((s) => s.refresh)
  const [newPageOpen, setNewPageOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const [navSlot, setNavSlot] = useState<HTMLElement | null>(null)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const collapsed = useUiStore((s) => s.sidebarCollapsed)

  // Şirket rengi köke yazılır: türetilen tonlar (--accent-soft, --accent-text…) da ona göre hesaplanır
  useEffect(() => {
    const root = document.documentElement
    if (company?.accentColor) root.style.setProperty('--accent', company.accentColor)
    else root.style.removeProperty('--accent')
  }, [company?.accentColor])

  // Şirket listesi + bağlantı durumu (30 sn'de bir yoklanır)
  useEffect(() => {
    let first = true
    const ping = () => api<Company[]>('/api/companies')
      .then((list) => { setOnline(true); if (first) { setCompanies(list); first = false } })
      .catch(() => setOnline(false))
    void ping()
    const t = setInterval(ping, 30_000)
    return () => clearInterval(t)
  }, [setCompanies, setOnline])

  // Kullanıcı sayfaları ve veri kümeleri şirkete özeldir: şirket değişince yeniden yükle
  useEffect(() => {
    if (!company) return
    void refreshPages()
    void refreshDatasets()
  }, [company?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const customId = page.startsWith('custom:') ? page.slice(7) : null
  useEffect(() => {
    if (customId && pages.length && !pages.some((p) => p.id === customId)) go('dashboard')
  }, [customId, pages, go])

  // Klavye: ⌘K komut paleti, ⌘1–9 şirket geçişi
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((o) => !o) }
      if (e.key === '\\') { e.preventDefault(); toggleSidebar() }
      if (e.key.toLowerCase() === 'l') { e.preventDefault(); lock() }
      const n = Number(e.key)
      if (n >= 1 && n <= 9 && companies[n - 1]) { e.preventDefault(); switchCompany(companies[n - 1].id) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [companies, switchCompany, toggleSidebar, lock])

  // Kaydırınca başlık çubuğu buzlu cama dönüşür
  const onScroll = useCallback(() => {
    const el = mainRef.current
    if (el) el.dataset.scrolled = String(el.scrollTop > 6)
  }, [])
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); onScroll() }, [page, company?.id, onScroll])

  const Current = customId ? null : PAGES[page as BuiltinPage] ?? DashboardPage

  return (
    <div className="app-shell flex h-screen overflow-hidden text-[var(--text)]">
      <Sidebar onNewPage={() => setNewPageOpen(true)} onSearch={() => setPaletteOpen(true)} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Üst gezinme çubuğu (alt katman): sayfa başlığı ve sayfaya özel düğmeler buraya gelir */}
        <header className="app-navbar drag relative z-30 flex h-[52px] shrink-0 items-center gap-2 pl-3 pr-4">
          <Tooltip content={collapsed ? 'Kenar çubuğunu aç' : 'Kenar çubuğunu kapat'} shortcut={window.api?.platform === 'darwin' ? '⌘\\' : 'Ctrl \\'} side="bottom">
            <button onClick={toggleSidebar} aria-label="Kenar çubuğunu aç/kapat" aria-expanded={!collapsed}
              className="grid size-8 place-items-center rounded-[9px] text-[var(--text-muted)] transition hover:bg-[var(--hover-strong)] hover:text-[var(--text)]">
              <Icon name="sidebar" size={17} />
            </button>
          </Tooltip>
          <div ref={setNavSlot} className="flex min-w-0 flex-1 items-center gap-3 pl-1" />
          <span className="mx-1 h-5 w-px bg-[var(--glass-border)]" />
          <Tooltip content="Uygulama tanıtımı" side="bottom">
            <button onClick={tour.show} aria-label="Uygulama tanıtımı"
              className="grid size-8 place-items-center rounded-[9px] text-[var(--text-muted)] transition hover:bg-[var(--hover-strong)] hover:text-[var(--text)]">
              <Icon name="help" size={18} />
            </button>
          </Tooltip>
          <NotificationBell />
          {/* Windows/Linux: sağ üstte sistem pencere düğmeleri için yer */}
          {window.api && window.api.platform !== 'darwin' && <span className="w-[138px] shrink-0" aria-hidden />}
        </header>

        {/* Üst katman: sayfa paneli */}
        <main ref={mainRef} onScroll={onScroll} className="app-panel relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <NavbarSlotContext.Provider value={navSlot}>
            <div key={`${company?.id}-${page}`} className="animate-page mx-auto max-w-6xl px-7 pb-14 pt-5">
              {customId ? <CustomPageView pageId={customId} /> : Current && <Current />}
            </div>
          </NavbarSlotContext.Provider>
        </main>
      </div>

      <Toaster />
      <NewPageDialog open={newPageOpen} onClose={() => setNewPageOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNewPage={() => setNewPageOpen(true)} />
      {!onboarded && <OnboardingWizard />}
      <ProductTour open={tour.open} onClose={tour.hide} onGo={(p) => go(p)} />
    </div>
  )
}
