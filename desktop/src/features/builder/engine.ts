import type { CellValue } from '../../types/electron'
import { compactMoney, isoDate, money, MONTHS_SHORT, number, parseDate } from '../../lib/format'
import type { Agg, Bucket, ColType, DataColumn, Filter, Measure, RangePreset, TabularData, Widget } from './types'

/**
 * Sorgu motoru: filtre → gruplama → toplama → sıralama.
 * Tamamen istemci tarafında çalışır (veri kümeleri en fazla 50.000 satır).
 */

export const AGG_LABEL: Record<Agg, string> = {
  sum: 'Toplam', avg: 'Ortalama', count: 'Kayıt sayısı', countDistinct: 'Farklı değer sayısı', min: 'En düşük', max: 'En yüksek',
}

export const RANGE_LABEL: Record<RangePreset, string> = {
  all: 'Tüm zamanlar', thisMonth: 'Bu ay', lastMonth: 'Geçen ay', last3: 'Son 3 ay', last6: 'Son 6 ay', last12: 'Son 12 ay', thisYear: 'Bu yıl', lastYear: 'Geçen yıl',
}

export const BUCKET_LABEL: Record<Bucket, string> = { day: 'Gün', week: 'Hafta', month: 'Ay', quarter: 'Çeyrek', year: 'Yıl' }

export const OTHER = 'Diğer'

export const colIndex = (data: TabularData, key?: string) => (key ? data.columns.findIndex((c) => c.key === key) : -1)
export const column = (data: TabularData, key?: string): DataColumn | undefined => data.columns.find((c) => c.key === key)
export const isNumeric = (t?: ColType) => t === 'number' || t === 'money'

// ------------------------------------------------------------ tarih aralığı
export function resolveRange(preset: RangePreset, today = new Date()): { from?: string; to?: string } {
  const y = today.getFullYear()
  const m = today.getMonth()
  const monthStart = (offset: number) => new Date(y, m + offset, 1)
  const monthEnd = (offset: number) => new Date(y, m + offset + 1, 0)
  switch (preset) {
    case 'thisMonth': return { from: isoDate(monthStart(0)), to: isoDate(monthEnd(0)) }
    case 'lastMonth': return { from: isoDate(monthStart(-1)), to: isoDate(monthEnd(-1)) }
    case 'last3': return { from: isoDate(monthStart(-2)), to: isoDate(monthEnd(0)) }
    case 'last6': return { from: isoDate(monthStart(-5)), to: isoDate(monthEnd(0)) }
    case 'last12': return { from: isoDate(monthStart(-11)), to: isoDate(monthEnd(0)) }
    case 'thisYear': return { from: `${y}-01-01`, to: `${y}-12-31` }
    case 'lastYear': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }
    default: return {}
  }
}

// ------------------------------------------------------------ filtreler
const toNum = (v: CellValue) => (typeof v === 'number' ? v : v == null || v === '' ? NaN : Number(String(v).replace(',', '.')))
const toStr = (v: CellValue) => (v == null ? '' : String(v))

function matches(v: CellValue, f: Filter, type: ColType): boolean {
  const s = toStr(v).toLocaleLowerCase('tr')
  const target = (f.value ?? '').toLocaleLowerCase('tr').trim()
  const numeric = isNumeric(type)
  const cmp = () => (numeric ? toNum(v) - toNum(f.value ?? '') : s.localeCompare(target, 'tr', { numeric: true }))
  switch (f.op) {
    case 'eq': return numeric ? toNum(v) === toNum(f.value ?? '') : s === target
    case 'neq': return numeric ? toNum(v) !== toNum(f.value ?? '') : s !== target
    case 'contains': return s.includes(target)
    case 'gt': return cmp() > 0
    case 'gte': return cmp() >= 0
    case 'lt': return cmp() < 0
    case 'lte': return cmp() <= 0
    case 'empty': return s === ''
    case 'notEmpty': return s !== ''
  }
}

/** Widget'ın filtrelerini ve (veri kümelerinde) tarih aralığını uygular. */
export function applyWidgetFilters(data: TabularData, w: Pick<Widget, 'filters' | 'range' | 'dateColumn'>, rangeOnClient: boolean): TabularData {
  let rows = data.rows
  const active = w.filters.filter((f) => f.column && colIndex(data, f.column) >= 0 && (f.op === 'empty' || f.op === 'notEmpty' || (f.value ?? '') !== ''))
  for (const f of active) {
    const i = colIndex(data, f.column)
    const type = data.columns[i].type
    rows = rows.filter((r) => matches(r[i] ?? null, f, type))
  }
  if (rangeOnClient && w.range !== 'all' && w.dateColumn) {
    const i = colIndex(data, w.dateColumn)
    const { from, to } = resolveRange(w.range)
    if (i >= 0) rows = rows.filter((r) => { const d = toStr(r[i] ?? null).slice(0, 10); return d !== '' && (!from || d >= from) && (!to || d <= to) })
  }
  return { columns: data.columns, rows }
}

// ------------------------------------------------------------ toplama
export function aggregate(values: CellValue[], agg: Agg): number {
  if (agg === 'count') return values.length
  if (agg === 'countDistinct') return new Set(values.filter((v) => v != null && v !== '').map(toStr)).size
  const nums = values.map(toNum).filter((n) => Number.isFinite(n))
  if (nums.length === 0) return 0
  switch (agg) {
    case 'sum': return nums.reduce((a, b) => a + b, 0)
    case 'avg': return nums.reduce((a, b) => a + b, 0) / nums.length
    case 'min': return Math.min(...nums)
    case 'max': return Math.max(...nums)
  }
}

export function measureValue(data: TabularData, rows: CellValue[][], m: Measure): number {
  const i = colIndex(data, m.column)
  if (m.agg === 'count' || i < 0) return m.agg === 'count' ? rows.length : 0
  return aggregate(rows.map((r) => r[i] ?? null), m.agg)
}

/** Ölçünün sonuç tipi: adet sayıları "number", diğerleri sütunun tipini (ör. tutar) korur. */
export function measureType(data: TabularData | undefined, m: Measure): ColType {
  if (m.agg === 'count' || m.agg === 'countDistinct') return 'number'
  return column(data ?? { columns: [], rows: [] }, m.column)?.type ?? 'number'
}

export function measureLabel(data: TabularData | undefined, m: Measure): string {
  if (m.label) return m.label
  if (m.agg === 'count') return AGG_LABEL.count
  const name = column(data ?? { columns: [], rows: [] }, m.column)?.name ?? ''
  return `${AGG_LABEL[m.agg]} ${name}`.trim()
}

// ------------------------------------------------------------ tarih kovaları
export function bucketOf(value: CellValue, bucket: Bucket): { key: string; label: string } | null {
  const s = toStr(value).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = parseDate(s)
  const y = d.getFullYear()
  switch (bucket) {
    case 'day': return { key: s, label: `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` }
    case 'week': {
      const monday = new Date(y, d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
      return { key: isoDate(monday), label: `${monday.getDate()} ${MONTHS_SHORT[monday.getMonth()]}` }
    }
    case 'month': return { key: s.slice(0, 7), label: `${MONTHS_SHORT[d.getMonth()]} ${String(y).slice(2)}` }
    case 'quarter': { const q = Math.floor(d.getMonth() / 3) + 1; return { key: `${y}-Q${q}`, label: `Ç${q} ${y}` } }
    case 'year': return { key: String(y), label: String(y) }
  }
}

/** Tarih aralığına uygun kova önerir (ör. 2 yıllık veride "ay"). */
export function suggestBucket(data: TabularData, key: string): Bucket {
  const i = colIndex(data, key)
  const dates = data.rows.map((r) => toStr(r[i] ?? null).slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
  if (dates.length < 2) return 'month'
  const days = (parseDate(dates[dates.length - 1]).getTime() - parseDate(dates[0]).getTime()) / 86400000
  return days > 1100 ? 'year' : days > 120 ? 'month' : days > 31 ? 'week' : 'day'
}

// ------------------------------------------------------------ gruplama (grafikler, özet tablo)
export interface Grouped {
  categories: { key: string; label: string }[]
  series: { name: string; values: number[]; other?: boolean }[]
  valueType: ColType
  /** Son tarih kovası içinde bulunulan dönemse (ör. bu ay) henüz tamamlanmamıştır. */
  partialLast?: boolean
}

const MAX_SERIES = 6

export function groupForChart(data: TabularData, w: Widget): Grouped {
  const xi = colIndex(data, w.x)
  const xCol = data.columns[xi]
  const measures = w.measures.length ? w.measures : [{ agg: 'count' as Agg }]
  const valueType = measureType(data, measures[0])
  if (xi < 0) return { categories: [], series: [], valueType }

  const isDate = xCol.type === 'date'
  const bucket = w.bucket ?? 'month'
  const keyOf = (r: CellValue[]) => {
    if (isDate) return bucketOf(r[xi] ?? null, bucket)
    const v = toStr(r[xi] ?? null).trim()
    return { key: v || '(boş)', label: v || '(boş)' }
  }

  // satırları kategorilere ayır
  const groups = new Map<string, { label: string; rows: CellValue[][] }>()
  for (const r of data.rows) {
    const k = keyOf(r)
    if (!k) continue
    const g = groups.get(k.key) ?? { label: k.label, rows: [] }
    g.rows.push(r)
    groups.set(k.key, g)
  }

  let keys = [...groups.keys()]
  const total = (k: string) => measureValue(data, groups.get(k)!.rows, measures[0])
  const limit = Math.max(1, w.limit ?? (isDate ? 24 : 10))
  let otherRows: CellValue[][] = []

  if (isDate || w.sortBy === 'x') {
    keys.sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }))
    if (isDate && keys.length > limit) keys = keys.slice(-limit) // en son N dönem
  } else {
    keys.sort((a, b) => total(b) - total(a))
    if (keys.length > limit) {
      if (w.showOther !== false) otherRows = keys.slice(limit).flatMap((k) => groups.get(k)!.rows)
      keys = keys.slice(0, limit)
    }
  }

  const categories = keys.map((k) => ({ key: k, label: groups.get(k)!.label }))
  if (otherRows.length) categories.push({ key: OTHER, label: OTHER })
  const partialLast = isDate && categories.length > 1 && categories[categories.length - 1].key === bucketOf(isoDate(new Date()), bucket)?.key
  const rowsOf = (key: string) => (key === OTHER ? otherRows : groups.get(key)!.rows)

  // seriler: ya her ölçü bir seri, ya da tek ölçü + "seriye ayır" sütununun değerleri
  const si = colIndex(data, w.splitBy)
  if (si >= 0 && si !== xi) {
    const m = measures[0]
    const totals = new Map<string, number>()
    for (const r of data.rows) {
      const s = toStr(r[si] ?? null) || '(boş)'
      totals.set(s, (totals.get(s) ?? 0) + (m.agg === 'count' ? 1 : toNum(r[colIndex(data, m.column)] ?? null) || 0))
    }
    const top = [...totals.keys()].sort((a, b) => totals.get(b)! - totals.get(a)!)
    const named = top.slice(0, MAX_SERIES)
    const hasOther = top.length > MAX_SERIES
    const series: Grouped['series'] = named.map((name) => ({
      name,
      values: categories.map((c) => measureValue(data, rowsOf(c.key).filter((r) => (toStr(r[si] ?? null) || '(boş)') === name), m)),
    }))
    if (hasOther) {
      series.push({
        name: OTHER, other: true,
        values: categories.map((c) => measureValue(data, rowsOf(c.key).filter((r) => !named.includes(toStr(r[si] ?? null) || '(boş)')), m)),
      })
    }
    return { categories, series, valueType, partialLast }
  }

  return {
    partialLast,
    categories,
    series: measures.map((m) => ({ name: measureLabel(data, m), values: categories.map((c) => measureValue(data, rowsOf(c.key), m)) })),
    valueType,
  }
}

/** Özet (pivot) tablo: gruplama sütunu + ölçüler → yeni bir tablo. */
export function summarize(data: TabularData, w: Widget): TabularData {
  const gi = colIndex(data, w.groupBy)
  const measures = w.measures.length ? w.measures : [{ agg: 'count' as Agg }]
  if (gi < 0) {
    return {
      columns: measures.map((m, i) => ({ key: `m${i}`, name: measureLabel(data, m), type: measureType(data, m) })),
      rows: [measures.map((m) => measureValue(data, data.rows, m))],
    }
  }
  const g = groupForChart(data, { ...w, x: w.groupBy, splitBy: undefined, sortBy: data.columns[gi].type === 'date' ? 'x' : 'value', limit: w.limit ?? 1000 })
  return {
    columns: [
      { key: 'group', name: data.columns[gi].name, type: 'text' },
      ...measures.map((m, i) => ({ key: `m${i}`, name: measureLabel(data, m), type: measureType(data, m) })),
    ],
    rows: g.categories.map((c, ci) => [c.label, ...g.series.map((s) => s.values[ci])]),
  }
}

// ------------------------------------------------------------ biçimlendirme
export function formatValue(v: CellValue, type: ColType, compact = false): string {
  if (v == null || v === '') return '—'
  if (type === 'money') return compact ? compactMoney(Number(v)) : money(Number(v))
  if (type === 'number') {
    const n = Number(v)
    return compact && Math.abs(n) >= 10000 ? new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : number(n)
  }
  if (type === 'date') {
    const s = String(v).slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return String(v)
    const d = parseDate(s)
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
  }
  return String(v)
}

/** Kategori sayısını ve benzersiz değerleri hesaplar (otomatik sayfa ve düzenleyici önerileri için). */
export function distinctCount(data: TabularData, key: string) {
  const i = colIndex(data, key)
  return new Set(data.rows.map((r) => toStr(r[i] ?? null))).size
}
