import { colIndex, distinctCount, isNumeric, suggestBucket } from './engine'
import { defaultDateColumn } from './sources'
import type { Agg, DataColumn, TabularData, Widget, WidgetType } from './types'

const valid = (data: TabularData, key?: string) => !!key && colIndex(data, key) >= 0

/** Kategori için uygun metin sütunu: 2–50 farklı değer (ör. Kategori, Bölge, Çalışan). */
export function categoryColumns(data: TabularData): DataColumn[] {
  return data.columns
    .filter((c) => c.type === 'text')
    .map((c) => ({ c, n: distinctCount(data, c.key) }))
    .filter((x) => x.n >= 2 && x.n <= Math.max(50, data.rows.length * 0.2))
    .sort((a, b) => a.n - b.n)
    .map((x) => x.c)
}

/**
 * Seçilen kaynak/tür için boş ya da geçersiz ayarları akıllıca doldurur.
 * Kullanıcının seçtiği geçerli ayarlara dokunmaz.
 */
export function fillDefaults(w: Widget, data: TabularData | undefined): Widget {
  if (!data || w.type === 'text') return w
  const next: Widget = { ...w }
  const numeric = data.columns.filter((c) => isNumeric(c.type))
  const dates = data.columns.filter((c) => c.type === 'date')
  const cats = categoryColumns(data)
  const firstText = data.columns.find((c) => c.type === 'text')

  if (!valid(data, next.dateColumn)) next.dateColumn = defaultDateColumn(w.source) ?? dates[0]?.key

  next.measures = (next.measures.length ? next.measures : [{ agg: 'sum' as Agg }]).map((m) => {
    if (m.agg === 'count') return m
    if (valid(data, m.column)) return m
    return numeric[0] ? { ...m, column: numeric[0].key } : { agg: 'count' as Agg }
  })

  const wantsDate = w.type === 'line'
  if (['bar', 'hbar', 'line', 'donut'].includes(w.type)) {
    const xCol = data.columns.find((c) => c.key === next.x)
    if (!xCol || (wantsDate && xCol.type !== 'date' && dates.length)) next.x = (wantsDate ? dates[0]?.key : undefined) ?? cats[0]?.key ?? dates[0]?.key ?? firstText?.key
    const x = data.columns.find((c) => c.key === next.x)
    if (x?.type === 'date' && !next.bucket) next.bucket = suggestBucket(data, x.key)
    if (next.splitBy && !valid(data, next.splitBy)) next.splitBy = undefined
  }
  if (w.type === 'table' && next.tableMode === 'summary' && !valid(data, next.groupBy)) next.groupBy = cats[0]?.key ?? dates[0]?.key
  if (w.type === 'list') {
    if (!valid(data, next.labelColumn)) next.labelColumn = cats.at(-1)?.key ?? firstText?.key
    if (!valid(data, next.valueColumn)) next.valueColumn = numeric[0]?.key
  }
  return next
}

export const WIDGET_TYPES: { type: WidgetType; label: string; icon: string; hint: string; size: number }[] = [
  { type: 'stat', label: 'Gösterge', icon: '#', hint: 'Tek bir sayı: toplam, ortalama, adet', size: 3 },
  { type: 'bar', label: 'Sütun', icon: '▮▮', hint: 'Kategorileri ya da dönemleri karşılaştırın', size: 6 },
  { type: 'hbar', label: 'Yatay Sütun', icon: '☰', hint: 'Uzun adlı kategoriler, sıralamalar (en çok…)', size: 6 },
  { type: 'line', label: 'Çizgi', icon: '⟋', hint: 'Zaman içindeki değişim', size: 8 },
  { type: 'donut', label: 'Halka', icon: '◔', hint: 'Bütünün parçaları (en fazla 7 dilim)', size: 4 },
  { type: 'table', label: 'Tablo', icon: '▦', hint: 'Satırlar ya da özet (pivot) tablo', size: 12 },
  { type: 'list', label: 'Liste', icon: '≡', hint: 'İlk N kayıt: en yüksek tutarlar, son işlemler', size: 4 },
  { type: 'text', label: 'Metin', icon: 'T', hint: 'Başlık, açıklama, not', size: 12 },
]
