import { useCallback, useEffect, useState } from 'react'
import { api } from './apiClient'
import { useCompanyStore } from '../stores/useCompanyStore'

interface ApiState<T> {
  data: T | undefined
  error: string | undefined
  loading: boolean
  /** Kayıt ekleme/güncelleme sonrası veriyi yeniden çeker. */
  reload: () => void
}

/** Aktif şirket ya da yol değiştikçe veriyi yeniden çeker; şirket değişince eski veri temizlenir. */
export function useApi<T>(path: string | null): ApiState<T> {
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const [nonce, setNonce] = useState(0)
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean; key?: string }>({ loading: true })

  useEffect(() => {
    if (!path || !companyId) return
    let cancelled = false
    setState((s) => ({ ...s, data: s.key?.startsWith(companyId) ? s.data : undefined, loading: true, error: undefined }))
    api<T>(path)
      .then((data) => !cancelled && setState({ data, loading: false, key: `${companyId}:${path}` }))
      .catch((e: unknown) => !cancelled && setState({ error: e instanceof Error ? e.message : 'Hata', loading: false }))
    return () => {
      cancelled = true
    }
  }, [path, companyId, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { data: state.data, error: state.error, loading: state.loading, reload }
}
