import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Kategorik renkler sabit sırayla atanır (döngüye girmez); "Diğer" her zaman gridir. */
export const seriesColor = (i: number, other?: boolean) => (other ? 'var(--series-other)' : `var(--series-${(i % 8) + 1})`)

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

export function niceTicks(max: number, count = 4) {
  if (max <= 0) return { top: 1, ticks: [0, 1] }
  const raw = max / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const n = raw / pow
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow
  const top = Math.ceil(max / step) * step
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) }
}

/** Negatif değer içerebilen aralık için yuvarlak adımlı eksen: sıfır her zaman bir çizgiye denk gelir. */
export function niceRange(min: number, max: number, count = 4) {
  const lo0 = Math.min(0, min), hi0 = Math.max(0, max)
  if (hi0 - lo0 <= 0) return { lo: 0, hi: 1, ticks: [0, 1] }
  const raw = (hi0 - lo0) / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const n = raw / pow
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow
  const lo = Math.floor(lo0 / step) * step, hi = Math.ceil(hi0 / step) * step
  return { lo, hi, ticks: Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step) }
}

/** Yalnızca uç kısmı yuvarlatılmış, tabana oturan sütun (dikey ya da yatay). */
export function barPath(x: number, y: number, w: number, h: number, r: number, horizontal = false) {
  if (w <= 0 || h <= 0) return ''
  if (horizontal) {
    const rr = Math.min(r, h / 2, w)
    return `M${x},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} H${x} Z`
  }
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`
}

export const truncate = (s: string, maxChars: number) => (s.length > maxChars ? `${s.slice(0, Math.max(1, maxChars - 1))}…` : s)

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  if (items.length < 2) return null
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--text-muted)]">
      {items.map((it) => (
        <span key={it.name} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: it.color }} />
          {it.name}
        </span>
      ))}
    </div>
  )
}

export function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const flip = x > width * 0.6
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-40 max-w-64 rounded-xl border border-[var(--glass-border)] bg-[var(--tooltip-bg)] px-3 py-2 text-xs shadow-lg backdrop-blur-xl"
      style={{ left: x, top: y, transform: `translate(${flip ? 'calc(-100% - 12px)' : '12px'}, -50%)` }}
    >
      {children}
    </div>
  )
}

export function TooltipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="inline-flex min-w-0 items-center gap-1.5 text-[var(--text-muted)]">
        <span className="size-2 shrink-0 rounded-[2px]" style={{ background: color }} />
        <span className="truncate">{label}</span>
      </span>
      <span className="tabular-nums text-[var(--text)]">{value}</span>
    </div>
  )
}
