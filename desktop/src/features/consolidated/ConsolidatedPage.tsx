import { BarChart } from '../../components/charts/BarChart'
import { LineChart } from '../../components/charts/LineChart'
import { DataTable, type Column } from '../../components/data/DataTable'
import { Button, GlassCard, LoadState, PageHeader, SectionTitle, Sparkline, StatTile, cx } from '../../components/ui/Glass'
import { exportPdf } from '../../lib/pdf'
import { Icon } from '../../components/ui/Icons'
import { useGridSpan } from '../../components/ui/useGridSpan'
import { compactMoney, money, MONTHS_SHORT } from '../../lib/format'
import { useApi } from '../../lib/useApi'
import { useCompanyStore } from '../../stores/useCompanyStore'
import { useNavStore } from '../../stores/useNavStore'
import { CompanyMark } from '../../app/Sidebar'
import { formatValue } from '../builder/engine'

interface Summary {
  companyId: string
  name: string
  accentColor: string | null
  monthIncome: number
  monthExpense: number
  lastMonthIncome: number
  lastMonthExpense: number
  yearIncome: number
  yearExpense: number
  activeEmployees: number
  pendingPayroll: number
  receivableOpen: number
  receivableOverdue: number
  payableOpen: number
  months: { year: number; month: number; income: number; expense: number }[]
}

const fmt = (v: number, c?: boolean) => formatValue(v, 'money', c)

export function ConsolidatedPage() {
  const { data, loading, error } = useApi<Summary[]>('/api/consolidated')
  const switchCompany = useCompanyStore((s) => s.switchCompany)
  const go = useNavStore((s) => s.go)
  const grid = useGridSpan<HTMLDivElement>()
  const open = (id: string) => { switchCompany(id); go('dashboard') }

  if (!data) return <><PageHeader title="Tüm Şirketler" /><LoadState loading={loading} error={error} /></>

  const sum = (f: (s: Summary) => number) => data.reduce((a, s) => a + f(s), 0)
  const yearNet = sum((s) => s.yearIncome - s.yearExpense)
  const lastNet = sum((s) => s.lastMonthIncome - s.lastMonthExpense)
  const months = data[0]?.months ?? []
  const year = new Date().getFullYear()

  const columns: Column<Summary>[] = [
    { key: 'name', header: 'Şirket', value: (s) => s.name, render: (s) => <span className="inline-flex items-center gap-2 font-medium"><CompanyMark name={s.name} color={s.accentColor} size={22} />{s.name}</span> },
    { key: 'mi', header: 'Bu ay gelir', align: 'right', type: 'money', total: true, value: (s) => s.monthIncome, render: (s) => money(s.monthIncome) },
    { key: 'me', header: 'Bu ay gider', align: 'right', type: 'money', total: true, value: (s) => s.monthExpense, render: (s) => money(s.monthExpense) },
    { key: 'ln', header: 'Geçen ay net', align: 'right', type: 'money', total: true, value: (s) => s.lastMonthIncome - s.lastMonthExpense, render: (s) => <NetValue v={s.lastMonthIncome - s.lastMonthExpense} /> },
    { key: 'yn', header: `${year} net`, align: 'right', type: 'money', total: true, value: (s) => s.yearIncome - s.yearExpense, render: (s) => <b><NetValue v={s.yearIncome - s.yearExpense} /></b> },
    { key: 'emp', header: 'Personel', align: 'right', type: 'number', total: true, value: (s) => s.activeEmployees, render: (s) => s.activeEmployees },
    { key: 'ro', header: 'Açık alacak', align: 'right', type: 'money', total: true, value: (s) => s.receivableOpen, render: (s) => money(s.receivableOpen) },
    { key: 'rov', header: 'Gecikmiş', align: 'right', type: 'money', total: true, value: (s) => s.receivableOverdue, render: (s) => s.receivableOverdue ? <span className="text-[var(--critical-text)]">{money(s.receivableOverdue)}</span> : '—' },
    { key: 'po', header: 'Açık borç', align: 'right', type: 'money', total: true, value: (s) => s.payableOpen, render: (s) => money(s.payableOpen) },
    { key: 'pp', header: 'Ödenmemiş bordro', align: 'right', type: 'money', total: true, value: (s) => s.pendingPayroll, render: (s) => s.pendingPayroll ? money(s.pendingPayroll) : '—' },
  ]

  return (
    <>
      <PageHeader title="Tüm Şirketler" subtitle={`${data.length} şirketin konsolide görünümü · rakamlar şirketlerin toplamıdır`}
        icon={<Icon name="buildings" size={17} />}
        actions={<Button variant="ghost" icon="printer" onClick={() => exportPdf('Konsolide Rapor', true)}>PDF</Button>} />

      <div ref={grid.ref} className="grid grid-cols-12 gap-3">
        {[
          <StatTile key="i" icon="arrowDownCircle" tone="income" label="Bu Ay Gelir (toplam)" value={money(sum((s) => s.monthIncome))} hint={`Geçen ay: ${compactMoney(sum((s) => s.lastMonthIncome))}`} />,
          <StatTile key="e" icon="arrowUpCircle" tone="expense" label="Bu Ay Gider (toplam)" value={money(sum((s) => s.monthExpense))} hint={`Geçen ay: ${compactMoney(sum((s) => s.lastMonthExpense))}`} />,
          <StatTile key="n" icon="scale" tone={yearNet >= 0 ? 'good' : 'warning'} label={`${year} Net Kâr (toplam)`} value={money(yearNet)} hint={`Geçen ay net: ${compactMoney(lastNet)}`} />,
          <StatTile key="r" icon="handshake" tone={sum((s) => s.receivableOverdue) > 0 ? 'warning' : 'info'} label="Açık Alacak" value={money(sum((s) => s.receivableOpen))}
            hint={sum((s) => s.receivableOverdue) > 0 ? `${compactMoney(sum((s) => s.receivableOverdue))} vadesi geçmiş` : 'Gecikme yok'} />,
        ].map((t, i) => <div key={i} style={{ gridColumn: `span ${grid.span(3)} / span ${grid.span(3)}` }}>{t}</div>)}
      </div>

      <SectionTitle>Şirketler</SectionTitle>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.map((s) => {
          const net = s.yearIncome - s.yearExpense
          return (
            <button key={s.companyId} onClick={() => open(s.companyId)} className="text-left">
              <GlassCard className="p-4 transition hover:-translate-y-px hover:shadow-[var(--shadow-pop)]">
                <div className="flex items-center gap-2.5">
                  <CompanyMark name={s.name} color={s.accentColor} size={30} />
                  <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold">{s.name}</p><p className="text-[11.5px] text-[var(--text-muted)]">{s.activeEmployees} personel</p></div>
                  <Icon name="chevronRight" size={15} className="text-[var(--text-faint)]" />
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-[11.5px] text-[var(--text-muted)]">{year} net</p>
                    <p className={cx('text-[22px] font-semibold tabular-nums tracking-[-0.02em]', net < 0 && 'text-[var(--critical-text)]')}>{money(net)}</p>
                  </div>
                  <Sparkline values={s.months.slice(0, -1).map((m) => m.income - m.expense)} color={s.accentColor ?? 'var(--accent)'} width={110} height={34} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--row-border)] pt-3 text-[11.5px]">
                  <div><p className="text-[var(--text-muted)]">Açık alacak</p><p className="font-medium tabular-nums">{compactMoney(s.receivableOpen)}</p></div>
                  <div><p className="text-[var(--text-muted)]">Açık borç</p><p className="font-medium tabular-nums">{compactMoney(s.payableOpen)}</p></div>
                  <div><p className="text-[var(--text-muted)]">Bekleyen bordro</p><p className="font-medium tabular-nums">{compactMoney(s.pendingPayroll)}</p></div>
                </div>
              </GlassCard>
            </button>
          )
        })}
      </div>

      <div className="mt-3 grid grid-cols-12 gap-3">
        <GlassCard className="p-5" style={{ gridColumn: `span ${grid.span(7)} / span ${grid.span(7)}` }}>
          <h2 className="text-[15px] font-semibold">Aylık Net · Şirket Karşılaştırması</h2>
          <p className="mb-3 text-[12px] text-[var(--text-muted)]">Gelir − gider, son 12 ay</p>
          <LineChart format={fmt} partialLast
            categories={months.map((m) => ({ key: `${m.year}-${m.month}`, label: `${MONTHS_SHORT[m.month - 1]} ${String(m.year).slice(2)}` }))}
            series={data.map((s) => ({ name: s.name, values: s.months.map((m) => m.income - m.expense) }))} />
        </GlassCard>
        <GlassCard className="p-5" style={{ gridColumn: `span ${grid.span(5)} / span ${grid.span(5)}` }}>
          <h2 className="text-[15px] font-semibold">{year} Gelir ve Gider</h2>
          <p className="mb-3 text-[12px] text-[var(--text-muted)]">Şirket bazında yıl toplamı</p>
          <BarChart format={fmt} categories={data.map((s) => ({ key: s.companyId, label: s.name }))}
            series={[{ name: 'Gelir', values: data.map((s) => s.yearIncome) }, { name: 'Gider', values: data.map((s) => s.yearExpense) }]} />
        </GlassCard>
      </div>

      <GlassCard className="mt-3 p-2">
        <DataTable tableId="consolidated" exportName="Konsolide Özet" columns={columns} rows={data} rowKey={(s) => s.companyId}
          onRowDoubleClick={(s) => open(s.companyId)} formatTotal={(k, t) => (k === 'emp' ? t : money(t))} />
      </GlassCard>
    </>
  )
}

function NetValue({ v }: { v: number }) {
  return <span className={v < 0 ? 'text-[var(--critical-text)]' : undefined}>{money(v)}</span>
}
