import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Button, GlassCard, LoadState, PageHeader, StatTile, cx } from '../../components/ui/Glass'
import { Icon } from '../../components/ui/Icons'
import { useGridSpan } from '../../components/ui/useGridSpan'
import { compactMoney, money, MONTHS, number, shortDate } from '../../lib/format'
import type { Dashboard } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { useNavStore } from '../../stores/useNavStore'
import { useActiveCompany } from '../../stores/useCompanyStore'
import { useViewStore, type DashboardWidgetView } from '../../stores/useViewStore'
import { BarChart } from '../../components/charts/BarChart'
import { exportPdf } from '../../lib/pdf'
import { formatValue } from '../builder/engine'

interface WidgetDef {
  id: string
  title: string
  defaultSize: number
  render: (d: Dashboard, go: (p: Parameters<ReturnType<typeof useNavStore.getState>['go']>[0]) => void) => ReactNode
}

const lastFull = (d: Dashboard) => d.months[d.months.length - 2]
const monthName = (m: { month: number }) => MONTHS[m.month - 1]

const WIDGETS: WidgetDef[] = [
  {
    id: 'income', title: 'Bu Ay Gelir', defaultSize: 3,
    render: (d) => <StatTile label="Bu Ay Gelir" icon="arrowDownCircle" tone="income" value={money(d.monthIncome)}
      trend={d.months.slice(0, -1).map((m) => m.income)} hint={lastFull(d) && `${monthName(lastFull(d))}: ${compactMoney(lastFull(d).income)}`} />,
  },
  {
    id: 'expense', title: 'Bu Ay Gider', defaultSize: 3,
    render: (d) => <StatTile label="Bu Ay Gider" icon="arrowUpCircle" tone="expense" value={money(d.monthExpense)}
      trend={d.months.slice(0, -1).map((m) => m.expense)} hint={lastFull(d) && `${monthName(lastFull(d))}: ${compactMoney(lastFull(d).expense)}`} />,
  },
  {
    id: 'net', title: 'Bu Ay Net', defaultSize: 3,
    render: (d) => {
      const net = d.monthIncome - d.monthExpense
      return <StatTile label="Bu Ay Net" icon="scale" tone={net >= 0 ? 'good' : 'warning'} value={money(net)}
        trend={d.months.slice(0, -1).map((m) => m.income - m.expense)} hint={lastFull(d) && `${monthName(lastFull(d))}: ${compactMoney(lastFull(d).income - lastFull(d).expense)}`} />
    },
  },
  { id: 'employees', title: 'Aktif Personel', defaultSize: 3, render: (d, go) => <StatTile label="Aktif Personel" icon="employees" tone="accent" value={String(d.activeEmployees)} hint={`Bugün ${d.todayShiftCount} vardiya planlı`} onClick={() => go('shifts')} /> },
  {
    id: 'chart', title: 'Son 6 Ay Gelir ve Gider', defaultSize: 8,
    render: (d) => (
      <GlassCard className="h-full p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">Son 6 Ay Gelir ve Gider</h2>
          <span className="text-[12px] text-[var(--text-muted)]">Net: {compactMoney(d.months.reduce((s, m) => s + m.income - m.expense, 0))}</span>
        </div>
        <div className="mt-3">
          <BarChart height={250} format={(v, c) => formatValue(v, 'money', c)}
            categories={d.months.map((m) => ({ key: `${m.year}-${m.month}`, label: `${MONTHS[m.month - 1].slice(0, 3)}` }))}
            series={[{ name: 'Gelir', values: d.months.map((m) => m.income) }, { name: 'Gider', values: d.months.map((m) => m.expense) }]}
            partialLast />
        </div>
      </GlassCard>
    ),
  },
  {
    id: 'topExpenses', title: 'En Büyük Giderler', defaultSize: 4,
    render: (d) => {
      const max = Math.max(1, ...d.topExpenses.map((c) => c.total))
      return (
        <GlassCard className="h-full p-5">
          <h2 className="text-[15px] font-semibold">En Büyük Giderler</h2>
          <p className="text-[12px] text-[var(--text-muted)]">Son 3 ay · kategori bazında</p>
          <ul className="mt-4 space-y-3">
            {d.topExpenses.map((c) => (
              <li key={c.category}>
                <div className="flex justify-between gap-2 text-[12.5px]">
                  <span className="truncate">{c.category}</span>
                  <span className="font-medium tabular-nums">{money(c.total)}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-[var(--hover-strong)]">
                  <div className="h-full rounded-full bg-[var(--series-expense)]" style={{ width: `${(c.total / max) * 100}%` }} />
                </div>
              </li>
            ))}
            {d.topExpenses.length === 0 && <li className="text-[12px] text-[var(--text-muted)]">Gider kaydı yok.</li>}
          </ul>
        </GlassCard>
      )
    },
  },
  { id: 'overtime', title: 'Bu Ay Fazla Mesai', defaultSize: 6, render: (d, go) => <StatTile label="Bu Ay Fazla Mesai" icon="timesheet" tone="info" value={`${number(d.monthOvertimeHours)} saat`} hint="Ayrıntılar Puantaj ekranında" onClick={() => go('timesheet')} /> },
  { id: 'pending', title: 'Onay Bekleyen Bordro', defaultSize: 6, render: (d, go) => <StatTile label="Onaylı, ödenmemiş bordro" icon="payroll" tone={d.pendingPayrollTotal > 0 ? 'warning' : 'good'} value={money(d.pendingPayrollTotal)} hint={d.pendingPayrollTotal > 0 ? 'Ödeme kaydı bekliyor' : 'Bekleyen ödeme yok'} onClick={() => go('payroll')} /> },
  {
    id: 'recent', title: 'Son Hareketler', defaultSize: 12,
    render: (d, go) => (
      <GlassCard className="h-full p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">Son Hareketler</h2>
          <button onClick={() => go('finance')} className="inline-flex items-center gap-0.5 text-[13px] font-medium text-[var(--accent-text)] hover:underline">Tümünü gör <Icon name="chevronRight" size={14} /></button>
        </div>
        <ul className="mt-2 divide-y divide-[var(--row-border)]">
          {d.recent.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2.5 text-[13px]">
              <span className="grid size-8 shrink-0 place-items-center rounded-[10px]" aria-label={t.type === 'Income' ? 'Gelir' : 'Gider'}
                style={{ background: `color-mix(in srgb, ${t.type === 'Income' ? 'var(--series-income)' : 'var(--series-expense)'} 14%, transparent)`, color: t.type === 'Income' ? 'var(--series-income)' : 'var(--series-expense)' }}>
                <Icon name={t.type === 'Income' ? 'arrowDownCircle' : 'arrowUpCircle'} size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate">{t.description}</p>
                <p className="text-[11px] text-[var(--text-muted)]">{t.category} · {shortDate(t.date)}</p>
              </div>
              <span className="font-medium tabular-nums">{t.type === 'Income' ? '+' : '−'}{money(t.amount)}</span>
            </li>
          ))}
        </ul>
      </GlassCard>
    ),
  },
]

const SIZES = [
  { value: 3, label: '¼' },
  { value: 4, label: '⅓' },
  { value: 6, label: '½' },
  { value: 8, label: '⅔' },
  { value: 12, label: 'Tam' },
]

function greeting() {
  const h = new Date().getHours()
  return h < 6 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar'
}

const defaults = (): DashboardWidgetView[] => WIDGETS.map((w) => ({ id: w.id, size: w.defaultSize }))

export function DashboardPage() {
  const company = useActiveCompany()
  const go = useNavStore((s) => s.go)
  const { data, loading, error } = useApi<Dashboard>('/api/dashboard')
  const saved = useViewStore((s) => s.dashboard)
  const setDashboard = useViewStore((s) => s.setDashboard)
  const [editing, setEditing] = useState(false)
  const grid = useGridSpan<HTMLDivElement>()
  const dragId = useRef<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  // Kayıtlı düzen + sonradan eklenen yeni kartlar
  const layout = useMemo(() => {
    const known = (saved ?? []).filter((w) => WIDGETS.some((d) => d.id === w.id))
    return [...known, ...defaults().filter((d) => !known.some((w) => w.id === d.id))]
  }, [saved])

  const update = (next: DashboardWidgetView[]) => setDashboard(next)
  const patch = (id: string, p: Partial<DashboardWidgetView>) => update(layout.map((w) => (w.id === id ? { ...w, ...p } : w)))
  const move = (from: string, to: string) => {
    if (from === to) return
    const list = layout.filter((w) => w.id !== from)
    list.splice(list.findIndex((w) => w.id === to), 0, layout.find((w) => w.id === from)!)
    update(list)
  }

  const hidden = layout.filter((w) => w.hidden)

  return (
    <>
      <PageHeader
        title={greeting()}
        subtitle={`${company?.name ?? ''} · ${new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
        actions={editing ? <>
          <Button variant="ghost" onClick={() => setDashboard(null)}>Varsayılana dön</Button>
          <Button icon="check" onClick={() => setEditing(false)}>Bitti</Button>
        </> : <>
          <Button variant="ghost" icon="printer" onClick={() => exportPdf(`Genel Bakış ${company?.name ?? ''}`)}>PDF</Button>
          <Button variant="secondary" icon="layout" onClick={() => setEditing(true)}>Düzeni Özelleştir</Button>
        </>}
      />

      {editing && (
        <div className="mb-3 rounded-xl border border-dashed border-[var(--accent)]/50 bg-[var(--today-bg)] px-4 py-2.5 text-[12px]">
          <span className="text-[var(--text-muted)]">Kartları sürükleyerek yer değiştirin, üstteki düğmelerle genişliğini seçin ya da gizleyin.</span>
          {hidden.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[var(--text-muted)]">Gizli kartlar:</span>
              {hidden.map((w) => (
                <button key={w.id} onClick={() => patch(w.id, { hidden: false })} className="rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2.5 py-0.5 hover:bg-[var(--hover)]">
                  <Icon name="plus" size={11} className="-mt-px mr-0.5 inline" strokeWidth={2.2} />{WIDGETS.find((d) => d.id === w.id)?.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!data ? <DashboardSkeleton error={error} loading={loading} /> : (
        <div ref={grid.ref} className="grid grid-cols-12 gap-3">
          {layout.filter((w) => !w.hidden).map((w) => {
            const def = WIDGETS.find((d) => d.id === w.id)!
            return (
              <div
                key={w.id}
                style={{ gridColumn: `span ${grid.span(w.size)} / span ${grid.span(w.size)}` }}
                className={cx('relative', editing && 'cursor-grab rounded-2xl ring-1 ring-[var(--accent)]/30', over === w.id && 'ring-2 ring-[var(--accent)]')}
                draggable={editing}
                onDragStart={(e) => { dragId.current = w.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/x-widget', w.id) }}
                onDragOver={(e) => { if (dragId.current) { e.preventDefault(); setOver(w.id) } }}
                onDragLeave={() => setOver((o) => (o === w.id ? null : o))}
                onDrop={(e) => { e.preventDefault(); if (dragId.current) move(dragId.current, w.id); dragId.current = null; setOver(null) }}
                onDragEnd={() => { dragId.current = null; setOver(null) }}
              >
                {editing && (
                  <div className="absolute -top-2.5 right-3 z-10 flex items-center gap-0.5 rounded-full border border-[var(--glass-border)] bg-[var(--modal-bg)] px-1 py-0.5 text-[11px] shadow-md">
                    <span className="px-1 text-[var(--text-muted)]" aria-hidden><Icon name="grip" size={13} /></span>
                    {SIZES.map((s) => (
                      <button key={s.value} onClick={() => patch(w.id, { size: s.value })} title={`Genişlik: ${s.label}`}
                        className={cx('rounded-full px-1.5 py-0.5', w.size === s.value ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--hover)]')}>
                        {s.label}
                      </button>
                    ))}
                    <button onClick={() => patch(w.id, { hidden: true })} title="Gizle" className="grid size-5 place-items-center rounded-full text-[var(--danger)] hover:bg-[var(--critical-bg)]"><Icon name="x" size={12} strokeWidth={2.2} /></button>
                  </div>
                )}
                <div className={cx('h-full', editing && 'pointer-events-none select-none')}>{def.render(data, go)}</div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function DashboardSkeleton({ loading, error }: { loading: boolean; error?: string }) {
  if (error) return <LoadState error={error} />
  if (!loading) return null
  return (
    <div className="grid grid-cols-12 gap-3" aria-busy="true">
      {[3, 3, 3, 3].map((n, i) => <GlassCard key={i} className="col-span-3 h-[118px] p-4"><div className="skeleton h-3 w-24" /><div className="skeleton mt-5 h-6 w-32" /></GlassCard>)}
      <GlassCard className="col-span-8 h-[360px] p-5"><div className="skeleton h-4 w-48" /><div className="skeleton mt-6 h-[270px]" /></GlassCard>
      <GlassCard className="col-span-4 h-[360px] p-5"><div className="skeleton h-4 w-36" />{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton mt-6 h-3" />)}</GlassCard>
    </div>
  )
}
