import { useMemo } from 'react'
import { BarChart } from '../../components/charts/BarChart'
import { DonutChart } from '../../components/charts/DonutChart'
import { LineChart } from '../../components/charts/LineChart'
import { DataTable, type Column } from '../../components/data/DataTable'
import type { CellValue } from '../../types/electron'
import { applyWidgetFilters, colIndex, column, formatValue, groupForChart, measureType, measureValue, RANGE_LABEL, summarize } from './engine'
import { rangeOnClient, useSourceData } from './sources'
import type { ColType, TabularData, Widget } from './types'

const AGG_SHORT = { sum: 'Toplam', avg: 'Ortalama', count: 'Adet', countDistinct: 'Farklı değer', min: 'En düşük', max: 'En yüksek' } as const

/** Bileşenin kaynağını yükler ve filtreleri uygular. */
export function useWidgetData(w: Widget) {
  const { data, loading, error } = useSourceData(w.type === 'text' ? undefined : w.source, w.range)
  const filtered = useMemo(() => (data ? applyWidgetFilters(data, w, rangeOnClient(w.source)) : undefined), [data, w])
  return { data: filtered, raw: data, loading, error }
}

export function WidgetBody({ widget: w, tableId, asTable }: { widget: Widget; tableId: string; asTable?: boolean }) {
  const { data, loading, error } = useWidgetData(w)

  if (w.type === 'text') return <TextBody text={w.text ?? ''} />
  if (!w.source) return <Hint>Ayarlardan bir veri kaynağı seçin.</Hint>
  if (error) return <Hint tone="error">Veri alınamadı: {error}</Hint>
  if (!data) return <Hint>{loading ? 'Yükleniyor…' : 'Veri yok.'}</Hint>

  switch (w.type) {
    case 'stat': return <StatBody w={w} data={data} />
    case 'table': return <TableBody w={w} data={data} tableId={tableId} />
    case 'list': return <ListBody w={w} data={data} />
    default: return <ChartBody w={w} data={data} tableId={tableId} asTable={asTable} />
  }
}

function Hint({ children, tone }: { children: React.ReactNode; tone?: 'error' }) {
  return <p className={`py-6 text-center text-[13px] ${tone === 'error' ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`}>{children}</p>
}

const fmt = (type: ColType) => (v: number, compact?: boolean) => formatValue(v, type, compact)

// ------------------------------------------------------------ gösterge
function StatBody({ w, data }: { w: Widget; data: TabularData }) {
  const m = w.measures[0] ?? { agg: 'count' }
  const value = measureValue(data, data.rows, m)
  return (
    <div>
      <p className="text-[28px] font-semibold leading-tight tracking-tight tabular-nums">{formatValue(value, measureType(data, m))}</p>
      <p className="mt-1 text-[12px] text-[var(--text-muted)]">
        {m.agg === 'count' ? '' : `${AGG_SHORT[m.agg]} · `}{data.rows.length.toLocaleString('tr-TR')} kayıt{w.range !== 'all' ? ` · ${RANGE_LABEL[w.range]}` : ''}{w.filters.length ? ' · filtreli' : ''}
      </p>
    </div>
  )
}

// ------------------------------------------------------------ tablo
function toColumns(data: TabularData, keys?: string[]): Column<CellValue[]>[] {
  const cols = keys?.length ? keys.map((k) => column(data, k)).filter((c): c is NonNullable<typeof c> => !!c) : data.columns
  return cols.map((c) => {
    const i = colIndex(data, c.key)
    const numeric = c.type === 'number' || c.type === 'money'
    return {
      key: c.key,
      header: c.name,
      type: c.type,
      align: numeric ? 'right' : undefined,
      total: numeric && !/saat ucreti|oran|yuzde|fiyat|katsayi/i.test(c.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i')),
      value: (r) => r[i] ?? null,
      render: (r) => formatValue(r[i] ?? null, c.type),
    } satisfies Column<CellValue[]>
  })
}

function TableBody({ w, data, tableId }: { w: Widget; data: TabularData; tableId: string }) {
  const view = useMemo(() => (w.tableMode === 'summary' ? summarize(data, w) : data), [w, data])
  const columns = useMemo(() => toColumns(view, w.tableMode === 'summary' ? undefined : w.columns), [view, w.tableMode, w.columns])
  const typeOf = (key: string) => view.columns.find((c) => c.key === key)?.type ?? 'number'
  // Satır anahtarı: satırın dizideki yeri (sıralama/sayfalamada sabit kalır)
  const keys = useMemo(() => new Map(view.rows.map((r, i) => [r, String(i)])), [view.rows])
  return (
    <DataTable tableId={tableId} exportName={w.title} columns={columns} rows={view.rows} rowKey={(r) => keys.get(r) ?? ''}
      pageSize={10} formatTotal={(key, total) => formatValue(total, typeOf(key))} />
  )
}

// ------------------------------------------------------------ liste
function ListBody({ w, data }: { w: Widget; data: TabularData }) {
  const li = colIndex(data, w.labelColumn)
  const si = colIndex(data, w.subColumn)
  const vi = colIndex(data, w.valueColumn)
  const vType = data.columns[vi]?.type ?? 'text'
  const rows = useMemo(() => {
    const list = [...data.rows]
    if (vi >= 0) list.sort((a, b) => (w.sortBy === 'x' ? 1 : -1) * ((Number(a[vi]) || 0) - (Number(b[vi]) || 0)))
    return list.slice(0, w.limit ?? 10)
  }, [data, vi, w.sortBy, w.limit])
  if (li < 0) return <Hint>Ayarlardan bir etiket sütunu seçin.</Hint>
  return (
    <ul className="divide-y divide-[var(--row-border)]">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center gap-3 py-2 text-[13px]">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--hover)] text-[11px] font-semibold tabular-nums text-[var(--text-muted)]">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate">{formatValue(r[li] ?? null, data.columns[li].type)}</p>
            {si >= 0 && <p className="truncate text-[11px] text-[var(--text-muted)]">{formatValue(r[si] ?? null, data.columns[si].type)}</p>}
          </div>
          {vi >= 0 && <span className="font-medium tabular-nums">{formatValue(r[vi] ?? null, vType)}</span>}
        </li>
      ))}
      {rows.length === 0 && <li className="py-4 text-center text-[13px] text-[var(--text-muted)]">Kayıt yok.</li>}
    </ul>
  )
}

// ------------------------------------------------------------ grafikler
function ChartBody({ w, data, tableId, asTable }: { w: Widget; data: TabularData; tableId: string; asTable?: boolean }) {
  const g = useMemo(() => groupForChart(data, w.type === 'donut' ? { ...w, splitBy: undefined, measures: w.measures.slice(0, 1), limit: Math.min(w.limit ?? 7, 7) } : w), [data, w])
  if (!w.x) return <Hint>Ayarlardan {w.type === 'donut' ? 'dilim' : 'kategori / X ekseni'} sütununu seçin.</Hint>
  if (g.categories.length === 0) return <Hint>Seçilen filtrelerle veri yok.</Hint>

  // Erişilebilirlik ve kontrast için: her grafik tablo olarak da görülebilir
  if (asTable) {
    const table: TabularData = {
      columns: [{ key: 'c', name: column(data, w.x)?.name ?? '', type: 'text' }, ...g.series.map((s, i) => ({ key: `s${i}`, name: s.name, type: g.valueType }))],
      rows: g.categories.map((c, ci) => [c.label, ...g.series.map((s) => s.values[ci])]),
    }
    return <DataTable tableId={`${tableId}-table`} exportName={w.title} columns={toColumns(table)} rows={table.rows} rowKey={(r) => String(r[0])} pageSize={10} formatTotal={(_k, t) => formatValue(t, g.valueType)} />
  }

  const format = fmt(g.valueType)
  if (w.type === 'donut') return <DonutChart slices={g.categories.map((c, i) => ({ label: c.label, value: g.series[0]?.values[i] ?? 0, other: c.key === 'Diğer' }))} format={(v) => format(v)} />
  if (w.type === 'line') return <LineChart categories={g.categories} series={g.series} format={format} partialLast={g.partialLast} />
  return <BarChart categories={g.categories} series={g.series} format={format} horizontal={w.type === 'hbar'} stacked={w.stacked} partialLast={g.partialLast} />
}

// ------------------------------------------------------------ metin
function TextBody({ text }: { text: string }) {
  if (!text.trim()) return <Hint>Ayarlardan metin yazın.</Hint>
  return (
    <div className="space-y-1.5 text-[13px] leading-relaxed">
      {text.split('\n').map((line, i) =>
        line.startsWith('# ') ? <h3 key={i} className="text-[17px] font-semibold">{line.slice(2)}</h3>
        : line.startsWith('- ') ? <p key={i} className="pl-3 before:mr-2 before:content-['•']">{line.slice(2)}</p>
        : line.trim() === '' ? <div key={i} className="h-2" />
        : <p key={i}>{line}</p>)}
    </div>
  )
}
