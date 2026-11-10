/**
 * Oturum anahtarı ve sunucu adresi. apiClient ile auth deposu arasındaki döngüsel bağımlılığı önlemek için ayrı modül.
 * Anahtar yalnızca bellekte tutulur; "Beni hatırla" seçiliyse işletim sisteminin anahtar zincirinde şifreli saklanır.
 */
let token: string | null = null
let onUnauthorized: (() => void) | null = null

const SERVER_KEY = 'minierp-server'
const DEFAULT_SERVER = import.meta.env.VITE_API_URL ?? 'https://localhost:5001'
const demo = () => (typeof window !== 'undefined' && window.api?.demo?.enabled ? window.api.demo : null)

export const session = {
  get token() { return token },
  setToken(value: string | null) { token = value },
  onUnauthorized(handler: () => void) { onUnauthorized = handler },
  unauthorized() { onUnauthorized?.() },
  /** Sunucusuz demo sürüm mü? (giriş bilgileri hazır, sunucu ayarı gizli) */
  get isDemo() { return Boolean(demo()) },
  get server(): string {
    const d = demo()
    if (d?.apiUrl) return d.apiUrl
    try { return localStorage.getItem(SERVER_KEY) || DEFAULT_SERVER } catch { return DEFAULT_SERVER }
  },
  setServer(url: string) {
    try { if (url.trim()) localStorage.setItem(SERVER_KEY, url.trim().replace(/\/+$/, '')); else localStorage.removeItem(SERVER_KEY) } catch { /* depolama kapalı */ }
  },
  defaultServer: DEFAULT_SERVER,
}
