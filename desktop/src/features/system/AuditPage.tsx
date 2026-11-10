import { useMemo, useState } from 'react'
import { DataTable, type Column } from '../../components/data/DataTable'
import { Avatar, Badge, GlassCard, LoadState, PageHeader, Pager, SearchField, Segmented } from '../../components/ui/Glass'
import { isoDate, MONTHS } from '../../lib/format'
import { useApi } from '../../lib/useApi'

type Action = 'Added' | 'Modified' | 'Deleted' | 'Restored'
interface Audit { id: number; at: string; userName: string | null; entityType: string; entityId: string; entityLabel: string | null; action: Action; changesJson: string | null }

const ACTION: Record<Action, { label: string; tone: 'good' | 'info' | 'critical' | 'warning' }> = {
  Added: { label: 'Eklendi', tone: 'good' }, Modified: { label: 'Değiştirildi', tone: 'info' }, Deleted: { label: 'Silindi', tone: 'critical' }, Restored: { label: 'Geri getirildi', tone: 'warning' },
}
const ENTITY: Record<string, string> = {
  Employee: 'Personel', IncomeExpense: 'Gelir-gider', TimeEntry: 'Mesai', ShiftAssignment: 'Vardiya', ShiftTemplate: 'Vardiya tanımı', Payroll: 'Bordro',
  FinanceCategory: 'Kategori', Party: 'Cari', CariDocument: 'Cari belge', CariPayment: 'Tahsilat/ödeme', LeaveRequest: 'İzin', CustomPage: 'Sayfa',
  Dataset: 'Veri kümesi', Attachment: 'Ek', Company: 'Şirket', PayrollSettings: 'Bordro parametresi',
}
const FIELD: Record<string, string> = {
  FirstName: 'Ad', LastName: 'Soyad', Position: 'Pozisyon', BaseSalary: 'Brüt maaş', HourlyRate: 'Saat ücreti', IsActive: 'Aktif', Amount: 'Tutar', Description: 'Açıklama',
  Date: 'Tarih', DueDate: 'Vade', Status: 'Durum', Bonus: 'Prim', Deductions: 'Kesinti', NetPay: 'Net', GrossPay: 'Brüt', Title: 'Başlık', Name: 'Ad', ClockIn: 'Giriş', ClockOut: 'Çıkış',
  IsDeleted: 'Silindi', Note: 'Not', Phone: 'Telefon', DocumentNo: 'Belge no', CategoryId: 'Kategori', PayType: 'Ücret tipi', EmployeeNumber: 'Sicil',
}

/** Değişiklik kaydı: kim, neyi, ne zaman; değişen alanların eski ve yeni değeriyle. */
export function AuditPage() {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [action, setAction] = useState<'all' | Action>('all')
  const [q, setQ] = useState('')
  const from = isoDate(month)
  const to = isoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0))
  const { data, loading, error } = useApi<Audit[]>(`/api/audit?from=${from}&to=${to}`)

  const rows = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('tr')
    return (data ?? []).filter((a) => (action === 'all' || a.action === action) &&
      (!term || `${a.entityLabel ?? ''} ${a.userName ?? ''} ${ENTITY[a.entityType] ?? a.entityType}`.toLocaleLowerCase('tr').includes(term)))
  }, [data, action, q])

  const cols: Column<Audit>[] = [
    { key: 'at', header: 'Zaman', value: (a) => a.at, render: (a) => <span className="whitespace-nowrap tabular-nums">{new Date(a.at.endsWith('Z') ? a.at : `${a.at}Z`).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span> },
    { key: 'user', header: 'Kullanıcı', value: (a) => a.userName, render: (a) => (a.userName ? <span className="inline-flex items-center gap-2"><Avatar name={a.userName} size={22} />{a.userName}</span> : <span className="text-[var(--text-muted)]">Sistem</span>) },
    { key: 'action', header: 'İşlem', value: (a) => ACTION[a.action].label, render: (a) => <Badge dot tone={ACTION[a.action].tone}>{ACTION[a.action].label}</Badge> },
    { key: 'type', header: 'Kayıt türü', value: (a) => ENTITY[a.entityType] ?? a.entityType, render: (a) => ENTITY[a.entityType] ?? a.entityType },
    { key: 'label', header: 'Kayıt', value: (a) => a.entityLabel, render: (a) => <span className="font-medium">{a.entityLabel ?? '—'}</span> },
    { key: 'changes', header: 'Değişiklik', value: (a) => a.changesJson, render: (a) => <Changes json={a.changesJson} /> },
  ]

  return (
    <>
      <PageHeader title="Değişiklik Kaydı" subtitle="Bu şirkette kim, neyi, ne zaman değiştirdi · kayıtlar silinemez"
        toolbar={<>
          <Pager label={`${MONTHS[month.getMonth()]} ${month.getFullYear()}`} onPrev={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} onNext={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
          <Segmented size="sm" value={action} onChange={setAction} options={[{ value: 'all', label: 'Tümü' }, ...(Object.keys(ACTION) as Action[]).map((k) => ({ value: k, label: ACTION[k].label }))]} />
          <div className="ml-auto"><SearchField value={q} onChange={setQ} placeholder="Kayıt, kullanıcı, tür" /></div>
        </>} />
      <GlassCard className="p-2">
        {!data ? <LoadState loading={loading} error={error} /> : (
          <DataTable tableId="audit" exportName={`Değişiklik Kaydı ${MONTHS[month.getMonth()]}`} columns={cols} rows={rows} rowKey={(a) => String(a.id)}
            empty={<p className="py-12 text-center text-[13px] text-[var(--text-muted)]">Bu dönemde kayıt yok.</p>} />
        )}
      </GlassCard>
    </>
  )
}

function Changes({ json }: { json: string | null }) {
  if (!json) return <span className="text-[var(--text-faint)]">—</span>
  let parsed: Record<string, [string | null, string | null] | number> = {}
  try { parsed = JSON.parse(json) } catch { return null }
  const entries = Object.entries(parsed)
  return (
    <span className="flex flex-col gap-0.5 text-[12px]">
      {entries.slice(0, 3).map(([k, v]) => Array.isArray(v)
        ? <span key={k}><span className="text-[var(--text-muted)]">{FIELD[k] ?? k}:</span> <s className="text-[var(--text-faint)]">{v[0] ?? '∅'}</s> → <b>{v[1] ?? '∅'}</b></span>
        : <span key={k}><span className="text-[var(--text-muted)]">{k}:</span> <b>{String(v)}</b></span>)}
      {entries.length > 3 && <span className="text-[var(--text-faint)]">+{entries.length - 3} alan</span>}
    </span>
  )
}
