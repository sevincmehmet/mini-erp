import { useState } from 'react'
import { seriesColor, Tooltip } from './chartUtils'

interface Props {
  slices: { label: string; value: number; other?: boolean }[]
  format: (v: number) => string
  size?: number
}

/** Bütünün parçaları (en fazla 7 dilim + Diğer). Lejantta değer ve yüzde her zaman yazılı. */
export function DonutChart({ slices, format, size = 180 }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const items = slices.filter((s) => s.value > 0)
  const total = items.reduce((s, x) => s + x.value, 0)
  const r = size / 2
  const inner = r * 0.62
  let angle = -Math.PI / 2

  const arcs = items.map((s, i) => {
    const sweep = total ? (s.value / total) * Math.PI * 2 : 0
    const a0 = angle
    const a1 = angle + sweep
    angle = a1
    const large = sweep > Math.PI ? 1 : 0
    const p = (a: number, rad: number) => `${r + rad * Math.cos(a)},${r + rad * Math.sin(a)}`
    // Tek dilim: tam halka (evenodd ile ortası boş iki daire)
    const d = items.length === 1
      ? `M${r},0 A${r},${r} 0 1 1 ${r},${2 * r} A${r},${r} 0 1 1 ${r},0 Z M${r},${r - inner} A${inner},${inner} 0 1 0 ${r},${r + inner} A${inner},${inner} 0 1 0 ${r},${r - inner} Z`
      : `M${p(a0, r)} A${r},${r} 0 ${large} 1 ${p(a1, r)} L${p(a1, inner)} A${inner},${inner} 0 ${large} 0 ${p(a0, inner)} Z`
    return { d, color: seriesColor(i, s.other), ...s }
  })

  const active = hover != null ? arcs[hover] : null

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img">
          {arcs.map((a, i) => (
            <path key={a.label} d={a.d} fill={a.color} fillRule="evenodd" stroke="var(--glass-solid)" strokeWidth={2}
              opacity={hover == null || hover === i ? 1 : 0.45} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[11px] text-[var(--text-muted)]">{active ? active.label : 'Toplam'}</p>
            <p className="text-[15px] font-semibold tabular-nums">{format(active ? active.value : total)}</p>
            {active && <p className="text-[11px] tabular-nums text-[var(--text-muted)]">%{((active.value / total) * 100).toFixed(1)}</p>}
          </div>
        </div>
        {active && hover != null && <Tooltip x={size} y={size / 2} width={size * 3}><b>{active.label}</b>: {format(active.value)}</Tooltip>}
      </div>
      <ul className="min-w-40 flex-1 space-y-1.5 text-[12px]">
        {arcs.map((a, i) => (
          <li key={a.label} className="flex items-center gap-2" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: a.color }} />
            <span className="min-w-0 flex-1 truncate">{a.label}</span>
            <span className="tabular-nums text-[var(--text-muted)]">%{total ? ((a.value / total) * 100).toFixed(0) : 0}</span>
            <span className="w-24 text-right tabular-nums">{format(a.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
