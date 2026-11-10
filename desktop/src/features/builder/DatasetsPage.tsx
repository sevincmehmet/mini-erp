import { useEffect, useState } from 'react'
import { Icon } from '../../components/ui/Icons'
import { DataTable, type Column } from '../../components/data/DataTable'
import { Badge, Button, GlassCard, PageHeader, SectionTitle } from '../../components/ui/Glass'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { api, errorMessage, send } from '../../lib/apiClient'
import { useNavStore } from '../../stores/useNavStore'
import { toast } from '../../stores/useToastStore'
import type { CellValue } from '../../types/electron'
import { DropOverlay, useFileDrop } from '../import/useFileDrop'
import { autoWidgets } from './autoPage'
import { DatasetUploadDialog } from './DatasetUploadDialog'
import { formatValue } from './engine'
import { invalidateSources, SYSTEM_SOURCES, useDatasetsStore } from './sources'
import type { ColType, DatasetSummary, TabularData } from './types'
import { usePagesStore } from './usePagesStore'
import { useUiStore } from '../../stores/useUiStore'
import { Tooltip } from '../../components/ui/Tooltip'

const TYPE_ICON: Record<ColType, string> = { text: 'Aa', number: '#', money: '₺', date: '◷' }
const SYSTEM_ICON = { 'gelir-gider': 'finance', puantaj: 'timesheet', bordro: 'payroll', vardiya: 'shifts', personel: 'employees' } as const

export function DatasetsPage() {
  const { list, loaded, refresh } = useDatasetsStore()
  const createPage = usePagesStore((s) => s.create)
  const go = useNavStore((s) => s.go)
  const [upload, setUpload] = useState<{ target: DatasetSummary | null; file: File | null } | null>(null)
  const [viewing, setViewing] = useState<DatasetSummary | null>(null)
  const [deleting, setDeleting] = useState<DatasetSummary | null>(null)

  const { watchedFiles, setWatchedFile } = useUiStore()
  useEffect(() => { void refresh() }, [refresh])
  const dragging = useFileDrop((file) => setUpload({ target: null, file }), !upload && !viewing)

  const remove = async () => {
    if (!deleting) return
    try {
      await send('DELETE', `/api/datasets/${deleting.id}`)
      invalidateSources(`dataset:${deleting.id}`)
      await refresh()
      toast.success('Veri kümesi silindi.')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <PageHeader title="Veri Kaynakları" subtitle="Sayfalarınızdaki bileşenlerin bağlanabileceği veriler"
        actions={<Button icon="excel" onClick={() => setUpload({ target: null, file: null })}>Excel Yükle</Button>} />

      <SectionTitle>Excel veri kümeleri</SectionTitle>
      {loaded && list.length === 0 ? (
        <button onClick={() => setUpload({ target: null, file: null })} className="mb-6 w-full rounded-2xl border-2 border-dashed border-[var(--glass-border)] py-10 text-center hover:border-[var(--accent)]">
          <span className="mx-auto grid size-12 place-items-center rounded-[14px] bg-[var(--accent-soft)] text-[var(--accent-text)]"><Icon name="excel" size={22} /></span>
          <p className="mt-1 text-[14px] font-semibold">Henüz Excel verisi yok</p>
          <p className="text-[12px] text-[var(--text-muted)]">Bir Excel dosyasını buraya sürükleyin ya da tıklayın</p>
        </button>
      ) : (
        <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((d) => (
            <GlassCard key={d.id} className="flex flex-col p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[color-mix(in_srgb,#1d6f42_14%,transparent)] text-[#1d8f52]"><Icon name="excel" size={20} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{d.name}</p>
                  <p className="truncate text-[11.5px] text-[var(--text-muted)]">
                    {d.rowCount.toLocaleString('tr-TR')} satır · {d.columns.length} sütun · {d.sourceFileName ?? ''} · {new Date(d.refreshedAt + 'Z').toLocaleDateString('tr-TR')}
                  </p>
                </div>
              </div>
              {watchedFiles[d.id] && (
                <div className="mt-2 flex items-center gap-2 rounded-[10px] bg-[var(--good-bg)] px-2.5 py-1.5 text-[11.5px] text-[var(--good-text)]">
                  <Icon name="eyeWatch" size={13} />
                  <Tooltip content={watchedFiles[d.id].path}><span className="truncate">Excel dosyası izleniyor · kaydettikçe güncellenir</span></Tooltip>
                  <button onClick={() => setWatchedFile(d.id, null)} className="ml-auto font-medium underline-offset-2 hover:underline">Durdur</button>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-1">
                {d.columns.slice(0, 10).map((c) => <Badge key={c.key}><span className="opacity-60">{TYPE_ICON[c.type]}</span> {c.name}</Badge>)}
                {d.columns.length > 10 && <Badge>+{d.columns.length - 10}</Badge>}
              </div>
              <div className="mt-auto flex flex-wrap gap-1 pt-3">
                <Button variant="ghost" icon="table" onClick={() => setViewing(d)}>Görüntüle</Button>
                <Button variant="ghost" icon="refresh" onClick={() => setUpload({ target: d, file: null })} title="Güncel Excel dosyasıyla verileri yenile">Yenile</Button>
                <Button variant="ghost" onClick={async () => {
                  const data = await api<TabularData>(`/api/datasets/${d.id}`)
                  const page = await createPage(d.name, '📊', autoWidgets(data, { kind: 'dataset', id: d.id }, d.name))
                  go(`custom:${page.id}`)
                }} icon="sparkles">Sayfa Oluştur</Button>
                <Button variant="ghost" icon="trash" className="ml-auto !px-2 !text-[var(--danger)]" onClick={() => setDeleting(d)} aria-label="Sil" title="Sil"></Button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <SectionTitle>Sistem verileri · her zaman güncel</SectionTitle>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SYSTEM_SOURCES.map((s) => (
          <GlassCard key={s.key} className="flex items-start gap-3 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[var(--accent-soft)] text-[var(--accent-text)]"><Icon name={SYSTEM_ICON[s.key]} size={19} /></span>
            <div><p className="text-[14px] font-semibold">{s.name}</p><p className="text-[12px] text-[var(--text-muted)]">{s.description}</p></div>
          </GlassCard>
        ))}
      </div>

      <DatasetUploadDialog open={!!upload} file={upload?.file} target={upload?.target} offerAutoPage
        onClose={() => setUpload(null)}
        onSaved={async ({ id, name, data, autoPage }) => {
          setUpload(null)
          if (autoPage) {
            const page = await createPage(name, '📊', autoWidgets(data, { kind: 'dataset', id }, name))
            go(`custom:${page.id}`)
          }
        }} />
      <DatasetViewer dataset={viewing} onClose={() => setViewing(null)} />
      <ConfirmDialog open={!!deleting} title="Veri kümesini sil" onConfirm={remove} onClose={() => setDeleting(null)}
        message={<>"{deleting?.name}" silinecek. Bu veriyi kullanan sayfa bileşenleri boş görünür.</>} />
      <DropOverlay show={dragging} title="Yeni veri kümesi" />
    </>
  )
}

function DatasetViewer({ dataset, onClose }: { dataset: DatasetSummary | null; onClose: () => void }) {
  const [data, setData] = useState<TabularData | null>(null)
  useEffect(() => {
    setData(null)
    if (dataset) api<TabularData>(`/api/datasets/${dataset.id}`).then(setData).catch((e) => toast.error(errorMessage(e)))
  }, [dataset])
  const columns: Column<CellValue[]>[] = (data?.columns ?? []).map((c, i) => ({
    key: c.key, header: c.name, type: c.type, align: c.type === 'number' || c.type === 'money' ? 'right' : undefined,
    value: (r) => r[i] ?? null, render: (r) => formatValue(r[i] ?? null, c.type),
  }))
  const rows = data?.rows ?? []
  const keys = new Map(rows.map((r, i) => [r, String(i)]))
  return (
    <Modal open={!!dataset} onClose={onClose} title={dataset?.name ?? ''} width="xl">
      {!data ? <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">Yükleniyor…</p> : (
        <>
          <DataTable tableId={`dataset-${dataset?.id}`} exportName={dataset?.name ?? 'Veri'} columns={columns} rows={rows} rowKey={(r) => keys.get(r) ?? ''} />
        </>
      )}
    </Modal>
  )
}
