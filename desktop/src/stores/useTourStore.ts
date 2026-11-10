import { create } from 'zustand'

/** Uygulama tanıtımı penceresi: navbar, kullanıcı menüsü, komut paleti ve giriş ekranından açılır. */
export const useTourStore = create<{ open: boolean; show: () => void; hide: () => void }>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))
