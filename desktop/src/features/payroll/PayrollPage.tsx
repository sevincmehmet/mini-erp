import { useState } from 'react'
import { DataTable, RowAction, type Column } from '../../components/data/DataTable'
import { Badge, Button, GlassCard, LoadState, PageHeader, Pager, StatTile } from '../../components/ui/Glass'
import { Icon } from '../../components/ui/Icons'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Field, FormError, FormGrid, Input, toNumber } from '../../components/ui/Form'
import { errorMessage, send } from '../../lib/apiClient'
import { money, MONTHS, number } from '../../lib/format'
import type { BulkResult, Payroll, PayrollStatus } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { toast } from '../../stores/useToastStore'
import { useNavStore } from '../../stores/useNavStore'

const STATUS: Record<PayrollStatus, { label: string; tone: 'good' | 'warning' | 'neutral' }> = {
  Paid: { label: 'Ödendi', tone: 'good' },
  Approved: { label: 'Ödeme bekliyor', tone: 'warning' },
  Draft: { label: 'Taslak', tone: 'neutral' },
}

const COLUMNS: Column<Payroll>[] = [
  {
    key: 'employee', header: 'Personel', value: (p) => p.employeeName,
    render: (p) => <><p className="font-medium">{p.employeeName}</p><p className="text-[11px] text-[var(--text-muted)]">{p.position}</p></>,
  },
  { key: 'days', header: 'Gün', align: 'right', type: 'number', defaultHidden: true, value: (p) => p.workedDays, render: (p) => (p.workedDays < 30 ? <span title="Kıst ay">{number(p.workedDays)}*</span> : number(p.workedDays)) },
  { key: 'regular', header: 'Normal Saat', align: 'right', type: 'number', total: true, value: (p) => p.regularHours, render: (p) => number(p.regularHours) },
  { key: 'otHours', header: 'FM Saat', align: 'right', type: 'number', total: true, value: (p) => p.overtimeHours, render: (p) => (p.overtimeHours ? number(p.overtimeHours) : '–') },
  { key: 'base', header: 'Temel', align: 'right', type: 'money', total: true, value: (p) => p.basePay, render: (p) => money(p.basePay) },
  { key: 'otPay', header: 'FM Ücreti', align: 'right', type: 'money', total: true, value: (p) => p.overtimePay, render: (p) => (p.overtimePay ? money(p.overtimePay) : '–') },
  { key: 'bonus', header: 'Prim', align: 'right', type: 'money', total: true, value: (p) => p.bonus, render: (p) => (p.bonus ? money(p.bonus) : '–') },
  { key: 'sgk', header: 'SGK İşçi', align: 'right', type: 'money', total: true, defaultHidden: true, value: (p) => p.sgkEmployee, render: (p) => money(p.sgkEmployee) },
  { key: 'unemp', header: 'İşsizlik İşçi', align: 'right', type: 'money', total: true, defaultHidden: true, value: (p) => p.unemploymentEmployee, render: (p) => money(p.unemploymentEmployee) },
  { key: 'gv', header: 'Gelir Vergisi', align: 'right', type: 'money', total: true, defaultHidden: true, value: (p) => p.incomeTax - p.incomeTaxExemption, render: (p) => <span title={`Hesaplanan ${money(p.incomeTax)} − istisna ${money(p.incomeTaxExemption)}`}>{money(p.incomeTax - p.incomeTaxExemption)}</span> },
  { key: 'stamp', header: 'Damga V.', align: 'right', type: 'money', total: true, defaultHidden: true, value: (p) => p.stampTax - p.stampTaxExemption, render: (p) => money(p.stampTax - p.stampTaxExemption) },
  { key: 'deductions', header: 'Kesinti', align: 'right', type: 'money', total: true, value: (p) => p.deductions, render: (p) => <span className="text-[var(--text-muted)]">−{money(p.deductions)}</span> },
  { key: 'gross', header: 'Brüt', align: 'right', type: 'money', total: true, value: (p) => p.grossPay, render: (p) => money(p.grossPay) },
  { key: 'net', header: 'Net', align: 'right', type: 'money', total: true, value: (p) => p.netPay, render: (p) => <span className="font-semibold">{money(p.netPay)}</span> },
  { key: 'cost', header: 'İşveren Maliyeti', align: 'right', type: 'money', total: true, defaultHidden: true, value: (p) => p.employerCost, render: (p) => money(p.employerCost) },
  { key: 'status', header: 'Durum', value: (p) => STATUS[p.status].label, render: (p) => <Badge dot tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge> },
]

/** Taslak → Onay → Ödeme akışını sayılarla gösterir. */
function StepTrail({ drafts, approved, paid }: { drafts: number; approved: number; paid: number }) {
  const steps = [
    { label: 'Taslak', n: drafts, tone: 'var(--text-muted)' },
    { label: 'Onaylı', n: approved, tone: 'var(--warning-text)' },
    { label: 'Ödendi', n: paid, tone: 'var(--good-text)' },
  ]
  return (
    <div className="hidden items-center gap-1.5 text-[12px] text-[var(--text-muted)] lg:flex">
      {steps.map((s, i) => (
        <span key={s.label} className="inline-flex items-center gap-1.5">
          {i > 0 && <Icon name="chevronRight" size={12} className="text-[var(--text-faint)]" />}
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--hover)] px-2 py-0.5">
            <span className="size-1.5 rounded-full" style={{ background: s.tone }} />{s.label} <b className="tabular-nums text-[var(--text)]">{s.n}</b>
          </span>
        </span>
      ))}
    </div>
  )
}

const MONEY_KEYS = new Set(['base', 'otPay', 'bonus', 'deductions', 'gross', 'net', 'sgk', 'unemp', 'gv', 'stamp', 'cost'])

export function PayrollPage() {
  const [period, setPeriod] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 1, 1) })
  const year = period.getFullYear()
  const month = period.getMonth() + 1
  const { data, loading, error, reload } = useApi<Payroll[]>(`/api/payrolls?year=${year}&month=${month}`)
  const settings = useApi<{ method: 'Statutory' | 'Approximate'; isDefault: boolean }>(`/api/payrolls/settings/${year}`)
  const statutory = settings.data?.method !== 'Approximate'
  const go = useNavStore((s) => s.go)

  /** Muhasebeci / bordro programı için tüm yasal alanlarla Excel. */
  const exportForAccountant = async () => {
    const bridge = window.api
    if (!bridge) return toast.error("Excel'e aktarım yalnızca masaüstü uygulamasında kullanılabilir.")
    const rowsOut = (data ?? []).map((p) => {
      const [first, ...rest] = p.employeeName.split(' ')
      return [p.nationalId, p.employeeNumber, first, rest.join(' '), p.position, p.workedDays, p.regularHours, p.overtimeHours, p.basePay, p.overtimePay, p.bonus, p.grossPay,
        p.sgkEmployee, p.unemploymentEmployee, p.incomeTax, p.incomeTaxExemption, p.stampTax, p.stampTaxExemption, p.netPay, p.employerSgk, p.employerUnemployment, p.employerCost]
    })
    const m = (h: string, total = true) => ({ header: h, type: 'money' as const, total })
    const res = await bridge.excel.exportTable({
      fileName: `Bordro ${MONTHS[month - 1]} ${year} muhasebe`, sheetName: `${MONTHS[month - 1]} ${year}`,
      columns: [{ header: 'TC Kimlik No' }, { header: 'Sicil No' }, { header: 'Ad' }, { header: 'Soyad' }, { header: 'Görev' }, { header: 'Gün', type: 'number' },
        { header: 'Normal Saat', type: 'number' }, { header: 'FM Saat', type: 'number' }, m('Temel Ücret'), m('FM Ücreti'), m('Prim'), m('Brüt'),
        m('SGK İşçi'), m('İşsizlik İşçi'), m('Gelir Vergisi'), m('GV İstisnası'), m('Damga Vergisi'), m('DV İstisnası'), m('Net Ödenen'),
        m('SGK İşveren'), m('İşsizlik İşveren'), m('Toplam Maliyet')],
      rows: rowsOut,
    })
    if (!res.ok) toast.error(res.error)
    else if (!res.canceled) toast.success(`Kaydedildi: ${res.filePath}`)
  }
  const [busy, setBusy] = useState(false)
  const [confirmPay, setConfirmPay] = useState(false)
  const [adjusting, setAdjusting] = useState<Payroll | null>(null)

  const rows = data ?? []
  const sum = (f: (p: Payroll) => number) => rows.reduce((s, p) => s + f(p), 0)
  const drafts = rows.filter((p) => p.status === 'Draft').length
  const approved = rows.filter((p) => p.status === 'Approved')

  const act = async (fn: () => Promise<BulkResult | void>, fallback?: string) => {
    setBusy(true)
    try {
      const res = await fn()
      toast.success(res?.message ?? fallback ?? 'İşlem tamamlandı.')
      reload()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const body = { year, month }

  return (
    <>
      <PageHeader
        title="Bordro ve Hakediş"
        subtitle="Taslak → Onay → Ödeme. Ödenen bordrolar otomatik olarak gider kaydına dönüşür."
        toolbar={<>
          <Pager label={`${MONTHS[month - 1]} ${year}`} onPrev={() => setPeriod(new Date(year, month - 2, 1))} onNext={() => setPeriod(new Date(year, month, 1))} />
          <StepTrail drafts={drafts} approved={approved.length} paid={rows.filter((p) => p.status === 'Paid').length} />
          <button onClick={() => go('settings')} className="inline-flex items-center gap-1 text-[12px] text-[var(--text-muted)] hover:text-[var(--text)]" title="Bordro parametreleri">
            <Badge tone={statutory ? 'info' : 'warning'}>{statutory ? 'Mevzuata göre' : 'Yaklaşık kesinti'}</Badge>{settings.data?.isDefault && <span>· varsayılan parametreler</span>}
          </button>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="ghost" icon="download" disabled={!rows.length} onClick={exportForAccountant}>Muhasebeciye Aktar</Button>
            <Button variant="secondary" icon="refresh" disabled={busy} onClick={() => act(() => send<BulkResult>('POST', '/api/payrolls/calculate', body))}>Puantajdan Hesapla</Button>
            <Button variant="secondary" icon="check" disabled={busy || drafts === 0} onClick={() => act(() => send<BulkResult>('POST', '/api/payrolls/approve-all', body))}>Tümünü Onayla{drafts ? ` (${drafts})` : ''}</Button>
            <Button icon="wallet" disabled={busy || approved.length === 0} onClick={() => setConfirmPay(true)}>Ödemeyi Kaydet{approved.length ? ` (${approved.length})` : ''}</Button>
          </div>
        </>}
      />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="payroll" tone="accent" label="Toplam Brüt" value={money(sum((p) => p.grossPay))} hint={`Kesinti ${money(sum((p) => p.deductions))}`} />
        <StatTile icon="wallet" tone="good" label="Toplam Net" value={money(sum((p) => p.netPay))} hint={rows.length ? `Kişi başı ort. ${money(sum((p) => p.netPay) / rows.length)}` : undefined} />
        <StatTile icon="bolt" tone="info" label="Fazla Mesai Ücreti" value={money(sum((p) => p.overtimePay))} hint={`${number(sum((p) => p.overtimeHours))} saat`} />
        <StatTile icon="employees" tone="neutral" label="Personel" value={String(rows.length)} hint={drafts ? `${drafts} taslak bekliyor` : rows.length ? 'Taslak yok' : undefined} />
      </div>

      <GlassCard className="p-2">
        {!data ? <LoadState loading={loading} error={error} /> : (
          <DataTable
            tableId="payroll"
            exportName={`Bordro ${MONTHS[month - 1]} ${year}`}
            columns={COLUMNS}
            rows={rows}
            rowKey={(p) => p.id}
            formatTotal={(key, total) => (MONEY_KEYS.has(key) ? money(total) : number(total))}
            onRowDoubleClick={(p) => p.status === 'Draft' && setAdjusting(p)}
            actions={(p) => p.status === 'Draft' ? <>
              <RowAction label="Prim / kesinti düzenle" onClick={() => setAdjusting(p)} icon="edit" />
              <RowAction label="Onayla" onClick={() => act(() => send<BulkResult>('POST', `/api/payrolls/${p.id}/approve`))} icon="check" />
              <RowAction label="Sil" danger onClick={() => act(() => send('DELETE', `/api/payrolls/${p.id}`), 'Taslak bordro silindi.')} icon="trash" />
            </> : p.status === 'Approved' ? <>
              <RowAction label="Taslağa al" onClick={() => act(() => send<BulkResult>('POST', `/api/payrolls/${p.id}/revert`))} icon="undo" />
              <RowAction label="Ödendi olarak kaydet" onClick={() => act(() => send<BulkResult>('POST', `/api/payrolls/${p.id}/pay`))} icon="wallet" />
            </> : null}
            empty={
              <div className="py-12 text-center">
                <p className="text-[15px] font-medium">{MONTHS[month - 1]} {year} için bordro yok</p>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">Puantaj kayıtlarından otomatik hesaplamak için:</p>
                <Button className="mt-4" icon="refresh" disabled={busy} onClick={() => act(() => send<BulkResult>('POST', '/api/payrolls/calculate', body))}>Puantajdan Hesapla</Button>
              </div>
            }
          />
        )}
      </GlassCard>
      <p className="mt-3 text-xs text-[var(--text-muted)]">
        {statutory
          ? <>Kesintiler mevzuata göre hesaplanır: SGK ve işsizlik işçi payı, kümülatif gelir vergisi, asgari ücret istisnası ve damga vergisi. * işaretli günler kıst aydır. Parametreleri Ayarlar → Bordro Parametreleri'nden değiştirebilirsiniz; resmî bordrodan önce mali müşavirinize doğrulatın. Sütunlar menüsünden SGK, vergi ve işveren maliyeti sütunlarını açabilirsiniz.</>
          : <>Kesintiler brütün sabit bir oranı olarak yaklaşık hesaplanıyor. Mevzuat hesabına Ayarlar → Bordro Parametreleri'nden geçebilirsiniz.</>}
      </p>

      <ConfirmDialog open={confirmPay} busy={busy} danger={false} confirmLabel="Ödemeyi Kaydet" title="Maaş ödemesi"
        message={<>{approved.length} onaylı bordro <b>ödendi</b> olarak işaretlenecek ve toplam {money(approved.reduce((s, p) => s + p.netPay, 0))} gider kaydı oluşturulacak. Ödenen bordro geri alınamaz.</>}
        onConfirm={() => { setConfirmPay(false); void act(() => send<BulkResult>('POST', '/api/payrolls/pay-all', body)) }} onClose={() => setConfirmPay(false)} />
      <AdjustForm payroll={adjusting} statutory={statutory} onClose={() => setAdjusting(null)} onSaved={reload} />
    </>
  )
}

function AdjustForm({ payroll, statutory, onClose, onSaved }: { payroll: Payroll | null; statutory: boolean; onClose: () => void; onSaved: () => void }) {
  const [bonus, setBonus] = useState('')
  const [deductions, setDeductions] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [lastId, setLastId] = useState<string | null>(null)
  if (payroll && payroll.id !== lastId) {
    setLastId(payroll.id)
    setBonus(String(payroll.bonus).replace('.', ','))
    setDeductions(String(payroll.deductions).replace('.', ','))
    setError(null)
  }
  const gross = payroll ? payroll.basePay + payroll.overtimePay + (toNumber(bonus) || 0) : 0
  const save = async () => {
    if (!payroll) return
    try {
      await send('PUT', `/api/payrolls/${payroll.id}`, { bonus: toNumber(bonus), deductions: toNumber(deductions) })
      toast.success('Bordro güncellendi.')
      onSaved()
      onClose()
      setLastId(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  return (
    <Modal open={!!payroll} onClose={() => { onClose(); setLastId(null) }} title={`Bordro · ${payroll?.employeeName ?? ''}`} width="sm"
      footer={<><Button variant="secondary" onClick={() => { onClose(); setLastId(null) }}>Vazgeç</Button><Button onClick={save}>Kaydet</Button></>}>
      <FormGrid>
        <Field label="Prim (₺)"><Input inputMode="decimal" value={bonus} onChange={(e) => setBonus(e.target.value)} /></Field>
        <Field label="Kesinti (₺)" hint={statutory ? 'Mevzuat hesabında otomatik' : undefined}><Input inputMode="decimal" disabled={statutory} value={deductions} onChange={(e) => setDeductions(e.target.value)} /></Field>
      </FormGrid>
      {statutory && <p className="mt-2 text-[11.5px] text-[var(--text-muted)]">Prim değişince SGK, vergi ve net ücret mevzuata göre yeniden hesaplanır.</p>}
      <div className="mt-4 space-y-1 rounded-xl bg-[var(--hover)] p-3 text-[13px] tabular-nums">
        <div className="flex justify-between"><span className="text-[var(--text-muted)]">Temel + fazla mesai</span><span>{money((payroll?.basePay ?? 0) + (payroll?.overtimePay ?? 0))}</span></div>
        <div className="flex justify-between"><span className="text-[var(--text-muted)]">Brüt</span><span>{money(gross)}</span></div>
        <div className="flex justify-between font-semibold"><span>Net</span><span>{statutory ? 'kaydedince hesaplanır' : money(gross - (toNumber(deductions) || 0))}</span></div>
      </div>
      <FormError message={error} />
    </Modal>
  )
}
