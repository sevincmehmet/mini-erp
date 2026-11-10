import { create } from 'zustand'
import { api, send } from '../lib/apiClient'
import { session } from '../lib/session'

export type CompanyRole = 'Owner' | 'Manager' | 'Viewer'

export interface Me {
  id: string
  fullName: string
  email: string
  companies: { id: string; name: string; accentColor: string | null; role: CompanyRole }[]
}

interface LoginResult {
  token: string
  expiresAt: string
  user: Me
}

type Status = 'checking' | 'setup' | 'login' | 'locked' | 'ready'

interface AuthState {
  status: Status
  user: Me | null
  /** Giriş ekranında gösterilecek bilgi (ör. "Oturum süresi doldu") */
  notice: string | null
  boot: () => Promise<void>
  setup: (fullName: string, email: string, password: string) => Promise<void>
  login: (email: string, password: string, remember: boolean) => Promise<void>
  unlock: (password: string) => Promise<void>
  lock: () => void
  logout: (notice?: string) => Promise<void>
  refreshMe: () => Promise<void>
  replaceToken: (r: LoginResult) => Promise<void>
}

const REMEMBER_FLAG = 'minierp-remember'

async function persist(r: LoginResult, remember: boolean) {
  try { localStorage.setItem(REMEMBER_FLAG, remember ? '1' : '0') } catch { /* yok say */ }
  if (remember) await window.api?.secure.set(JSON.stringify({ token: r.token, expiresAt: r.expiresAt }))
  else await window.api?.secure.clear()
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'checking',
  user: null,
  notice: null,

  /** Açılış: kayıtlı oturum varsa ve süresi dolmadıysa doğrudan girer; yoksa kurulum ya da giriş ekranı. */
  boot: async () => {
    session.onUnauthorized(() => {
      if (get().status === 'ready' || get().status === 'locked') void get().logout('Oturumunuz sona erdi; lütfen tekrar giriş yapın.')
    })
    try {
      const saved = await window.api?.secure.get()
      const value = saved && saved.ok && !saved.canceled ? saved.value : null
      if (value) {
        const { token, expiresAt } = JSON.parse(value) as { token: string; expiresAt: string }
        if (new Date(expiresAt).getTime() > Date.now() + 60_000) {
          session.setToken(token)
          const user = await api<Me>('/api/auth/me')
          set({ status: 'ready', user, notice: null })
          return
        }
      }
    } catch { /* kayıtlı oturum geçersiz */ }
    session.setToken(null)
    try {
      const { hasUsers } = await api<{ hasUsers: boolean }>('/api/auth/status')
      set({ status: hasUsers ? 'login' : 'setup' })
    } catch {
      set({ status: 'login', notice: 'Sunucuya ulaşılamadı. Sunucu adresini kontrol edin.' })
    }
  },

  setup: async (fullName, email, password) => {
    const r = await send<LoginResult>('POST', '/api/auth/setup', { fullName, email, password })
    session.setToken(r.token)
    await persist(r, true)
    set({ status: 'ready', user: r.user, notice: null })
  },

  login: async (email, password, remember) => {
    const r = await send<LoginResult>('POST', '/api/auth/login', { email, password })
    session.setToken(r.token)
    await persist(r, remember)
    set({ status: 'ready', user: r.user, notice: null })
  },

  /** Kilit ekranı: aynı kullanıcı şifresiyle yeni oturum anahtarı alır. */
  unlock: async (password) => {
    const user = get().user
    if (!user) return
    let remember = true
    try { remember = localStorage.getItem(REMEMBER_FLAG) !== '0' } catch { /* yok say */ }
    await get().login(user.email, password, remember)
  },

  lock: () => { if (get().status === 'ready') set({ status: 'locked' }) },

  logout: async (notice) => {
    session.setToken(null)
    await window.api?.secure.clear()
    set({ status: 'login', user: null, notice: notice ?? null })
  },

  refreshMe: async () => set({ user: await api<Me>('/api/auth/me') }),

  replaceToken: async (r) => {
    session.setToken(r.token)
    let remember = true
    try { remember = localStorage.getItem(REMEMBER_FLAG) !== '0' } catch { /* yok say */ }
    await persist(r, remember)
    set({ user: r.user })
  },
}))

/** Aktif şirketteki rol (Sahip / Yönetici / Salt okuma). */
export function roleIn(user: Me | null, companyId: string | null): CompanyRole | null {
  return user?.companies.find((c) => c.id === companyId)?.role ?? null
}
