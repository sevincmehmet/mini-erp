import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface TableView {
  order: string[]
  hidden: string[]
  sort?: { key: string; dir: 'asc' | 'desc' }
  pageSize?: number
}

export interface DashboardWidgetView {
  id: string
  size: number // 12'lik ızgarada genişlik
  hidden?: boolean
}

interface ViewState {
  tables: Record<string, TableView>
  dashboard: DashboardWidgetView[] | null
  /** Excel içe aktarımında son kullanılan sütun eşleştirmeleri: tür → alan → Excel başlığı */
  importMappings: Record<string, Record<string, string>>
  setTable: (id: string, view: TableView) => void
  resetTable: (id: string) => void
  setDashboard: (widgets: DashboardWidgetView[] | null) => void
  setImportMapping: (kind: string, mapping: Record<string, string>) => void
}

/**
 * Kişisel görünüm tercihleri (sütun sırası, gizlenen sütunlar, Genel Bakış düzeni).
 * Bu bilgisayarda saklanır; şirket verisi değildir, yedeğe girmez.
 */
export const useViewStore = create<ViewState>()(
  persist(
    (set) => ({
      tables: {},
      dashboard: null,
      importMappings: {},
      setTable: (id, view) => set((s) => ({ tables: { ...s.tables, [id]: view } })),
      resetTable: (id) => set((s) => {
        const { [id]: _removed, ...rest } = s.tables
        return { tables: rest }
      }),
      setDashboard: (dashboard) => set({ dashboard }),
      setImportMapping: (kind, mapping) => set((s) => ({ importMappings: { ...s.importMappings, [kind]: mapping } })),
    }),
    { name: 'minierp-view' },
  ),
)
