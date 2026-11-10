import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/ui/Icons'
import { Badge, Button, cx } from '../../components/ui/Glass'
import { Modal } from '../../components/ui/Modal'
import { Field, Input, Select } from '../../components/ui/Form'
import { errorMessage, send } from '../../lib/apiClient'
import { toast } from '../../stores/useToastStore'
import type { ParsedSheet } from '../../types/electron'
import { buildDataset, draftColumns, guessHeaderRow, type DraftColumn } from './datasetParse'
import { formatValue } from './engine'
import { invalidateSources, useDatasetsStore } from './sources'
import { useUiStore } from '../../stores/useUiStore'
import type { ColType, DatasetSummary, TabularData } from './types'

const TYPE_LABEL: Record<ColType, string> = { text: 'Metin', number: 'Sayı', money: 'Tutar (₺)', date: 'Tarih' }

interface Props {
  open: boolean
  file?: File | null
  /** Doluysa mevcut veri kümesinin verisi yenilenir. */
  target?: DatasetSummary | null
  /** Yeni veri kümesi için "otomatik sayfa oluştur" seçeneği gösterilsin mi */
  offerAutoPage?: boolean
  onClose: () => void
  onSaved: (result: { id: string; name: string; data: TabularData; autoPage: boolean }) => void
}

export function DatasetUploadDialog({ open, file, target, offerAutoPage, onClose, onSaved }: Props) {
  const refreshList = useDatasetsStore((s) => s.refresh)
  const [step, setStep] = useState<'pick' | 'configure'>('pick')
  const [fileName, setFileName] = useState('')
  const [sheets, setSheets] = useState<ParsedSheet[]>([])
  const [sheetIndex, setSheetIndex] = useState(0)
  const [headerRow, setHeaderRow] = useState(1)
  const [columns, setColumns] = useState<DraftColumn[]>([])
  const [name, setName] = useState('')
  const [autoPage, setAutoPage] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [watch, setWatch] = useState(false)
  const setWatchedFile = useUiStore((s) => s.setWatchedFile)

  const reset = () => { setStep('pick'); setSheets([]); setError(null); setFileName('') }
  const close = () => { reset(); onClose() }

  const readFile = useCallback(async (f: File) => {
    setError(null)
    if (!window.api) { setError('Excel okuma yalnızca masaüstü uygulamasında çalışır.'); return }
    const res = await window.api.excel.parse({ name: f.name, bytes: await f.arrayBuffer() })
    if (!res.ok) { setError(res.error); return }
    if (res.canceled) return
    const usable = res.sheets.filter((s) => s.rows.some((r) => r.length > 0))
    if (!usable.length) { setError('Dosyada veri bulunamadı.'); return }
    setFileName(f.name)
    setFilePath(window.api.pathForFile(f))
    setSheets(usable)
    setSheetIndex(0)
    // "biyogaz-uretim-raporu_2026.xlsx" → "Biyogaz Uretim Raporu 2026"
    const pretty = f.name.replace(/\.(xlsx|xlsm|csv|txt)$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
      .split(' ').map((w) => w.charAt(0).toLocaleUpperCase('tr') + w.slice(1)).join(' ')
    setName(target?.name ?? pretty)
    setStep('configure')
  }, [target])

  useEffect(() => { if (open && file) void readFile(file) }, [open, file, readFile])

  const sheet = sheets[sheetIndex]
  useEffect(() => { if (sheet) setHeaderRow(guessHeaderRow(sheet.rows)) }, [sheet])
  useEffect(() => {
    if (!sheet) return
    const drafts = draftColumns(sheet, headerRow)
    // Yenilemede: mevcut sütun anahtarlarını ve tiplerini koru (bileşenler bozulmasın)
    if (target) for (const d of drafts) {
      const prev = target.columns.find((c) => c.key === d.key)
      if (prev) d.type = prev.type
    }
    setColumns(drafts)
  }, [sheet, headerRow, target])

  const dataset = useMemo(() => (sheet ? buildDataset(sheet, headerRow, columns) : null), [sheet, headerRow, columns])
  const missing = target ? target.columns.filter((c) => !dataset?.columns.some((n) => n.key === c.key)) : []

  const patch = (i: number, p: Partial<DraftColumn>) => setColumns((cs) => cs.map((c, j) => (j === i ? { ...c, ...p } : c)))

  const save = async () => {
    if (!dataset) return
    setBusy(true)
    setError(null)
    const body = { name, description: null, sourceFileName: fileName, sourceSheet: sheet?.name ?? null, columns: dataset.columns, rows: dataset.rows }
    try {
      const res = target
        ? await send<DatasetSummary>('PUT', `/api/datasets/${target.id}`, body)
        : await send<DatasetSummary>('POST', '/api/datasets', body)
      invalidateSources(`dataset:${res.id}`)
      if (filePath && watch && sheet) setWatchedFile(res.id, { path: filePath, headerRow, sheet: sheet.name })
      await refreshList()
      toast.success(target ? `"${res.name}" güncellendi: ${res.rowCount} satır.` : `"${res.name}" veri kümesi oluşturuldu: ${res.rowCount} satır.`)
      onSaved({ id: res.id, name: res.name, data: dataset, autoPage: !target && !!offerAutoPage && autoPage })
      reset()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={close} width="xl" title={target ? `Veriyi Yenile · ${target.name}` : 'Excel\'den Veri Kümesi Oluştur'}
      footer={step === 'configure' ? (
        <>
          <span className="mr-auto text-[12px] text-[var(--text-muted)]">
            {dataset && <>{dataset.rows.length.toLocaleString('tr-TR')} satır · {dataset.columns.length} sütun</>}
          </span>
          <Button variant="secondary" onClick={reset}>Başka Dosya</Button>
          <Button onClick={save} disabled={busy || !dataset?.columns.length || !name.trim()}>{busy ? 'Kaydediliyor…' : target ? 'Veriyi Yenile' : 'Kaydet'}</Button>
        </>
      ) : undefined}>
      {step === 'pick' ? (
        <div>
          <p className="mb-4 text-[13px] text-[var(--text-muted)]">
            {target
              ? 'Aynı yapıdaki güncel Excel dosyasını seçin. Sütun adları aynı kaldıkça sayfalardaki bileşenler yeni veriyle kendiliğinden güncellenir.'
              : 'Herhangi bir Excel tablosu olabilir: satış raporu, stok listesi, üretim verisi, bütçe… Sütunlar otomatik tanınır, sonra bu veriden tablo ve grafikler oluşturabilirsiniz.'}
          </p>
          <button onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) void readFile(f) }}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--glass-border)] px-6 py-14 text-center transition hover:border-[var(--accent)] hover:bg-[var(--today-bg)]">
            <span className="grid size-14 place-items-center rounded-[16px] bg-[var(--accent-soft)] text-[var(--accent-text)]"><Icon name="excel" size={26} /></span>
            <span className="text-[15px] font-semibold">Excel dosyasını buraya sürükleyin</span>
            <span className="text-[13px] text-[var(--text-muted)]">ya da tıklayıp seçin · .xlsx, .xlsm, .csv</span>
          </button>
          <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.csv,.xls" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = '' }} />
          {error && <p className="mt-3 rounded-lg bg-[var(--critical-bg)] px-3 py-2 text-[13px] text-[var(--critical-text)]">{error}</p>}
        </div>
      ) : sheet && (
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_200px_100px] gap-3">
            <Field label="Veri kümesinin adı" required><Input value={name} onChange={(e) => setName(e.target.value)} disabled={!!target} /></Field>
            <Field label="Sayfa">
              <Select value={sheetIndex} onChange={(e) => setSheetIndex(Number(e.target.value))}>{sheets.map((s, i) => <option key={i} value={i}>{s.name}</option>)}</Select>
            </Field>
            <Field label="Başlık satırı"><Input type="number" min={1} value={headerRow} onChange={(e) => setHeaderRow(Math.max(1, Number(e.target.value) || 1))} /></Field>
          </div>

          {missing.length > 0 && (
            <p className="rounded-lg bg-[var(--warning-bg)] px-3 py-2 text-[12px] text-[var(--warning-text)]">
              ⚠︎ Önceki veride olan şu sütunlar yeni dosyada yok: <b>{missing.map((c) => c.name).join(', ')}</b>. Bu sütunları kullanan bileşenler boş görünecek.
            </p>
          )}

          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Sütunlar · tipler otomatik algılandı, gerekirse değiştirin</p>
            <div className="max-h-[30vh] overflow-auto rounded-xl border border-[var(--glass-border)]">
              <table className="w-full border-collapse text-[12px]">
                <thead className="sticky top-0 bg-[var(--modal-bg)] text-left text-[var(--text-muted)]">
                  <tr><th className="w-10 px-2 py-1.5" /><th className="px-2 py-1.5 font-medium">Sütun adı</th><th className="w-36 px-2 py-1.5 font-medium">Tip</th><th className="px-2 py-1.5 font-medium">Örnek değerler</th></tr>
                </thead>
                <tbody>
                  {columns.map((c, i) => (
                    <tr key={c.index} className={cx('border-t border-[var(--row-border)]', !c.include && 'opacity-45')}>
                      <td className="px-2 py-1"><input type="checkbox" checked={c.include} onChange={(e) => patch(i, { include: e.target.checked })} aria-label={`${c.name} sütununu dahil et`} /></td>
                      <td className="px-2 py-1"><Input className="!h-7" value={c.name} onChange={(e) => patch(i, { name: e.target.value })} /></td>
                      <td className="px-2 py-1">
                        <Select className="!h-7" value={c.type} onChange={(e) => patch(i, { type: e.target.value as ColType })}>
                          {(Object.keys(TYPE_LABEL) as ColType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                        </Select>
                      </td>
                      <td className="max-w-80 truncate px-2 py-1 text-[var(--text-muted)]">{c.samples.join(' · ') || '(boş)'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {dataset && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Önizleme · ilk 8 satır, kaydedilecek hâli</p>
              <div className="overflow-auto rounded-xl border border-[var(--glass-border)]">
                <table className="w-full border-collapse text-[12px]">
                  <thead className="text-left text-[var(--text-muted)]"><tr>{dataset.columns.map((c) => <th key={c.key} className="whitespace-nowrap px-2 py-1.5 font-medium">{c.name} <Badge>{TYPE_LABEL[c.type]}</Badge></th>)}</tr></thead>
                  <tbody>
                    {dataset.rows.slice(0, 8).map((r, i) => (
                      <tr key={i} className="border-t border-[var(--row-border)]">
                        {r.map((v, j) => {
                          const t = dataset.columns[j].type
                          const bad = v == null && !!columns.find((c) => c.key === dataset.columns[j].key)?.samples.length && t !== 'text'
                          return <td key={j} className={cx('max-w-48 truncate whitespace-nowrap px-2 py-1.5', (t === 'number' || t === 'money') && 'text-right tabular-nums', bad && 'text-[var(--text-muted)]')}>{formatValue(v, t)}</td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {filePath && (
            <label className="flex items-start gap-2 rounded-xl bg-[var(--hover)] px-3 py-2.5 text-[13px]">
              <input type="checkbox" className="mt-0.5" checked={watch} onChange={(e) => setWatch(e.target.checked)} />
              <span><b>Bu Excel dosyasını izle</b> <span className="text-[var(--text-muted)]">— dosyayı Excel'de her kaydettiğinizde veriler ve sayfalar kendiliğinden güncellenir (bu bilgisayarda)</span>
                <span className="block truncate text-[11px] text-[var(--text-faint)]">{filePath}</span></span>
            </label>
          )}
          {!target && offerAutoPage && (
            <label className="flex items-center gap-2 rounded-xl bg-[var(--today-bg)] px-3 py-2.5 text-[13px]">
              <input type="checkbox" checked={autoPage} onChange={(e) => setAutoPage(e.target.checked)} />
              <span><b>Bu veriden otomatik bileşenler oluştur</b> <span className="text-[var(--text-muted)]">— göstergeler, grafikler, özet ve tablo; sonra istediğiniz gibi düzenlersiniz</span></span>
            </label>
          )}
          {error && <p className="rounded-lg bg-[var(--critical-bg)] px-3 py-2 text-[13px] text-[var(--critical-text)]">{error}</p>}
        </div>
      )}
    </Modal>
  )
}
