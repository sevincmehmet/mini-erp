import { create } from 'zustand'

/** Sunucu bağlantısı: kenar çubuğundaki durum göstergesi için. */
export const useConnectionStore = create<{ online: boolean | null; set: (v: boolean) => void }>((set) => ({
  online: null,
  set: (online) => set({ online }),
}))
