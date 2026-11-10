import { useEffect } from 'react'
import { send } from '../../lib/apiClient'
import { useAuthStore } from '../../stores/useAuthStore'
import { toast } from '../../stores/useToastStore'
import { useUiStore } from '../../stores/useUiStore'
import { buildDataset, draftColumns } from './datasetParse'
import { invalidateSources, useDatasetsStore } from './sources'
import type { DatasetSummary } from './types'

/**
 * Excel dosyası izleme: veri kümesine bağlı dosya kaydedildiğinde (Excel'de ⌘S/Ctrl+S)
 * yeni hâli okunur, sütun tipleri korunarak veri kümesi yenilenir; sayfalar kendiliğinden güncellenir.
 */
export function useDatasetWatch() {
  const status = useAuthStore((s) => s.status)
  const watchedFiles = useUiStore((s) => s.watchedFiles)
  const datasets = useDatasetsStore((s) => s.list)
  const refreshDatasets = useDatasetsStore((s) => s.refresh)

  // İzlenecek yolları ana sürece bildir
  useEffect(() => {
    if (!window.api || status !== 'ready') return
    const ids = new Set(datasets.map((d) => d.id))
    void window.api.watch.set(Object.entries(watchedFiles).filter(([id]) => ids.has(id)).map(([, w]) => w.path))
  }, [watchedFiles, datasets, status])

  useEffect(() => {
    if (!window.api || status !== 'ready') return
    return window.api.watch.onChanged(async (path) => {
      const entry = Object.entries(watchedFiles).find(([, w]) => w.path === path)
      const ds = entry && datasets.find((d) => d.id === entry[0])
      if (!entry || !ds) return
      const res = await window.api!.excel.readWatched(path)
      if (!res.ok || res.canceled) { if (!res.ok) toast.error(`${ds.name}: ${res.error}`); return }
      const sheet = res.sheets.find((s) => s.name === entry[1].sheet) ?? res.sheets[0]
      const drafts = draftColumns(sheet, entry[1].headerRow)
      for (const d of drafts) {
        const prev = ds.columns.find((c) => c.key === d.key)
        if (prev) d.type = prev.type
        else d.include = false // yeni eklenen sütunlar kullanıcı onaylayana kadar alınmaz
      }
      const data = buildDataset(sheet, entry[1].headerRow, drafts)
      try {
        await send<DatasetSummary>('PUT', `/api/datasets/${ds.id}`, { name: ds.name, description: ds.description, sourceFileName: path.split(/[\\/]/).pop(), sourceSheet: sheet.name, columns: data.columns, rows: data.rows })
        invalidateSources(`dataset:${ds.id}`)
        await refreshDatasets()
        toast.success(`"${ds.name}" Excel'den güncellendi: ${data.rows.length} satır.`)
      } catch (e) {
        toast.error(`${ds.name} güncellenemedi: ${e instanceof Error ? e.message : ''}`)
      }
    })
  }, [watchedFiles, datasets, status, refreshDatasets])
}
