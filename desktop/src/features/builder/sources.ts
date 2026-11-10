import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { api } from '../../lib/apiClient'
import { useCompanyStore } from '../../stores/useCompanyStore'
import { resolveRange } from './engine'
import type { DatasetSummary, RangePreset, SourceRef, SystemSourceKey, TabularData } from './types'
import { sampleData, SAMPLE_PAGES } from './samples'

export const SYSTEM_SOURCES: { key: SystemSourceKey; name: string; icon: string; dateColumn?: string; description: string }[] = [
  { key: 'gelir-gider', name: 'Gelir ve Gider', icon: '₺', dateColumn: 'tarih', description: 'Tüm gelir/gider hareketleri, kategorileriyle' },
  { key: 'puantaj', name: 'Puantaj', icon: '⏱', dateColumn: 'tarih', description: 'Giriş-çıkış, çalışılan saat, fazla mesai' },
  { key: 'bordro', name: 'Bordrolar', icon: '📄', dateColumn: 'donem', description: 'Aylık brüt/net ücretler' },
  { key: 'vardiya', name: 'Vardiya Planı', icon: '📅', dateColumn: 'tarih', description: 'Planlanan ve gerçekleşen vardiyalar' },
  { key: 'personel', name: 'Personel', icon: '👥', dateColumn: 'iseGiris', description: 'Çalışan listesi ve ücretleri' },
]

export const sourceKey = (s: SourceRef) => (s.kind === 'system' ? `system:${s.key}` : `${s.kind}:${s.id}`)

export function parseSourceKey(key: string): SourceRef | undefined {
  const [kind, id] = key.split(':')
  if (kind === 'system' && SYSTEM_SOURCES.some((s) => s.key === id)) return { kind, key: id as SystemSourceKey }
  if (kind === 'dataset' && id) return { kind, id }
  return undefined
}

/** Sistem kaynaklarında tarih aralığı sunucuda uygulanır; veri kümelerinde istemcide. */
export const rangeOnClient = (s?: SourceRef) => !!s && s.kind !== 'system'

export const defaultDateColumn = (s?: SourceRef) => (s?.kind === 'system' ? SYSTEM_SOURCES.find((x) => x.key === s.key)?.dateColumn : undefined)

// ------------------------------------------------------------ veri kümeleri listesi (kenar çubuğu, düzenleyici)
interface DatasetsState {
  list: DatasetSummary[]
  loaded: boolean
  refresh: () => Promise<void>
}

export const useDatasetsStore = create<DatasetsState>((set) => ({
  list: [],
  loaded: false,
  refresh: async () => {
    try {
      set({ list: await api<DatasetSummary[]>('/api/datasets'), loaded: true })
    } catch {
      set({ loaded: true })
    }
  },
}))

export function sourceName(s: SourceRef | undefined, datasets: DatasetSummary[]) {
  if (!s) return 'Kaynak seçilmedi'
  if (s.kind === 'system') return SYSTEM_SOURCES.find((x) => x.key === s.key)?.name ?? s.key
  if (s.kind === 'sample') return `${SAMPLE_PAGES.find((x) => x.id === s.id)?.title ?? 'Örnek'} (örnek veri)`
  return datasets.find((d) => d.id === s.id)?.name ?? 'Silinmiş veri kümesi'
}

// ------------------------------------------------------------ veri çekme (önbellekli)
const cache = new Map<string, { at: number; promise: Promise<TabularData> }>()
const TTL = 60_000

/** Önbellek temizlenince açık bileşenlerin veriyi yeniden çekmesi için sürüm sayacı. */
const useSourceVersion = create<{ v: number; bump: () => void }>((set) => ({ v: 0, bump: () => set((s) => ({ v: s.v + 1 })) }))

/** Bir veri kümesi güncellendiğinde ya da kayıt eklendiğinde önbelleği temizler. */
export function invalidateSources(prefix = '') {
  for (const k of cache.keys()) if (k.includes(prefix)) cache.delete(k)
  useSourceVersion.getState().bump()
}

function load(companyId: string, s: SourceRef, range: RangePreset): Promise<TabularData> {
  if (s.kind === 'sample') {
    const data = sampleData(s.id)
    return data ? Promise.resolve(data) : Promise.reject(new Error('Örnek bulunamadı'))
  }
  const r = s.kind === 'system' ? resolveRange(range) : {}
  const key = `${companyId}|${sourceKey(s)}|${r.from ?? ''}|${r.to ?? ''}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.promise

  const qs = new URLSearchParams()
  if (r.from) qs.set('from', r.from)
  if (r.to) qs.set('to', r.to)
  const promise = s.kind === 'system'
    ? api<TabularData>(`/api/sources/${s.key}${qs.size ? `?${qs}` : ''}`)
    : api<TabularData & { name: string }>(`/api/datasets/${s.id}`).then((d) => ({ columns: d.columns, rows: d.rows }))
  promise.catch(() => cache.delete(key))
  cache.set(key, { at: Date.now(), promise })
  return promise
}

export function useSourceData(source: SourceRef | undefined, range: RangePreset) {
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const version = useSourceVersion((s) => s.v)
  const [state, setState] = useState<{ data?: TabularData; error?: string; loading: boolean }>({ loading: !!source })
  const key = source ? sourceKey(source) : ''

  useEffect(() => {
    if (!source || !companyId) { setState({ loading: false }); return }
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: undefined }))
    load(companyId, source, range)
      .then((data) => !cancelled && setState({ data, loading: false }))
      .catch((e: unknown) => !cancelled && setState({ error: e instanceof Error ? e.message : 'Veri alınamadı', loading: false }))
    return () => { cancelled = true }
  }, [key, range, companyId, version]) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}
