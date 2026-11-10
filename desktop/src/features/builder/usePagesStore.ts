import { create } from 'zustand'
import { api, send } from '../../lib/apiClient'
import type { CustomPage, PageLayout, Widget } from './types'

export interface PageSummary {
  id: string
  title: string
  icon: string | null
  sortOrder: number
}

interface PagesState {
  pages: PageSummary[]
  refresh: () => Promise<void>
  create: (title: string, icon: string, widgets?: Widget[]) => Promise<CustomPage>
}

export const usePagesStore = create<PagesState>((set, get) => ({
  pages: [],
  refresh: async () => {
    try { set({ pages: await api<PageSummary[]>('/api/pages') }) } catch { set({ pages: [] }) }
  },
  create: async (title, icon, widgets = []) => {
    const layout: PageLayout = { widgets }
    const page = await send<CustomPage>('POST', '/api/pages', { title, icon, layout })
    await get().refresh()
    return page
  },
}))
