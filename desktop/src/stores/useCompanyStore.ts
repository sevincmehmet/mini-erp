import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Company {
  id: string
  name: string
  currency: string
  accentColor: string | null
}

interface CompanyState {
  companies: Company[]
  activeCompanyId: string | null
  setCompanies: (companies: Company[]) => void
  switchCompany: (id: string) => void
}

/**
 * Aktif şirket tüm uygulamanın "bağlamı"dır. apiClient her istekte bunu
 * X-Company-Id header'ı olarak gönderir; seçim yeniden açılışta hatırlanır.
 */
export const useCompanyStore = create<CompanyState>()(
  persist(
    (set, get) => ({
      companies: [],
      activeCompanyId: null,
      setCompanies: (companies) => {
        const current = get().activeCompanyId
        const stillValid = companies.some((c) => c.id === current)
        set({ companies, activeCompanyId: stillValid ? current : (companies[0]?.id ?? null) })
      },
      switchCompany: (id) => set({ activeCompanyId: id }),
    }),
    { name: 'minierp-company', partialize: (s) => ({ activeCompanyId: s.activeCompanyId }) },
  ),
)

export const useActiveCompany = () =>
  useCompanyStore((s) => s.companies.find((c) => c.id === s.activeCompanyId) ?? null)
