import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Bu bilgisayara özel arayüz tercihleri. */
interface UiState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  /** Hareketsizlikte otomatik kilit (dakika, 0 = kapalı) */
  lockMinutes: number
  setLockMinutes: (m: number) => void
  /** Otomatik yedek: açılışta ve 24 saatte bir */
  autoBackup: boolean
  keepBackups: number
  setAutoBackup: (on: boolean, keep?: number) => void
  /** Kullanıcı başına tamamlanan ilk kurulum sihirbazı */
  onboarded: Record<string, boolean>
  setOnboarded: (userId: string) => void
  /** Veri kümesi → izlenen Excel dosyası yolu (bu bilgisayara özel) */
  watchedFiles: Record<string, { path: string; headerRow: number; sheet: string }>
  setWatchedFile: (datasetId: string, info: { path: string; headerRow: number; sheet: string } | null) => void
}

export const useUiStore = create<UiState>()(
  persist((set) => ({
    sidebarCollapsed: false,
    toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    lockMinutes: 15,
    setLockMinutes: (lockMinutes) => set({ lockMinutes }),
    autoBackup: true,
    keepBackups: 30,
    setAutoBackup: (autoBackup, keep) => set((s) => ({ autoBackup, keepBackups: keep ?? s.keepBackups })),
    onboarded: {},
    setOnboarded: (userId) => set((s) => ({ onboarded: { ...s.onboarded, [userId]: true } })),
    watchedFiles: {},
    setWatchedFile: (id, info) => set((s) => {
      const next = { ...s.watchedFiles }
      if (info) next[id] = info
      else delete next[id]
      return { watchedFiles: next }
    }),
  }), { name: 'minierp-ui' }),
)
