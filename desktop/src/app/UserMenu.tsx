import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Avatar, cx } from '../components/ui/Glass'
import { Icon, type IconName } from '../components/ui/Icons'
import { Tooltip } from '../components/ui/Tooltip'
import { roleIn, useAuthStore, type CompanyRole } from '../stores/useAuthStore'
import { useCompanyStore } from '../stores/useCompanyStore'
import { useNavStore } from '../stores/useNavStore'
import { useTourStore } from '../stores/useTourStore'

export const ROLE_LABEL: Record<CompanyRole, string> = { Owner: 'Sahip', Manager: 'Yönetici', Viewer: 'Salt okuma' }

/** Kenar çubuğunun altındaki kullanıcı kartı ve menüsü. */
export function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { user, lock, logout } = useAuthStore()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const go = useNavStore((s) => s.go)
  const [rect, setRect] = useState<DOMRect | null>(null)
  if (!user) return null
  const role = roleIn(user, companyId)
  const isMac = window.api?.platform === 'darwin'

  const item = (icon: IconName, label: string, onClick: () => void, hint?: string, danger?: boolean) => (
    <button onClick={() => { setRect(null); onClick() }}
      className={cx('flex h-8 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[13px] hover:bg-[var(--hover)]', danger && 'text-[var(--danger)]')}>
      <Icon name={icon} size={15} className={danger ? '' : 'text-[var(--text-muted)]'} />
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[11px] text-[var(--text-faint)]">{hint}</span>}
    </button>
  )

  return (
    <>
      <Tooltip content={`${user.fullName} · ${role ? ROLE_LABEL[role] : ''}`} side="right" disabled={!collapsed} block={!collapsed}>
        <button onClick={(e) => setRect(e.currentTarget.getBoundingClientRect())} aria-label="Kullanıcı menüsü"
          className={cx('flex items-center rounded-[10px] transition hover:bg-[var(--hover-strong)]', collapsed ? 'size-10 justify-center' : 'w-full gap-2.5 px-2 py-1.5')}>
          <Avatar name={user.fullName} size={collapsed ? 28 : 30} />
          {!collapsed && (
            <span className="min-w-0 flex-1 text-left leading-tight">
              <span className="block truncate text-[12.5px] font-medium">{user.fullName}</span>
              <span className="block truncate text-[11px] text-[var(--text-muted)]">{role ? ROLE_LABEL[role] : user.email}</span>
            </span>
          )}
          {!collapsed && <Icon name="chevronUpDown" size={14} className="text-[var(--text-faint)]" />}
        </button>
      </Tooltip>
      {rect && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setRect(null)} />
          <div className="animate-pop fixed z-[61] w-60 rounded-[14px] border border-[var(--glass-border)] bg-[var(--modal-bg)] p-1.5 shadow-[var(--shadow-pop)] backdrop-blur-2xl"
            style={{ left: rect.left, bottom: window.innerHeight - rect.top + 6 }}>
            <div className="flex items-center gap-2.5 px-2.5 pb-2 pt-1.5">
              <Avatar name={user.fullName} size={34} />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[13px] font-semibold">{user.fullName}</p>
                <p className="truncate text-[11.5px] text-[var(--text-muted)]">{user.email}</p>
              </div>
            </div>
            <div className="my-1 h-px bg-[var(--glass-border)]" />
            {item('key', 'Şifreyi değiştir', () => go('settings'))}
            {item('gear', 'Ayarlar', () => go('settings'))}
            {item('help', 'Uygulama tanıtımı', () => useTourStore.getState().show())}
            {item('lock', 'Kilitle', lock, isMac ? '⌘L' : 'Ctrl L')}
            <div className="my-1 h-px bg-[var(--glass-border)]" />
            {item('logout', 'Çıkış yap', () => void logout(), undefined, true)}
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
