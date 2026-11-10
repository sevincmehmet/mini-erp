import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type BuiltinPage = 'dashboard' | 'consolidated' | 'employees' | 'shifts' | 'timesheet' | 'leaves' | 'finance' | 'cari' | 'payroll' | 'datasets' | 'gallery' | 'backup' | 'audit' | 'trash' | 'settings'
/** Kullanıcının oluşturduğu sayfalar "custom:<id>" olarak adreslenir. */
export type Page = BuiltinPage | `custom:${string}`

interface NavState {
  page: Page
  /** Sayfa açılır açılmaz yapılacak iş (ör. yeni sayfada Excel yükleme penceresini aç). */
  intent: 'excel' | null
  /** Hedef sayfada arama kutusuna yazılacak metin (komut paletinden çalışan seçince). */
  search: string | null
  go: (page: Page, intent?: 'excel' | null, search?: string | null) => void
  clearIntent: () => void
  clearSearch: () => void
}

export const useNavStore = create<NavState>()(
  persist(
    (set) => ({
      page: 'dashboard',
      intent: null,
      search: null,
      go: (page, intent = null, search = null) => set({ page, intent, search }),
      clearIntent: () => set({ intent: null }),
      clearSearch: () => set({ search: null }),
    }),
    { name: 'minierp-nav', partialize: (s) => ({ page: s.page }) },
  ),
)
