import { useState } from 'react'
import { barPath, Legend, niceTicks, seriesColor, Tooltip, TooltipRow, truncate, useWidth } from './chartUtils'

export interface ChartSeries { name: string; values: number[]; other?: boolean }

interface Props {
  categories: { key: string; label: string }[]
  series: ChartSeries[]
  format: (v: number, compact?: boolean) => string
  horizontal?: boolean
  stacked?: boolean
  height?: number
  partialLast?: boolean
}

const GAP = 2 // dolgu arası yüzey boşluğu

/** Sütun grafik: dikey ya da yatay, gruplu ya da yığılmış. Tek eksen, sıfırdan başlar. */
export function BarChart({ categories, series, format, horizontal, stacked, height = 260, partialLast }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const multi = series.length > 1
  const totals = categories.map((_, ci) => series.reduce((s, se) => s + Math.max(0, se.values[ci]), 0))
  const peak = stacked && multi ? Math.max(0, ...totals) : Math.max(0, ...series.flatMap((s) => s.values))
  const { top, ticks } = niceTicks(peak)
  const legend = series.map((s, i) => ({ name: s.name, color: seriesColor(i, s.other) }))

  const hovered = hover != null ? categories[hover] : null
  const tooltip = hovered && (
    <>
      <p className="mb-1 font-semibold">{hovered.label}</p>
      {series.map((s, i) => <TooltipRow key={s.name} color={seriesColor(i, s.other)} label={s.name} value={format(s.values[hover!])} />)}
      {stacked && multi && <div className="mt-1 flex justify-between border-t border-[var(--glass-border)] pt-1 font-medium"><span>Toplam</span><span className="tabular-nums">{format(totals[hover!])}</span></div>}
      {partialLast && hover === categories.length - 1 && <p className="mt-1 text-[11px] text-[var(--text-muted)]">Dönem devam ediyor</p>}
    </>
  )

  if (horizontal) {
    const rowH = Math.max(22, Math.min(34, 260 / Math.max(1, categories.length)))
    const h = categories.length * rowH + 22
    const labelW = Math.min(Math.max(80, width * 0.32), 200)
    const left = labelW + 8
    const plotW = Math.max(10, width - left - 12)
    const xs = (v: number) => (v / top) * plotW
    const barH = Math.min(18, (rowH - 8) / (stacked || !multi ? 1 : series.length))
    return (
      <div ref={ref} className="relative">
        <Legend items={legend} />
        {width > 0 && (
          <svg width={width} height={h} role="img">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={left + xs(t)} x2={left + xs(t)} y1={0} y2={h - 18} stroke="var(--grid)" />
                <text x={left + xs(t)} y={h - 4} textAnchor={t === top ? 'end' : t === 0 ? 'start' : 'middle'} fontSize={10.5} fill="var(--text-muted)">{format(t, true)}</text>
              </g>
            ))}
            {categories.map((c, ci) => {
              const y0 = ci * rowH
              let acc = 0
              return (
                <g key={c.key} opacity={hover == null || hover === ci ? 1 : 0.45}>
                  <text x={labelW} y={y0 + rowH / 2} dy="0.32em" textAnchor="end" fontSize={11.5} fill="var(--text)">{truncate(c.label, Math.floor(labelW / 6.5))}</text>
                  {series.map((s, si) => {
                    const v = Math.max(0, s.values[ci])
                    const w = xs(v)
                    if (stacked || !multi) {
                      const x = left + xs(acc) + (acc > 0 ? GAP / 2 : 0)
                      acc += v
                      const last = si === series.length - 1 || !stacked
                      return <path key={si} d={last ? barPath(x, y0 + (rowH - barH) / 2, w - (acc - v > 0 ? GAP / 2 : 0), barH, 4, true) : `M${x},${y0 + (rowH - barH) / 2}h${Math.max(0, w - GAP / 2)}v${barH}h${-Math.max(0, w - GAP / 2)}Z`} fill={seriesColor(si, s.other)} />
                    }
                    const y = y0 + (rowH - barH * series.length - GAP * (series.length - 1)) / 2 + si * (barH + GAP)
                    return <path key={si} d={barPath(left, y, w, barH, 4, true)} fill={seriesColor(si, s.other)} />
                  })}
                  <rect x={0} y={y0} width={width} height={rowH} fill="transparent" onMouseEnter={() => setHover(ci)} onMouseLeave={() => setHover(null)} />
                </g>
              )
            })}
          </svg>
        )}
        {tooltip && hover != null && <Tooltip x={left + plotW / 2} y={hover * rowH + rowH / 2 + 24} width={width}>{tooltip}</Tooltip>}
      </div>
    )
  }

  const pad = { top: 8, right: 8, bottom: 26, left: 52 }
  const plotW = Math.max(10, width - pad.left - pad.right)
  const plotH = height - pad.top - pad.bottom
  const y = (v: number) => pad.top + plotH - (v / top) * plotH
  const band = plotW / Math.max(1, categories.length)
  const groupW = Math.min(band * 0.72, stacked || !multi ? 40 : 18 * series.length + GAP * (series.length - 1))
  const barW = stacked || !multi ? groupW : (groupW - GAP * (series.length - 1)) / series.length
  const labelEvery = Math.max(1, Math.ceil((categories.length * 44) / Math.max(1, plotW)))

  return (
    <div ref={ref} className="relative">
      <Legend items={legend} />
      {width > 0 && (
        <svg width={width} height={height} role="img">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10.5} fill="var(--text-muted)">{t === 0 ? '0' : format(t, true)}</text>
            </g>
          ))}
          {categories.map((c, ci) => {
            const cx = pad.left + band * ci + band / 2
            let acc = 0
            return (
              <g key={c.key} opacity={hover == null || hover === ci ? 1 : 0.45}>
                {series.map((s, si) => {
                  const v = Math.max(0, s.values[ci])
                  if (stacked || !multi) {
                    const yTop = y(acc + v)
                    const h = y(acc) - yTop - (acc > 0 ? GAP : 0)
                    acc += v
                    const isTop = si === series.length - 1 || !stacked
                    return <path key={si} d={isTop ? barPath(cx - barW / 2, yTop, barW, h, 4) : `M${cx - barW / 2},${yTop}h${barW}v${Math.max(0, h)}h${-barW}Z`} fill={seriesColor(si, s.other)} />
                  }
                  const x = cx - groupW / 2 + si * (barW + GAP)
                  return <path key={si} d={barPath(x, y(v), barW, y(0) - y(v), 4)} fill={seriesColor(si, s.other)} />
                })}
                {ci % labelEvery === 0 && (
                  <text x={cx} y={height - 8} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{truncate(c.label, Math.max(4, Math.floor((band * labelEvery) / 6.5)))}</text>
                )}
                <rect x={pad.left + band * ci} y={pad.top} width={band} height={plotH} fill="transparent" onMouseEnter={() => setHover(ci)} onMouseLeave={() => setHover(null)} />
              </g>
            )
          })}
        </svg>
      )}
      {tooltip && hover != null && <Tooltip x={pad.left + band * hover + band / 2} y={height / 2} width={width}>{tooltip}</Tooltip>}
    </div>
  )
}
