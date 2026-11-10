import { create } from 'zustand'

export interface Toast {
  id: number
  tone: 'success' | 'error' | 'info'
  message: string
}

interface ToastState {
  toasts: Toast[]
  push: (tone: Toast['tone'], message: string) => void
  dismiss: (id: number) => void
}

let seq = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (tone, message) => {
    const id = ++seq
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, tone, message }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), tone === 'error' ? 7000 : 3500)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (m: string) => useToastStore.getState().push('success', m),
  error: (m: string) => useToastStore.getState().push('error', m),
  info: (m: string) => useToastStore.getState().push('info', m),
}
