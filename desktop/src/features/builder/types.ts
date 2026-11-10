import type { CellValue } from '../../types/electron'

export type ColType = 'text' | 'number' | 'money' | 'date'

export interface DataColumn {
  key: string
  name: string
  type: ColType
}

/** Bileşenlerin okuduğu ortak tablo biçimi (Excel veri kümesi ya da sistem verisi). */
export interface TabularData {
  columns: DataColumn[]
  rows: CellValue[][]
}

export type SystemSourceKey = 'gelir-gider' | 'puantaj' | 'bordro' | 'vardiya' | 'personel'

/** 'sample': Örnek Sayfalar galerisindeki önizleme verisi (yalnızca bellekte). */
export type SourceRef = { kind: 'system'; key: SystemSourceKey } | { kind: 'dataset'; id: string } | { kind: 'sample'; id: string }

export type Agg = 'sum' | 'avg' | 'count' | 'countDistinct' | 'min' | 'max'
export type RangePreset = 'all' | 'thisMonth' | 'lastMonth' | 'last3' | 'last6' | 'last12' | 'thisYear' | 'lastYear'
export type Bucket = 'day' | 'week' | 'month' | 'quarter' | 'year'
export type FilterOp = 'eq' | 'neq' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'empty' | 'notEmpty'

export interface Filter {
  column: string
  op: FilterOp
  value?: string
}

export interface Measure {
  agg: Agg
  /** count için boş olabilir. */
  column?: string
  label?: string
}

export type WidgetType = 'stat' | 'table' | 'list' | 'bar' | 'hbar' | 'line' | 'donut' | 'text'

/**
 * Bir bileşenin tüm ayarları. Tek bir arayüzde tutulur: tür değiştirildiğinde ayarlar kaybolmaz.
 * Sayfa yerleşimi bu nesnelerin listesi olarak sunucuda JSON saklanır.
 */
export interface Widget {
  id: string
  type: WidgetType
  title: string
  size: number // 12'lik ızgarada genişlik
  source?: SourceRef
  range: RangePreset
  dateColumn?: string
  filters: Filter[]

  // gösterge / grafik / özet tablo
  measures: Measure[]
  // grafik
  x?: string
  bucket?: Bucket
  splitBy?: string
  sortBy?: 'x' | 'value'
  limit?: number
  stacked?: boolean
  /** Sınırın dışında kalan kategoriler "Diğer" olarak toplansın mı (varsayılan: evet) */
  showOther?: boolean
  // tablo
  tableMode?: 'rows' | 'summary'
  columns?: string[]
  groupBy?: string
  // liste
  labelColumn?: string
  subColumn?: string
  valueColumn?: string
  // metin
  text?: string
}

export interface PageLayout {
  widgets: Widget[]
}

export interface CustomPage {
  id: string
  title: string
  icon: string | null
  sortOrder: number
  layout: PageLayout
  updatedAt: string | null
}

export interface DatasetSummary {
  id: string
  name: string
  description: string | null
  sourceFileName: string | null
  sourceSheet: string | null
  columns: DataColumn[]
  rowCount: number
  refreshedAt: string
}

export const newId = () => Math.random().toString(36).slice(2, 10)

export const blankWidget = (patch: Partial<Widget> = {}): Widget => ({
  id: newId(), type: 'bar', title: 'Yeni bileşen', size: 6, range: 'all', filters: [],
  measures: [{ agg: 'sum' }], sortBy: 'value', limit: 10, tableMode: 'rows', ...patch,
})
