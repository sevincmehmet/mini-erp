import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/ui/Icons'
import { Badge, Button, Segmented, cx } from '../../components/ui/Glass'
import { Modal } from '../../components/ui/Modal'
import { Input, Select } from '../../components/ui/Form'
import { errorMessage, send } from '../../lib/apiClient'
import { MONTHS } from '../../lib/format'
import { useViewStore } from '../../stores/useViewStore'
import { toast } from '../../stores/useToastStore'
import type { CellValue, ParsedSheet } from '../../types/electron'
import { IMPORT_KINDS, type ImportKind } from './importKinds'
import { asDate, normText } from './normalize'
import { guessHeaderRow } from './sheet'

interface ImportResult {
  dryRun: boolean
  total: number
  created: number
  updated: number
  skipped: number
  errors: { row: number; message: string }[]
}

interface Props {
  kind: ImportKind
  open: boolean
  /** Sayfaya sürüklenen dosya: doğrudan eşleştirme adımına geçilir. */
  file?: File | null
  onClose: () => void
  onDone: () => void
}

type Mapping = Record<string, number | null>

const TEMPLATE_SKIP = new Set(['fullName', 'incomeAmount', 'expenseAmount'])
const OFF_WORDS = new Set(['izin', 'izinli', 'i', 'rapor', 'raporlu', 'r', 'yi', 'ui', 'off', 'tatil', 'x', 'bos', 'hafta tatili', 'ht'])
const pad = (n: number) => String(n).padStart(2, '0')

/** Excel başlıklarını alanlara eşler: önce kayıtlı eşleştirme, sonra tam eşleşme, sonra içerme. */
function autoMap(kind: ImportKind, headers: string[], saved?: Record<string, string>): Mapping {
  const def = IMPORT_KINDS[kind]
  const norm = headers.map((h) => normText(h ?? ''))
  const used = new Set<number>()
  const mapping: Mapping = {}
  const take = (key: string, idx: number) => { if (idx >= 0 && !used.has(idx)) { mapping[key] = idx; used.add(idx); return true } return false }

  for (const f of def.fields) if (saved?.[f.key] && take(f.key, norm.indexOf(saved[f.key]))) continue
  for (const f of def.fields) if (mapping[f.key] == null) take(f.key, norm.findIndex((h, i) => !used.has(i) && f.synonyms.includes(h)))
  for (const f of def.fields) {
    if (mapping[f.key] != null) continue
    const syns = [...f.synonyms].sort((a, b) => b.length - a.length).filter((s) => s.length > 2)
    take(f.key, norm.findIndex((h, i) => !used.has(i) && syns.some((s) => h.startsWith(s) || h.endsWith(s))))
  }
  for (const f of def.fields) mapping[f.key] ??= null
  return mapping
}

export function ImportDialog({ kind, open, file, onClose, onDone }: Props) {
  const def = IMPORT_KINDS[kind]
  const savedMapping = useViewStore((s) => s.importMappings[kind])
  const setImportMapping = useViewStore((s) => s.setImportMapping)

  const [step, setStep] = useState<'pick' | 'map' | 'done'>('pick')
  const [fileName, setFileName] = useState('')
  const [sheets, setSheets] = useState<ParsedSheet[]>([])
  const [sheetIndex, setSheetIndex] = useState(0)
  const [headerRow, setHeaderRow] = useState(1)
  const [mapping, setMapping] = useState<Mapping>({})
  const [layout, setLayout] = useState<'list' | 'grid'>('list')
  const [gridMonth, setGridMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() + 1 } })
  const [check, setCheck] = useState<ImportResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => { setStep('pick'); setSheets([]); setCheck(null); setResult(null); setParseError(null); setFileName('') }
  const close = () => { reset(); onClose() }

  // ---------- Dosya okuma ----------
  const readFile = useCallback(async (f: File) => {
    setParseError(null)
    const bridge = window.api
    if (!bridge) { setParseError('Excel içe aktarımı yalnızca masaüstü uygulamasında çalışır.'); return }
    const res = await bridge.excel.parse({ name: f.name, bytes: await f.arrayBuffer() })
    if (!res.ok) { setParseError(res.error); return }
    if (res.canceled) return
    const usable = res.sheets.filter((s) => s.rows.some((r) => r.length > 0))
    if (usable.length === 0) { setParseError('Dosyada veri bulunamadı.'); return }
    setFileName(f.name)
    setSheets(usable)
    setSheetIndex(0)
    setStep('map')
  }, [])

  useEffect(() => { if (open && file) void readFile(file) }, [open, file, readFile])

  const sheet = sheets[sheetIndex]
  useEffect(() => { if (sheet) setHeaderRow(guessHeaderRow(sheet.rows)) }, [sheet])

  const headers = useMemo(() => (sheet?.rows[headerRow - 1] ?? []).map((c) => (c == null ? '' : String(c))), [sheet, headerRow])
  useEffect(() => { if (sheet) setMapping(autoMap(kind, headers, savedMapping)) }, [sheet, headers, kind]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Başlığın altındaki dolu satırlar + gerçek Excel satır numaraları (hata mesajları bu numarayla gösterilir). */
  const dataRows = useMemo(() => {
    if (!sheet) return []
    return sheet.rows.slice(headerRow)
      .map((cells, i) => ({ cells, row: headerRow + i + 1 }))
      .filter((r) => r.cells.some((c) => c != null && String(c).trim() !== ''))
  }, [sheet, headerRow])

  // Çizelge biçimi: başlığı tarih (ya da ayın günü) olan sütunlar
  const gridDateCols = useMemo(() => {
    if (layout !== 'grid') return []
    return headers.map((h, i) => {
      if (i === mapping.employee) return null
      const n = Number(h)
      const date = Number.isInteger(n) && n >= 1 && n <= 31 && String(h).trim().length <= 2
        ? `${gridMonth.year}-${pad(gridMonth.month)}-${pad(n)}`
        : asDate(h, gridMonth.year)
      return date ? { index: i, date } : null
    }).filter((x): x is { index: number; date: string } => x !== null)
  }, [layout, headers, mapping.employee, gridMonth])

  const apiRows = useMemo(() => {
    if (layout === 'grid') {
      const empCol = mapping.employee
      if (empCol == null) return []
      return dataRows.flatMap((r) => gridDateCols.flatMap(({ index, date }) => {
        const v = r.cells[index]
        const shift = v == null ? '' : String(v).trim()
        if (shift === '' || OFF_WORDS.has(normText(shift))) return []
        return [{ row: r.row, employee: r.cells[empCol] == null ? null : String(r.cells[empCol]), date, shift, status: null, note: null }]
      }))
    }
    return dataRows.map((r) => def.toRow((key) => (mapping[key] == null ? null : r.cells[mapping[key]!] ?? null), r.row))
  }, [layout, dataRows, gridDateCols, mapping, def])

  const missing = useMemo(() => {
    const out: string[] = []
    if (layout === 'grid') {
      if (mapping.employee == null) out.push('Çalışan')
      if (gridDateCols.length === 0) out.push('tarih sütunları (başlıkta gün numarası ya da tarih olmalı)')
      return out
    }
    for (const f of def.fields) if (f.required && mapping[f.key] == null) out.push(f.label)
    for (const group of def.requiredAny ?? []) if (group.every((k) => mapping[k] == null)) out.push(group.map((k) => def.fields.find((f) => f.key === k)!.label).join(' ya da '))
    return out
  }, [layout, mapping, def, gridDateCols])

  // ---------- Sunucuda ön kontrol (hiçbir şey yazılmaz) ----------
  useEffect(() => {
    if (step !== 'map' || missing.length > 0 || apiRows.length === 0) { setCheck(null); return }
    setChecking(true)
    const t = setTimeout(() => {
      send<ImportResult>('POST', `/api/import/${kind}`, { rows: apiRows, dryRun: true })
        .then(setCheck)
        .catch((e) => { setCheck(null); toast.error(errorMessage(e)) })
        .finally(() => setChecking(false))
    }, 450)
    return () => clearTimeout(t)
  }, [apiRows, missing.length, step, kind])

  const errorsByRow = useMemo(() => {
    const m = new Map<number, string>()
    for (const e of check?.errors ?? []) m.set(e.row, m.has(e.row) ? `${m.get(e.row)} ${e.message}` : e.message)
    return m
  }, [check])

  const commit = async () => {
    setBusy(true)
    try {
      const res = await send<ImportResult>('POST', `/api/import/${kind}`, { rows: apiRows, dryRun: false })
      setResult(res)
      setStep('done')
      // Bir dahaki aktarımda aynı başlıklar otomatik eşleşsin
      const remembered: Record<string, string> = {}
      for (const [key, idx] of Object.entries(mapping)) if (idx != null && headers[idx]) remembered[key] = normText(headers[idx])
      setImportMapping(kind, remembered)
      onDone()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const downloadTemplate = async () => {
    const fields = def.fields.filter((f) => !TEMPLATE_SKIP.has(f.key))
    const res = await window.api?.excel.saveTemplate({
      fileName: def.title,
      sheetName: def.title,
      columns: fields.map((f) => ({ header: f.label, type: f.type, required: f.required || def.requiredAny?.some((g) => g.includes(f.key)), help: f.help })),
      examples: [0, 1].map((i) => fields.map((f) => f.example[i] ?? null)),
    })
    if (!res) toast.error('Şablon yalnızca masaüstü uygulamasında indirilebilir.')
    else if (!res.ok) toast.error(res.error)
    else if (!res.canceled) toast.success(`Şablon kaydedildi: ${res.filePath}`)
  }

  const exportErrors = async (errors: ImportResult['errors']) => {
    const res = await window.api?.excel.exportTable({
      fileName: `${def.title} aktarim hatalari`,
      columns: [{ header: 'Excel Satırı', type: 'number' }, { header: 'Hata' }],
      rows: errors.map((e) => [e.row, e.message]),
    })
    if (res && !res.ok) toast.error(res.error)
  }

  // Önizlemede API'ye gidecek alanlar gösterilir (ör. "Ad Soyad" sütunundan ayrılan ad ve soyad dahil)
  const previewLabels: Record<string, string> = layout === 'grid'
    ? { employee: 'Çalışan', date: 'Tarih', shift: 'Vardiya' }
    : Object.fromEntries(def.fields.map((f) => [f.key, f.label]))
  const previewKeys = Object.keys(previewLabels).filter((k) =>
    apiRows.slice(0, 200).some((r) => { const v = (r as Record<string, unknown>)[k]; return v != null && v !== '' }))

  // ---------- Görünüm ----------
  return (
    <Modal open={open} onClose={close} title={`Excel'den Aktar · ${def.title}`} width="xl"
      footer={step === 'map' ? (
        <>
          <span className="mr-auto text-[12px] text-[var(--text-muted)]">
            {missing.length > 0 ? <span className="text-[var(--danger)]">Eşleştirilmesi gereken: {missing.join(', ')}</span>
              : checking ? 'Kontrol ediliyor…'
              : check ? <>{check.total} satır · <b>{check.created}</b> yeni · <b>{check.updated}</b> güncellenecek{check.errors.length > 0 && <> · <span className="text-[var(--danger)]">{check.errors.length} hatalı satır atlanacak</span></>}</>
              : null}
          </span>
          <Button variant="secondary" onClick={reset}>Başka Dosya</Button>
          <Button onClick={commit} disabled={busy || checking || !check || check.created + check.updated === 0}>
            {busy ? 'Aktarılıyor…' : check ? `${check.created + check.updated} kaydı aktar` : 'Aktar'}
          </Button>
        </>
      ) : step === 'done' ? <Button onClick={close}>Tamam</Button> : undefined}
    >
      {step === 'pick' && (
        <div>
          <p className="mb-4 text-[13px] text-[var(--text-muted)]">{def.description}</p>
          <button
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) void readFile(f) }}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-[var(--hover-strong)] px-6 py-14 text-center transition hover:border-[var(--accent)] hover:bg-[var(--today-bg)]"
          >
            <span className="grid size-14 place-items-center rounded-[16px] bg-[var(--accent-soft)] text-[var(--accent-text)]"><Icon name="excel" size={26} /></span>
            <span className="text-[15px] font-semibold">Excel dosyasını buraya sürükleyin</span>
            <span className="text-[13px] text-[var(--text-muted)]">ya da tıklayıp seçin · .xlsx, .xlsm, .csv</span>
          </button>
          <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.csv,.xls" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = '' }} />
          {parseError && <p className="mt-3 rounded-lg bg-[var(--critical-bg)] px-3 py-2 text-[13px] text-[var(--critical-text)]">{parseError}</p>}

          <div className="mt-5 flex items-center justify-between rounded-xl bg-[var(--hover)] px-4 py-3">
            <div className="text-[12px] text-[var(--text-muted)]">
              <p className="font-medium text-[var(--text)]">Kendi Excel'inizi kullanabilirsiniz</p>
              Sütun adları farklı olsa da bir sonraki adımda eşleştirebilirsiniz. Sıfırdan başlıyorsanız örnek şablonu indirin.
            </div>
            <Button variant="secondary" icon="download" onClick={downloadTemplate}>Örnek Şablon</Button>
          </div>
        </div>
      )}

      {step === 'map' && sheet && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Sol: dosya ayarları + sütun eşleştirme */}
          <div className="space-y-3">
            <div className="rounded-xl bg-[var(--hover)] px-3 py-2 text-[12px]">
              <p className="flex items-center gap-1.5 truncate font-medium"><Icon name="excel" size={14} className="text-[var(--accent-text)]" />{fileName}</p>
              <p className="text-[var(--text-muted)]">{dataRows.length} veri satırı{sheet.truncated && ' (ilk 20.000 satır)'}</p>
            </div>

            <div className="grid grid-cols-[1fr_88px] gap-2">
              <label className="text-[12px] text-[var(--text-muted)]">Sayfa
                <Select value={sheetIndex} onChange={(e) => setSheetIndex(Number(e.target.value))}>
                  {sheets.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
                </Select>
              </label>
              <label className="text-[12px] text-[var(--text-muted)]">Başlık satırı
                <Input type="number" min={1} max={Math.min(50, sheet.rows.length)} value={headerRow} onChange={(e) => setHeaderRow(Math.max(1, Number(e.target.value) || 1))} />
              </label>
            </div>

            {kind === 'shift-assignments' && (
              <div className="space-y-2">
                <Segmented value={layout} onChange={setLayout} options={[{ value: 'list', label: 'Liste' }, { value: 'grid', label: 'Çizelge (günler sütunda)' }]} />
                {layout === 'grid' && (
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={gridMonth.month} onChange={(e) => setGridMonth({ ...gridMonth, month: Number(e.target.value) })}>
                      {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </Select>
                    <Input type="number" value={gridMonth.year} onChange={(e) => setGridMonth({ ...gridMonth, year: Number(e.target.value) || gridMonth.year })} />
                    <p className="col-span-2 text-[11px] text-[var(--text-muted)]">
                      Başlıkta sadece gün numarası (1, 2, 3…) varsa bu ay kullanılır. {gridDateCols.length} gün sütunu bulundu. "İzin", "R", "-" gibi hücreler atlanır.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Sütun eşleştirme</p>
              <div className="space-y-1.5">
                {(layout === 'grid' ? def.fields.filter((f) => f.key === 'employee') : def.fields).map((f) => {
                  const required = f.required || def.requiredAny?.some((g) => g.includes(f.key))
                  const sample = dataRows[0]?.cells[mapping[f.key] ?? -1]
                  return (
                    <div key={f.key} className="grid grid-cols-[110px_1fr] items-center gap-2" title={[f.help, sample != null ? `Örnek: ${String(sample)}` : ''].filter(Boolean).join(' · ')}>
                      <span className="truncate text-[12px]">{f.label}{f.required && <span className="text-[var(--danger)]"> *</span>}{!f.required && required && <span className="text-[var(--text-muted)]"> °</span>}</span>
                      <div>
                        <Select value={mapping[f.key] ?? ''} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value === '' ? null : Number(e.target.value) })}
                          className={cx(mapping[f.key] != null && 'border-[var(--accent)]/50')}>
                          <option value="">— kullanma —</option>
                          {headers.map((h, i) => <option key={i} value={i}>{h || `Sütun ${i + 1}`}</option>)}
                        </Select>
                      </div>
                    </div>
                  )
                })}
              </div>
              {def.requiredAny && layout === 'list' && <p className="mt-2 text-[11px] text-[var(--text-muted)]">° işaretli gruplardan en az biri gerekli.</p>}
            </div>
          </div>

          {/* Sağ: önizleme */}
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Önizleme · aktarılacak hâli</p>
              {check && check.errors.length > 0 && <Button variant="ghost" icon="download" onClick={() => exportErrors(check.errors)}>Hataları Excel'e kaydet</Button>}
            </div>
            <div className="max-h-[52vh] overflow-auto rounded-xl border border-[var(--glass-border)]">
              <table className="w-full border-collapse text-[12px]">
                <thead className="sticky top-0 bg-[var(--modal-bg)]">
                  <tr>
                    <th className="border-b border-[var(--glass-border)] px-2 py-1.5 text-left font-medium text-[var(--text-muted)]">Satır</th>
                    <th className="border-b border-[var(--glass-border)] px-2 py-1.5 text-left font-medium text-[var(--text-muted)]">Durum</th>
                    {previewKeys.map((k) => <th key={k} className="whitespace-nowrap border-b border-[var(--glass-border)] px-2 py-1.5 text-left font-medium text-[var(--text-muted)]">{previewLabels[k] ?? k}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {apiRows.slice(0, 200).map((r, i) => {
                    const row = r as Record<string, unknown>
                    const err = errorsByRow.get(row.row as number)
                    return (
                      <tr key={i} className={cx(err && 'bg-[var(--critical-bg)]')}>
                        <td className="border-b border-[var(--row-border)] px-2 py-1.5 tabular-nums text-[var(--text-muted)]">{String(row.row)}</td>
                        <td className="min-w-28 max-w-64 border-b border-[var(--row-border)] px-2 py-1.5">
                          {err ? <span className="text-[var(--critical-text)]">{err}</span> : check ? <Badge tone="good" dot>Hazır</Badge> : null}
                        </td>
                        {previewKeys.map((k) => (
                          <td key={k} className="max-w-48 truncate border-b border-[var(--row-border)] px-2 py-1.5">
                            {row[k] == null || row[k] === '' ? <span className="text-[var(--text-muted)]">—</span> : String(row[k])}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {apiRows.length === 0 && <p className="py-10 text-center text-[13px] text-[var(--text-muted)]">{missing.length ? 'Soldan sütunları eşleştirin.' : 'Aktarılacak satır bulunamadı.'}</p>}
            </div>
            {apiRows.length > 200 && <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">İlk 200 satır gösteriliyor; kontrol ve aktarım tüm {apiRows.length} satırı kapsar.</p>}
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="py-4 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--good-bg)] text-[var(--good-text)]"><Icon name="check" size={28} strokeWidth={2.2} /></span>
          <p className="mt-2 text-[17px] font-semibold">Aktarım tamamlandı</p>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            {result.created} yeni kayıt eklendi · {result.updated} kayıt güncellendi{result.skipped > 0 && ` · ${result.skipped} satır atlandı`}
          </p>
          {result.errors.length > 0 && (
            <div className="mx-auto mt-4 max-w-2xl text-left">
              <div className="max-h-48 overflow-auto rounded-xl border border-[var(--glass-border)] p-2 text-[12px]">
                {result.errors.map((e, i) => <p key={i} className="py-0.5"><b className="tabular-nums">Satır {e.row}:</b> {e.message}</p>)}
              </div>
              <Button variant="ghost" icon="download" className="mt-2" onClick={() => exportErrors(result.errors)}>Atlanan satırları Excel'e kaydet</Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
