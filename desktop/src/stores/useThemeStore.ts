import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'system' | 'light' | 'dark'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeState>()(
  persist((set) => ({ theme: 'system', setTheme: (theme) => set({ theme }) }), { name: 'minierp-theme' }),
)

/** <html data-theme="..."> günceller; "system" seçiliyse işletim sistemini takip eder. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  // Yerel pencere (macOS buzlu cam, diyaloglar) de aynı temayı kullansın
  window.api?.setTheme(theme).catch(() => {})
}
