import { useEffect } from 'react'
import { api } from '../../lib/apiClient'
import { useAuthStore } from '../../stores/useAuthStore'
import { useCompanyStore } from '../../stores/useCompanyStore'
import { useUiStore } from '../../stores/useUiStore'
import type { BackupPayload } from '../../types/electron'

const LAST_KEY = 'minierp-last-backup'
const DAY = 86400000

export function lastBackups(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}') } catch { return {} }
}

export function markBackup(companyId: string) {
  try {
    const all = lastBackups()
    all[companyId] = new Date().toISOString()
    localStorage.setItem(LAST_KEY, JSON.stringify(all))
  } catch { /* depolama kapalı */ }
}

/**
 * Otomatik yedek: uygulama açıkken her şirket için 24 saatte bir sessizce yedek alır
 * (Belgeler/MiniErp-Yedek) ve en yeni N yedeği bırakıp eskileri siler.
 */
export function useAutoBackup() {
  const status = useAuthStore((s) => s.status)
  const companies = useCompanyStore((s) => s.companies)
  const { autoBackup, keepBackups } = useUiStore()

  useEffect(() => {
    const bridge = window.api
    if (!bridge || status !== 'ready' || !autoBackup || companies.length === 0) return
    let cancelled = false
    const run = async () => {
      const last = lastBackups()
      for (const c of companies) {
        if (cancelled) return
        if (last[c.id] && Date.now() - new Date(last[c.id]).getTime() < DAY) continue
        try {
          const payload = await api<BackupPayload>('/api/backup/export', { headers: { 'X-Company-Id': c.id } })
          const res = await bridge.backup.quickSave(payload)
          if (res.ok && !res.canceled) {
            markBackup(c.id)
            await bridge.backup.prune({ companyName: payload.company.name, keep: keepBackups })
          }
        } catch { /* bir sonraki denemede tekrar */ }
      }
    }
    const first = setTimeout(run, 8000) // açılışı yavaşlatmasın
    const timer = setInterval(run, 60 * 60_000)
    return () => { cancelled = true; clearTimeout(first); clearInterval(timer) }
  }, [status, companies, autoBackup, keepBackups])
}
