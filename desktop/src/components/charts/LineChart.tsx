import { useState } from 'react'
import type { ChartSeries } from './BarChart'
import { Legend, niceRange, seriesColor, Tooltip, TooltipRow, truncate, useWidth } from './chartUtils'

interface Props {
  categories: { key: string; label: string }[]
  series: ChartSeries[]
  format: (v: number, compact?: boolean) => string
  area?: boolean
  height?: number
  /** Son nokta devam eden dönem: kesikli çizilir. */
  partialLast?: boolean
}

/** Zaman serisi çizgi grafik: 2px çizgiler, dikey artı imleci ve tüm serileri gösteren ipucu. */
export function LineChart({ categories, series, format, area = true, height = 260, partialLast }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const values = series.flatMap((s) => s.values)
  const { lo, hi, ticks } = niceRange(Math.min(...values), Math.max(...values))
  const tickLabel = (t: number) => (t === 0 ? '0' : format(t, true))
  // Sol boşluk en uzun eksen etiketine göre: "-250 B ₺" gibi etiketler kırpılmaz
  const pad = { top: 10, right: 14, bottom: 26, left: Math.max(40, 14 + Math.max(...ticks.map((t) => tickLabel(t).length)) * 6.3) }
  const plotW = Math.max(10, width - pad.left - pad.right)
  const plotH = height - pad.top - pad.bottom
  const y = (v: number) => pad.top + plotH - ((v - lo) / (hi - lo)) * plotH
  const n = categories.length
  const x = (i: number) => pad.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const labelEvery = Math.max(1, Math.ceil((n * 52) / Math.max(1, plotW)))

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const rel = (e.clientX - rect.left) / rect.width
    setHover(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))))
  }

  return (
    <div ref={ref} className="relative">
      <Legend items={series.map((s, i) => ({ name: s.name, color: seriesColor(i, s.other) }))} />
      {width > 0 && n > 0 && (
        <svg width={width} height={height} role="img">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 && lo < 0 ? 'var(--text-faint)' : 'var(--grid)'} />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10.5} fill="var(--text-muted)">{tickLabel(t)}</text>
            </g>
          ))}
          {categories.map((c, i) => i % labelEvery === 0 && (
            <text key={c.key} x={x(i)} y={height - 8} textAnchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'} fontSize={11} fill="var(--text-muted)">{truncate(c.label, 10)}</text>
          ))}
          {series.map((s, si) => {
            const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')
            const solidCount = partialLast && n > 1 ? n - 1 : n
            const solid = s.values.slice(0, solidCount).map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')
            const tail = partialLast && n > 1 ? `M${x(n - 2)},${y(s.values[n - 2])} L${x(n - 1)},${y(s.values[n - 1])}` : ''
            return (
              <g key={s.name}>
                {area && series.length === 1 && <path d={`${d} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={seriesColor(si)} opacity={0.1} />}
                <path d={solid} fill="none" stroke={seriesColor(si, s.other)} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {tail && <path d={tail} fill="none" stroke={seriesColor(si, s.other)} strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round" />}
                {n <= 2 && s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={4} fill={seriesColor(si, s.other)} />)}
              </g>
            )
          })}
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + plotH} stroke="var(--text-muted)" strokeDasharray="3 3" />
              {series.map((s, si) => <circle key={si} cx={x(hover)} cy={y(s.values[hover])} r={4.5} fill={seriesColor(si, s.other)} stroke="var(--modal-bg)" strokeWidth={2} />)}
            </g>
          )}
          <rect x={pad.left} y={pad.top} width={plotW} height={plotH} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        </svg>
      )}
      {hover != null && (
        <Tooltip x={x(hover)} y={height / 2} width={width}>
          <p className="mb-1 font-semibold">{categories[hover].label}</p>
          {series.map((s, si) => <TooltipRow key={s.name} color={seriesColor(si, s.other)} label={s.name} value={format(s.values[hover])} />)}
          {partialLast && hover === n - 1 && <p className="mt-1 text-[11px] text-[var(--text-muted)]">Dönem devam ediyor</p>}
        </Tooltip>
      )}
    </div>
  )
}
