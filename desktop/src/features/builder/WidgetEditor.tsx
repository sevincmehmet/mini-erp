import { useEffect, useMemo, useState } from 'react'
import { Button, GlassCard, Segmented, cx } from '../../components/ui/Glass'
import { Modal } from '../../components/ui/Modal'
import { Field, Input, Select, TextArea } from '../../components/ui/Form'
import { AGG_LABEL, BUCKET_LABEL, isNumeric, RANGE_LABEL } from './engine'
import { parseSourceKey, sourceKey, SYSTEM_SOURCES, useDatasetsStore, useSourceData } from './sources'
import { fillDefaults, WIDGET_TYPES } from './suggest'
import type { Agg, Bucket, FilterOp, Measure, RangePreset, Widget } from './types'
import { WidgetBody } from './WidgetBody'

const OPS: { value: FilterOp; label: string; noValue?: boolean }[] = [
  { value: 'eq', label: 'eşittir' }, { value: 'neq', label: 'eşit değil' }, { value: 'contains', label: 'içerir' },
  { value: 'gt', label: '>' }, { value: 'gte', label: '≥' }, { value: 'lt', label: '<' }, { value: 'lte', label: '≤' },
  { value: 'notEmpty', label: 'dolu', noValue: true }, { value: 'empty', label: 'boş', noValue: true },
]

const SIZES = [{ value: 3, label: '¼' }, { value: 4, label: '⅓' }, { value: 6, label: '½' }, { value: 8, label: '⅔' }, { value: 12, label: 'Tam' }]

interface Props {
  open: boolean
  widget: Widget | null
  isNew: boolean
  onClose: () => void
  onSave: (w: Widget) => void
}

export function WidgetEditor({ open, widget, isNew, onClose, onSave }: Props) {
  const [w, setW] = useState<Widget | null>(widget)
  const datasets = useDatasetsStore((s) => s.list)
  useEffect(() => { if (open) setW(widget) }, [open, widget])

  const { data } = useSourceData(w?.type === 'text' ? undefined : w?.source, w?.range ?? 'all')
  // Kaynak ya da tür değişince eksik ayarları otomatik doldur
  useEffect(() => { if (w && data) { const filled = fillDefaults(w, data); if (JSON.stringify(filled) !== JSON.stringify(w)) setW(filled) } }, [data, w?.type, w?.source]) // eslint-disable-line react-hooks/exhaustive-deps

  const cols = data?.columns ?? []
  const numeric = cols.filter((c) => isNumeric(c.type))
  const dates = cols.filter((c) => c.type === 'date')
  const xCol = cols.find((c) => c.key === w?.x)
  const groupCol = cols.find((c) => c.key === w?.groupBy)
  const isChart = !!w && ['bar', 'hbar', 'line', 'donut'].includes(w.type)
  const previewKey = useMemo(() => `editor-${w?.id}`, [w?.id])

  if (!w) return null
  const set = (patch: Partial<Widget>) => setW({ ...w, ...patch })
  const setMeasure = (i: number, patch: Partial<Measure>) => set({ measures: w.measures.map((m, j) => (j === i ? { ...m, ...patch } : m)) })

  const measureEditor = (max: number) => (
    <div className="space-y-1.5">
      {w.measures.slice(0, max).map((m, i) => (
        <div key={i} className="grid grid-cols-[130px_1fr_auto] gap-1.5">
          <Select value={m.agg} onChange={(e) => setMeasure(i, { agg: e.target.value as Agg })}>
            {(Object.keys(AGG_LABEL) as Agg[]).map((a) => <option key={a} value={a}>{AGG_LABEL[a]}</option>)}
          </Select>
          {m.agg === 'count' ? <span className="self-center text-[12px] text-[var(--text-muted)]">satır sayılır</span> : (
            <Select value={m.column ?? ''} onChange={(e) => setMeasure(i, { column: e.target.value })}>
              {(m.agg === 'countDistinct' ? cols : numeric).map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
            </Select>
          )}
          {w.measures.length > 1 ? <Button variant="ghost" className="w-8 px-0" onClick={() => set({ measures: w.measures.filter((_, j) => j !== i) })} aria-label="Ölçüyü kaldır">✕</Button> : <span />}
        </div>
      ))}
      {w.measures.length < max && !w.splitBy && (
        <button className="text-[12px] text-[var(--accent)] hover:underline" onClick={() => set({ measures: [...w.measures, { agg: 'sum', column: numeric[0]?.key }] })}>＋ Ölçü ekle (ör. gelir ve gider yan yana)</button>
      )}
    </div>
  )

  const bucketSelect = (show: boolean) => show && (
    <Field label="Tarih gruplama">
      <Select value={w.bucket ?? 'month'} onChange={(e) => set({ bucket: e.target.value as Bucket })}>
        {(Object.keys(BUCKET_LABEL) as Bucket[]).map((b) => <option key={b} value={b}>{BUCKET_LABEL[b]}</option>)}
      </Select>
    </Field>
  )

  return (
    <Modal open={open} onClose={onClose} title={isNew ? 'Bileşen Ekle' : 'Bileşeni Düzenle'} width="xl"
      footer={<><Button variant="secondary" onClick={onClose}>Vazgeç</Button><Button onClick={() => onSave(w)}>{isNew ? 'Sayfaya Ekle' : 'Kaydet'}</Button></>}>
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        {/* -------- Ayarlar */}
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-1.5">
            {WIDGET_TYPES.map((t) => (
              <button key={t.type} title={t.hint} onClick={() => set({ type: t.type, size: isNew ? t.size : w.size, ...(t.type === 'table' && !w.tableMode ? { tableMode: 'rows' } : {}) })}
                className={cx('flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2 text-[11px] transition',
                  w.type === t.type ? 'border-[var(--accent)] bg-[var(--today-bg)] font-semibold' : 'border-[var(--glass-border)] hover:bg-[var(--hover)]')}>
                <span className="text-[15px] leading-none">{t.icon}</span>{t.label}
              </button>
            ))}
          </div>

          <Field label="Başlık"><Input value={w.title} onChange={(e) => set({ title: e.target.value })} /></Field>

          {w.type === 'text' ? (
            <Field label="Metin" hint="# ile başlayan satır başlık, - ile başlayan madde olur">
              <TextArea rows={8} value={w.text ?? ''} onChange={(e) => set({ text: e.target.value })} />
            </Field>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Veri kaynağı" className="col-span-2">
                  <Select value={w.source ? sourceKey(w.source) : ''} onChange={(e) => set({ source: parseSourceKey(e.target.value), filters: [], x: undefined, groupBy: undefined, splitBy: undefined, labelColumn: undefined, valueColumn: undefined, columns: undefined, dateColumn: undefined, measures: [{ agg: 'sum' }] })}>
                    <option value="">— seçin —</option>
                    <optgroup label="Sistem verileri">
                      {SYSTEM_SOURCES.map((s) => <option key={s.key} value={`system:${s.key}`}>{s.icon}  {s.name}</option>)}
                    </optgroup>
                    {datasets.length > 0 && (
                      <optgroup label="Excel veri kümeleri">
                        {datasets.map((d) => <option key={d.id} value={`dataset:${d.id}`}>{d.name} ({d.rowCount} satır)</option>)}
                      </optgroup>
                    )}
                  </Select>
                </Field>
                <Field label="Tarih aralığı">
                  <Select value={w.range} onChange={(e) => set({ range: e.target.value as RangePreset })} disabled={!dates.length && w.source?.kind === 'dataset'}>
                    {(Object.keys(RANGE_LABEL) as RangePreset[]).map((r) => <option key={r} value={r}>{RANGE_LABEL[r]}</option>)}
                  </Select>
                </Field>
                <Field label="Tarih sütunu">
                  <Select value={w.dateColumn ?? ''} onChange={(e) => set({ dateColumn: e.target.value || undefined })} disabled={w.source?.kind === 'system' || !dates.length}>
                    {!dates.length && <option value="">(tarih sütunu yok)</option>}
                    {dates.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                  </Select>
                </Field>
              </div>

              {/* -------- türe özel ayarlar */}
              {w.type === 'stat' && <Field label="Hesaplama">{measureEditor(1)}</Field>}

              {isChart && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label={w.type === 'donut' ? 'Dilimler' : w.type === 'line' ? 'X ekseni (genelde tarih)' : 'Kategori'} className={xCol?.type === 'date' ? '' : 'col-span-2'}>
                    <Select value={w.x ?? ''} onChange={(e) => set({ x: e.target.value, bucket: cols.find((c) => c.key === e.target.value)?.type === 'date' ? (w.bucket ?? 'month') : w.bucket })}>
                      {cols.filter((c) => !isNumeric(c.type)).map((c) => <option key={c.key} value={c.key}>{c.name}{c.type === 'date' ? ' (tarih)' : ''}</option>)}
                    </Select>
                  </Field>
                  {bucketSelect(xCol?.type === 'date')}
                  <Field label="Değer" className="col-span-2">{measureEditor(w.type === 'donut' ? 1 : 4)}</Field>
                  {w.type !== 'donut' && (
                    <Field label="Seriye ayır" hint="ör. Tür'e göre: gelir ve gider ayrı renkte" className="col-span-2">
                      <Select value={w.splitBy ?? ''} onChange={(e) => set({ splitBy: e.target.value || undefined, measures: e.target.value ? w.measures.slice(0, 1) : w.measures })}>
                        <option value="">— yok —</option>
                        {cols.filter((c) => c.type === 'text' && c.key !== w.x).map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                      </Select>
                    </Field>
                  )}
                  {xCol?.type !== 'date' && (
                    <Field label="Sıralama">
                      <Select value={w.sortBy ?? 'value'} onChange={(e) => set({ sortBy: e.target.value as 'x' | 'value' })}>
                        <option value="value">Büyükten küçüğe</option>
                        <option value="x">Ada göre (A→Z)</option>
                      </Select>
                    </Field>
                  )}
                  <Field label={xCol?.type === 'date' ? 'En fazla dönem' : 'En fazla kategori'} >
                    <Input type="number" min={1} max={w.type === 'donut' ? 7 : 60} value={w.limit ?? 10} onChange={(e) => set({ limit: Number(e.target.value) || 10 })} />
                  </Field>
                  {xCol?.type !== 'date' && w.sortBy !== 'x' && (
                    <label className="col-span-2 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={w.showOther !== false} onChange={(e) => set({ showOther: e.target.checked })} /> Kalanları "Diğer" olarak göster</label>
                  )}
                  {w.type === 'bar' && (w.measures.length > 1 || w.splitBy) && (
                    <label className="col-span-2 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={!!w.stacked} onChange={(e) => set({ stacked: e.target.checked })} /> Üst üste (yığılmış) göster</label>
                  )}
                </div>
              )}

              {w.type === 'table' && (
                <div className="space-y-3">
                  <Segmented value={w.tableMode ?? 'rows'} onChange={(v) => set({ tableMode: v })} options={[{ value: 'rows', label: 'Satırlar' }, { value: 'summary', label: 'Özet tablo (pivot)' }]} />
                  {w.tableMode === 'summary' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Grupla" className={groupCol?.type === 'date' ? '' : 'col-span-2'}>
                        <Select value={w.groupBy ?? ''} onChange={(e) => set({ groupBy: e.target.value || undefined })}>
                          <option value="">— gruplama yok (genel toplam) —</option>
                          {cols.filter((c) => !isNumeric(c.type)).map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                        </Select>
                      </Field>
                      {groupCol?.type === 'date' && (
                        <Field label="Tarih gruplama">
                          <Select value={w.bucket ?? 'month'} onChange={(e) => set({ bucket: e.target.value as Bucket })}>
                            {(Object.keys(BUCKET_LABEL) as Bucket[]).map((b) => <option key={b} value={b}>{BUCKET_LABEL[b]}</option>)}
                          </Select>
                        </Field>
                      )}
                      <Field label="Sütunlar (hesaplamalar)" className="col-span-2">{measureEditor(6)}</Field>
                    </div>
                  ) : (
                    <Field label="Gösterilecek sütunlar" hint="Hiçbiri seçilmezse tümü gösterilir; sırayı tabloda sürükleyerek değiştirebilirsiniz">
                      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                        {cols.map((c) => {
                          const on = !w.columns?.length || w.columns.includes(c.key)
                          return (
                            <button key={c.key} onClick={() => {
                              const current = w.columns?.length ? w.columns : cols.map((x) => x.key)
                              set({ columns: on ? current.filter((k) => k !== c.key) : [...current, c.key] })
                            }} className={cx('rounded-full border px-2.5 py-0.5 text-[12px]', on ? 'border-[var(--accent)] bg-[var(--today-bg)]' : 'border-[var(--glass-border)] text-[var(--text-muted)]')}>
                              {on ? '✓ ' : ''}{c.name}
                            </button>
                          )
                        })}
                      </div>
                    </Field>
                  )}
                </div>
              )}

              {w.type === 'list' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ana satır"><Select value={w.labelColumn ?? ''} onChange={(e) => set({ labelColumn: e.target.value })}>{cols.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</Select></Field>
                  <Field label="Alt satır"><Select value={w.subColumn ?? ''} onChange={(e) => set({ subColumn: e.target.value || undefined })}><option value="">— yok —</option>{cols.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</Select></Field>
                  <Field label="Değer"><Select value={w.valueColumn ?? ''} onChange={(e) => set({ valueColumn: e.target.value || undefined })}><option value="">— yok —</option>{numeric.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</Select></Field>
                  <Field label="Sıralama"><Select value={w.sortBy ?? 'value'} onChange={(e) => set({ sortBy: e.target.value as 'x' | 'value' })}><option value="value">En yüksek önce</option><option value="x">En düşük önce</option></Select></Field>
                  <Field label="Kaç kayıt"><Input type="number" min={1} max={100} value={w.limit ?? 10} onChange={(e) => set({ limit: Number(e.target.value) || 10 })} /></Field>
                </div>
              )}

              {/* -------- filtreler */}
              <Field label="Filtreler">
                <div className="space-y-1.5">
                  {w.filters.map((f, i) => {
                    const op = OPS.find((o) => o.value === f.op)
                    return (
                      <div key={i} className="grid grid-cols-[1fr_96px_1fr_auto] gap-1.5">
                        <Select value={f.column} onChange={(e) => set({ filters: w.filters.map((x, j) => (j === i ? { ...x, column: e.target.value } : x)) })}>
                          {cols.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                        </Select>
                        <Select value={f.op} onChange={(e) => set({ filters: w.filters.map((x, j) => (j === i ? { ...x, op: e.target.value as FilterOp } : x)) })}>
                          {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </Select>
                        {op?.noValue ? <span /> : <Input value={f.value ?? ''} onChange={(e) => set({ filters: w.filters.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} placeholder="değer" list={`vals-${i}`} />}
                        <Button variant="ghost" className="w-8 px-0" aria-label="Filtreyi kaldır" onClick={() => set({ filters: w.filters.filter((_, j) => j !== i) })}>✕</Button>
                        {data && !op?.noValue && (
                          <datalist id={`vals-${i}`}>
                            {[...new Set(data.rows.map((r) => r[cols.findIndex((c) => c.key === f.column)]).filter((v) => v != null).map(String))].slice(0, 50).map((v) => <option key={v} value={v} />)}
                          </datalist>
                        )}
                      </div>
                    )
                  })}
                  <button className="text-[12px] text-[var(--accent)] hover:underline" disabled={!cols.length}
                    onClick={() => set({ filters: [...w.filters, { column: cols.find((c) => c.type === 'text')?.key ?? cols[0]?.key ?? '', op: 'eq', value: '' }] })}>
                    + Filtre ekle (ör. Tür = Gider)
                  </button>
                </div>
              </Field>
            </>
          )}

          <Field label="Genişlik">
            <div className="flex gap-1">
              {SIZES.map((s) => (
                <button key={s.value} onClick={() => set({ size: s.value })}
                  className={cx('rounded-lg border px-3 py-1 text-[12px]', w.size === s.value ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--glass-border)] hover:bg-[var(--hover)]')}>{s.label}</button>
              ))}
            </div>
          </Field>
        </div>

        {/* -------- Canlı önizleme */}
        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Önizleme</p>
          <div className="rounded-2xl bg-[var(--hover)] p-4">
            <div style={{ maxWidth: `${Math.max(35, (w.size / 12) * 100)}%` }}>
              <GlassCard className="p-4">
                <p className="mb-2 text-[13px] font-semibold">{w.title}</p>
                <WidgetBody widget={w} tableId={previewKey} />
              </GlassCard>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
