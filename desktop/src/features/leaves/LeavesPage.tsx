import { useEffect, useMemo, useState } from 'react'
import { AttachmentsDialog } from '../../components/data/Attachments'
import { DataTable, RowAction, type Column } from '../../components/data/DataTable'
import { Avatar, Badge, Button, GlassCard, LoadState, PageHeader, Pager, Segmented, StatTile, cx } from '../../components/ui/Glass'
import { Modal } from '../../components/ui/Modal'
import { Field, FormError, FormGrid, Input, Select, TextArea } from '../../components/ui/Form'
import { errorMessage, send } from '../../lib/apiClient'
import { isoDate, number, shortDate } from '../../lib/format'
import type { Employee } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { toast } from '../../stores/useToastStore'

type Kind = 'Annual' | 'Excuse' | 'Sick' | 'Unpaid' | 'Other'
type Status = 'Requested' | 'Approved' | 'Rejected'
interface Leave { id: string; employeeId: string; employeeName: string; kind: Kind; startDate: string; endDate: string; days: number; status: Status; note: string | null }
interface Balance { employeeId: string; employeeName: string; position: string | null; hireDate: string; seniorityYears: number; entitlement: number; used: number; pending: number; remaining: number }

const KIND: Record<Kind, string> = { Annual: 'Yıllık izin', Excuse: 'Mazeret', Sick: 'Raporlu', Unpaid: 'Ücretsiz', Other: 'Diğer' }
const STATUS: Record<Status, { label: string; tone: 'warning' | 'good' | 'neutral' }> = { Requested: { label: 'Onay bekliyor', tone: 'warning' }, Approved: { label: 'Onaylandı', tone: 'good' }, Rejected: { label: 'Reddedildi', tone: 'neutral' } }

export function LeavesPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [tab, setTab] = useState<'requests' | 'balances'>('requests')
  const leaves = useApi<Leave[]>(`/api/leaves?year=${year}`)
  const balances = useApi<Balance[]>(`/api/leaves/balances?year=${year}`)
  const employees = useApi<Employee[]>('/api/employees')
  const [form, setForm] = useState<{ leave: Leave | null; employeeId?: string } | null>(null)
  const [attach, setAttach] = useState<{ entityType: string; entityId: string; title: string } | null>(null)
  const reload = () => { leaves.reload(); balances.reload() }

  const act = async (path: string, message: string) => {
    try {
      const r = await send<{ affectedShifts?: number } | undefined>('POST', path)
      toast.success(r?.affectedShifts ? `${message} ${r.affectedShifts} vardiya "İzinli" olarak işaretlendi.` : message)
      reload()
    } catch (e) { toast.error(errorMessage(e)) }
  }

  const rows = leaves.data ?? []
  const pending = rows.filter((l) => l.status === 'Requested')
  const today = isoDate(new Date())
  const onLeaveToday = rows.filter((l) => l.status === 'Approved' && l.startDate <= today && l.endDate >= today)

  const cols: Column<Leave>[] = [
    { key: 'emp', header: 'Çalışan', value: (l) => l.employeeName, render: (l) => <span className="inline-flex items-center gap-2 font-medium"><Avatar name={l.employeeName} size={24} />{l.employeeName}</span> },
    { key: 'kind', header: 'Tür', value: (l) => KIND[l.kind], render: (l) => KIND[l.kind] },
    { key: 'start', header: 'Başlangıç', type: 'date', value: (l) => l.startDate, render: (l) => <span className="tabular-nums">{shortDate(l.startDate)}</span> },
    { key: 'end', header: 'Bitiş', type: 'date', value: (l) => l.endDate, render: (l) => <span className="tabular-nums">{shortDate(l.endDate)}</span> },
    { key: 'days', header: 'İş günü', align: 'right', type: 'number', total: true, value: (l) => l.days, render: (l) => number(l.days) },
    { key: 'note', header: 'Not', value: (l) => l.note, render: (l) => <span className="text-[var(--text-muted)]">{l.note}</span> },
    { key: 'status', header: 'Durum', value: (l) => STATUS[l.status].label, render: (l) => <Badge dot tone={STATUS[l.status].tone}>{STATUS[l.status].label}</Badge> },
  ]
  const balanceCols: Column<Balance>[] = [
    { key: 'emp', header: 'Çalışan', value: (b) => b.employeeName, render: (b) => <span className="inline-flex items-center gap-2 font-medium"><Avatar name={b.employeeName} size={24} />{b.employeeName}</span> },
    { key: 'pos', header: 'Pozisyon', value: (b) => b.position, render: (b) => <span className="text-[var(--text-muted)]">{b.position}</span> },
    { key: 'sen', header: 'Kıdem', align: 'right', type: 'number', value: (b) => b.seniorityYears, render: (b) => (b.seniorityYears < 1 ? <span className="text-[var(--text-muted)]">1 yıldan az</span> : `${b.seniorityYears} yıl`) },
    { key: 'ent', header: 'Yıllık hak', align: 'right', type: 'number', total: true, value: (b) => b.entitlement, render: (b) => `${b.entitlement} gün` },
    { key: 'used', header: 'Kullanılan', align: 'right', type: 'number', total: true, value: (b) => b.used, render: (b) => number(b.used) },
    { key: 'pend', header: 'Bekleyen', align: 'right', type: 'number', total: true, value: (b) => b.pending, render: (b) => (b.pending ? number(b.pending) : '—') },
    { key: 'rem', header: 'Kalan', align: 'right', type: 'number', total: true, value: (b) => b.remaining, render: (b) => <RemainingBar b={b} /> },
  ]

  return (
    <>
      <PageHeader title="İzinler" subtitle="İzin talepleri ve yıllık izin bakiyeleri (İş Kanunu md. 53'e göre kıdemle)"
        actions={<Button icon="plus" onClick={() => setForm({ leave: null })}>İzin Talebi</Button>}
        toolbar={<>
          <Pager label={String(year)} onPrev={() => setYear(year - 1)} onNext={() => setYear(year + 1)} />
          <Segmented value={tab} onChange={setTab} options={[{ value: 'requests', label: 'Talepler' }, { value: 'balances', label: 'Bakiyeler' }]} />
        </>} />

      <div className="mb-3 grid grid-cols-3 gap-3">
        <StatTile icon="beach" tone={pending.length ? 'warning' : 'good'} label="Onay bekleyen" value={String(pending.length)} hint={pending.length ? `${number(pending.reduce((s, l) => s + l.days, 0))} iş günü` : 'Bekleyen talep yok'} />
        <StatTile icon="employees" tone="info" label="Bugün izinli" value={String(onLeaveToday.length)} hint={onLeaveToday.map((l) => l.employeeName.split(' ')[0]).join(', ') || '—'} />
        <StatTile icon="calendar" tone="accent" label={`${year} kullanılan yıllık izin`} value={`${number((balances.data ?? []).reduce((s, b) => s + b.used, 0))} gün`} hint={`Toplam hak ${number((balances.data ?? []).reduce((s, b) => s + b.entitlement, 0))} gün`} />
      </div>

      <GlassCard className="p-2">
        {tab === 'requests' ? (!leaves.data ? <LoadState loading={leaves.loading} error={leaves.error} /> : (
          <DataTable tableId="leaves" exportName={`İzinler ${year}`} columns={cols} rows={rows} rowKey={(l) => l.id} formatTotal={(_k, t) => number(t)}
            actions={(l) => l.status === 'Requested' ? <>
              <RowAction icon="check" label="Onayla" onClick={() => act(`/api/leaves/${l.id}/approve`, 'İzin onaylandı.')} />
              <RowAction icon="x" label="Reddet" onClick={() => act(`/api/leaves/${l.id}/reject`, 'İzin reddedildi.')} />
              <RowAction icon="paperclip" label="Ekler (rapor vb.)" onClick={() => setAttach({ entityType: 'LeaveRequest', entityId: l.id, title: l.employeeName })} />
              <RowAction icon="edit" label="Düzenle" onClick={() => setForm({ leave: l })} />
              <RowAction icon="trash" label="Sil" danger onClick={async () => { try { await send('DELETE', `/api/leaves/${l.id}`); reload() } catch (e) { toast.error(errorMessage(e)) } }} />
            </> : <>
              <RowAction icon="paperclip" label="Ekler (rapor vb.)" onClick={() => setAttach({ entityType: 'LeaveRequest', entityId: l.id, title: l.employeeName })} />
              <RowAction icon="undo" label="Geri al (onay bekliyor yap)" onClick={() => act(`/api/leaves/${l.id}/revert`, 'İzin geri alındı.')} />
            </>}
            empty={<p className="py-12 text-center text-[13px] text-[var(--text-muted)]">{year} için izin kaydı yok.</p>} />
        )) : (!balances.data ? <LoadState loading={balances.loading} error={balances.error} /> : (
          <DataTable tableId="leave-balances" exportName={`İzin Bakiyeleri ${year}`} columns={balanceCols} rows={balances.data} rowKey={(b) => b.employeeId} formatTotal={(_k, t) => number(t)}
            actions={(b) => <RowAction icon="plus" label="İzin talebi" onClick={() => setForm({ leave: null, employeeId: b.employeeId })} />} />
        ))}
      </GlassCard>
      <p className="mt-3 text-[11.5px] text-[var(--text-muted)]">Pazar günleri izin gününden sayılmaz; resmî tatiller şimdilik düşülmüyor. 18 yaşından küçük ve 50 yaşından büyükler için yasal en az 20 gün kuralı doğum tarihi tutulmadığı için uygulanmıyor.</p>

      <LeaveForm open={!!form} leave={form?.leave ?? null} employeeId={form?.employeeId} employees={(employees.data ?? []).filter((e) => e.isActive)} onClose={() => setForm(null)} onSaved={reload} />
      <AttachmentsDialog target={attach} onClose={() => setAttach(null)} />
    </>
  )
}

function RemainingBar({ b }: { b: Balance }) {
  const ratio = b.entitlement ? Math.max(0, Math.min(1, b.remaining / b.entitlement)) : 0
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--hover-strong)]"><span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${ratio * 100}%` }} /></span>
      <b className={cx('tabular-nums', b.remaining < 0 && 'text-[var(--critical-text)]')}>{number(b.remaining)}</b>
    </span>
  )
}

function workDays(start: string, end: string) {
  if (!start || !end || end < start) return 0
  let n = 0
  for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) if (d.getDay() !== 0) n++
  return n
}

function LeaveForm({ open, leave, employeeId, employees, onClose, onSaved }: { open: boolean; leave: Leave | null; employeeId?: string; employees: Employee[]; onClose: () => void; onSaved: () => void }) {
  const today = isoDate(new Date())
  const [f, setF] = useState({ employeeId: '', kind: 'Annual' as Kind, startDate: today, endDate: today, note: '' })
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setError(null)
    setF(leave ? { employeeId: leave.employeeId, kind: leave.kind, startDate: leave.startDate, endDate: leave.endDate, note: leave.note ?? '' }
      : { employeeId: employeeId ?? employees[0]?.id ?? '', kind: 'Annual', startDate: today, endDate: today, note: '' })
  }, [open, leave, employeeId, employees, today])
  const days = useMemo(() => workDays(f.startDate, f.endDate), [f.startDate, f.endDate])
  const save = async () => {
    try {
      if (leave) await send('PUT', `/api/leaves/${leave.id}`, f)
      else await send('POST', '/api/leaves', f)
      toast.success('İzin talebi kaydedildi.')
      onSaved(); onClose()
    } catch (e) { setError(errorMessage(e)) }
  }
  return (
    <Modal open={open} onClose={onClose} title={leave ? 'İzni Düzenle' : 'İzin Talebi'} width="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Vazgeç</Button><Button onClick={save}>Kaydet</Button></>}>
      <FormGrid>
        <Field label="Çalışan" required className="col-span-2"><Select value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}>{employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</Select></Field>
        <Field label="Tür" className="col-span-2"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Kind })}>{(Object.keys(KIND) as Kind[]).map((k) => <option key={k} value={k}>{KIND[k]}</option>)}</Select></Field>
        <Field label="Başlangıç" required><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value, endDate: e.target.value > f.endDate ? e.target.value : f.endDate })} /></Field>
        <Field label="Bitiş" required hint={`${days} iş günü (Pazar hariç)`}><Input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
        <Field label="Not" className="col-span-2"><TextArea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </FormGrid>
      <FormError message={error} />
    </Modal>
  )
}
