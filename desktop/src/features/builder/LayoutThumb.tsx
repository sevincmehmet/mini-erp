import type { Widget } from './types'

/** Sayfa yerleşiminin küçük şeması: bileşenlerin türü ve genişliği bir bakışta görünsün. */
export function LayoutThumb({ widgets }: { widgets: Widget[] }) {
  return (
    <div className="grid grid-cols-12 gap-[3px]" aria-hidden>
      {widgets.slice(0, 10).map((w, i) => (
        <div key={w.id} style={{ gridColumn: `span ${w.size} / span ${w.size}` }}
          className="overflow-hidden rounded-[4px] border border-[var(--glass-border)] bg-[var(--bg-elev)] p-[4px]">
          <Glyph type={w.type} i={i} />
        </div>
      ))}
    </div>
  )
}

function Glyph({ type, i }: { type: Widget['type']; i: number }) {
  const c1 = 'var(--series-1)'
  const c2 = 'var(--series-2)'
  if (type === 'stat') return <div className="h-[18px]"><div className="h-[3px] w-1/2 rounded bg-[var(--hover-strong)]" /><div className="mt-[4px] h-[6px] w-3/4 rounded bg-[var(--text-faint)] opacity-60" /></div>
  if (type === 'line') return <svg viewBox="0 0 100 30" className="h-[38px] w-full"><path d="M0,24 L15,18 L30,20 L45,11 L60,14 L75,7 L100,9" fill="none" stroke={c1} strokeWidth={2.5} /><path d="M0,27 L20,24 L40,25 L60,20 L80,21 L100,17" fill="none" stroke={c2} strokeWidth={2.5} opacity={0.8} /></svg>
  if (type === 'bar' || type === 'hbar') {
    const vals = [0.6, 0.85, 0.5, 0.95, 0.7, 0.4].map((v, j) => ((v + i * 0.07 + j * 0.03) % 1) * 0.7 + 0.3)
    return type === 'bar'
      ? <div className="flex h-[38px] items-end gap-[3px]">{vals.map((v, j) => <div key={j} className="flex-1 rounded-t-[2px]" style={{ height: `${v * 100}%`, background: j % 2 ? c2 : c1 }} />)}</div>
      : <div className="flex h-[38px] flex-col justify-center gap-[3px]">{vals.slice(0, 4).map((v, j) => <div key={j} className="h-[5px] rounded-r-[2px]" style={{ width: `${v * 100}%`, background: c1 }} />)}</div>
  }
  if (type === 'donut') return <svg viewBox="0 0 36 36" className="mx-auto h-[38px]"><circle cx="18" cy="18" r="12" fill="none" stroke={c1} strokeWidth="6" strokeDasharray="40 76" /><circle cx="18" cy="18" r="12" fill="none" stroke={c2} strokeWidth="6" strokeDasharray="22 76" strokeDashoffset="-40" /><circle cx="18" cy="18" r="12" fill="none" stroke="var(--series-3)" strokeWidth="6" strokeDasharray="14 76" strokeDashoffset="-62" /></svg>
  if (type === 'table' || type === 'list') return <div className="h-[30px] space-y-[4px] pt-[2px]">{[0, 1, 2, 3].map((j) => <div key={j} className="h-[3px] rounded bg-[var(--hover-strong)]" style={{ width: `${90 - j * 8}%` }} />)}</div>
  return <div className="h-[18px] space-y-[4px]"><div className="h-[4px] w-2/3 rounded bg-[var(--hover-strong)]" /><div className="h-[3px] w-1/2 rounded bg-[var(--hover)]" /></div>
}
