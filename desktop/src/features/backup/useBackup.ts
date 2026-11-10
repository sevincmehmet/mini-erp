import { useState } from 'react'
import { api } from '../../lib/apiClient'
import type { BackupPayload } from '../../types/electron'

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; message: string } | { kind: 'error'; message: string }

/**
 * Akış: API'den aktif şirketin verisini çek → Electron köprüsüne ver →
 * ana süreç diske (JSON) ya da Excel'e yazar.
 */
export function useBackup() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const bridge = window.api

  /** true: dosya kaydedildi */
  async function run(action: 'quickSave' | 'saveJson' | 'excel'): Promise<boolean> {
    if (!bridge) {
      setStatus({ kind: 'error', message: 'Yedekleme yalnızca masaüstü uygulamasında kullanılabilir.' })
      return false
    }
    setStatus({ kind: 'busy' })
    try {
      const payload = await api<BackupPayload>('/api/backup/export')
      const result =
        action === 'excel' ? await bridge.excel.export(payload)
        : action === 'saveJson' ? await bridge.backup.saveJson(payload)
        : await bridge.backup.quickSave(payload)

      if (!result.ok) { setStatus({ kind: 'error', message: result.error }); return false }
      if (result.canceled) { setStatus({ kind: 'idle' }); return false }
      setStatus({ kind: 'done', message: `Kaydedildi: ${result.filePath}` })
      return true
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Bilinmeyen hata' })
      return false
    }
  }

  return { status, run, isDesktop: Boolean(bridge), revealFolder: () => bridge?.backup.revealFolder() }
}
