import { useMemo, useState } from 'react'
import { DataTable, RowAction, type Column } from '../../components/data/DataTable'
import { EmptyHint } from '../../components/data/EmptyHint'
import { Badge, Button, GlassCard, LoadState, PageHeader, Pager, StatTile } from '../../components/ui/Glass'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Form'
import { errorMessage, send } from '../../lib/apiClient'
import { isoDate, MONTHS, number, shortDate } from '../../lib/format'
import type { Employee, TimeEntry } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { toast } from '../../stores/useToastStore'
import { ImportDialog } from '../import/ImportDialog'
import { DropOverlay, useFileDrop } from '../import/useFileDrop'
import { TimeEntryForm } from './TimeEntryForm'

const time = (iso: string | null) => (iso ? iso.slice(11, 16) : '—')

const COLUMNS: Column<TimeEntry>[] = [
  { key: 'date', header: 'Tarih', type: 'date', value: (t) => t.date, render: (t) => <span className="whitespace-nowrap tabular-nums">{shortDate(t.date)}</span> },
  { key: 'employee', header: 'Çalışan', value: (t) => t.employeeName, render: (t) => <span className="font-medium">{t.employeeName}</span> },
  { key: 'number', header: 'Sicil', defaultHidden: true, value: (t) => t.employeeNumber, render: (t) => <span className="tabular-nums text-[var(--text-muted)]">{t.employeeNumber}</span> },
  { key: 'shift', header: 'Vardiya', value: (t) => t.shiftName, render: (t) => t.shiftName ?? <span className="text-[var(--text-muted)]">Plansız</span> },
  { key: 'in', header: 'Giriş', value: (t) => time(t.clockIn), render: (t) => <span className="tabular-nums">{time(t.clockIn)}</span> },
  {
    key: 'out', header: 'Çıkış', value: (t) => time(t.clockOut),
    render: (t) => <span className="tabular-nums">{time(t.clockOut)}{t.clockOut && t.clockOut.slice(0, 10) !== t.clockIn.slice(0, 10) && <sup className="ml-0.5 text-[var(--text-muted)]">+1</sup>}</span>,
  },
  { key: 'break', header: 'Mola', align: 'right', type: 'number', value: (t) => t.breakMinutes, render: (t) => `${t.breakMinutes} dk` },
  { key: 'worked', header: 'Çalışılan', align: 'right', type: 'number', total: true, value: (t) => t.workedHours, render: (t) => `${number(t.workedHours)} sa` },
  { key: 'overtime', header: 'Fazla Mesai', align: 'right', type: 'number', total: true, value: (t) => t.overtimeHours, render: (t) => (t.overtimeHours ? <b>+{number(t.overtimeHours)} sa</b> : '—') },
  { key: 'note', header: 'Not', value: (t) => t.note, render: (t) => <span className="text-[var(--text-muted)]">{t.note}</span> },
  { key: 'lock', header: 'Bordro', value: (t) => (t.locked ? 'Kilitli' : ''), render: (t) => (t.locked ? <Badge tone="info" dot>Bordro onaylı</Badge> : null) },
]

export function TimesheetPage() {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [employeeId, setEmployeeId] = useState('')
  const [editing, setEditing] = useState<TimeEntry | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<TimeEntry | null>(null)
  const [busy, setBusy] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)

  const from = isoDate(month)
  const to = isoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0))
  const employees = useApi<Employee[]>('/api/employees')
  const { data, loading, error, reload } = useApi<TimeEntry[]>(`/api/time-entries?from=${from}&to=${to}${employeeId ? `&employeeId=${employeeId}` : ''}`)
  const dragging = useFileDrop((file) => { setDroppedFile(file); setImportOpen(true) }, !importOpen && editing === undefined)

  const totals = useMemo(() => ({
    worked: (data ?? []).reduce((s, t) => s + t.workedHours, 0),
    overtime: (data ?? []).reduce((s, t) => s + t.overtimeHours, 0),
    people: new Set((data ?? []).map((t) => t.employeeId)).size,
  }), [data])

  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))

  const remove = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await send('DELETE', `/api/time-entries/${deleting.id}`)
      toast.success('Mesai kaydı silindi.')
      setDeleting(null)
      reload()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Puantaj"
        subtitle="Gerçekleşen giriş-çıkış saatleri · bordro bu kayıtlardan hesaplanır"
        actions={<>
          <Button variant="secondary" icon="upload" onClick={() => { setDroppedFile(null); setImportOpen(true) }}>Excel'den Aktar</Button>
          <Button icon="plus" onClick={() => setEditing(null)}>Mesai Ekle</Button>
        </>}
        toolbar={<>
          <Pager label={`${MONTHS[month.getMonth()]} ${month.getFullYear()}`} onPrev={() => shift(-1)} onNext={() => shift(1)} />
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="!w-52" aria-label="Çalışan filtresi">
            <option value="">Tüm çalışanlar</option>
            {(employees.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
          </Select>
        </>}
      />

      <div className="mb-3 grid grid-cols-3 gap-3">
        <StatTile icon="timesheet" tone="accent" label="Toplam Çalışılan" value={`${number(totals.worked)} saat`} hint={totals.people ? `Kişi başı ort. ${number(totals.worked / totals.people)} saat` : undefined} />
        <StatTile icon="bolt" tone="info" label="Toplam Fazla Mesai" value={`${number(totals.overtime)} saat`} hint={totals.worked ? `Çalışmanın %${((totals.overtime / totals.worked) * 100).toFixed(1)}'i` : undefined} />
        <StatTile icon="employees" tone="neutral" label="Çalışan" value={String(totals.people)} hint={`${data?.length ?? 0} mesai kaydı`} />
      </div>

      <GlassCard className="p-2">
        {!data ? <LoadState loading={loading} error={error} /> : (
          <DataTable
            tableId="timesheet"
            exportName={`Puantaj ${MONTHS[month.getMonth()]} ${month.getFullYear()}`}
            columns={COLUMNS}
            rows={data}
            rowKey={(t) => t.id}
            formatTotal={(_k, total) => `${number(total)} sa`}
            onRowDoubleClick={(t) => !t.locked && setEditing(t)}
            actions={(t) => <>
              <RowAction label={t.locked ? 'Bordrosu onaylanmış ay' : 'Düzenle'} disabled={t.locked} onClick={() => setEditing(t)} icon="edit" />
              <RowAction label="Sil" danger disabled={t.locked} onClick={() => setDeleting(t)} icon="trash" />
            </>}
            empty={<EmptyHint onAdd={() => setEditing(null)} onImport={() => setImportOpen(true)} />}
          />
        )}
      </GlassCard>

      <TimeEntryForm open={editing !== undefined} entry={editing ?? null} employees={(employees.data ?? []).filter((e) => e.isActive || e.id === editing?.employeeId)}
        onClose={() => setEditing(undefined)} onSaved={reload} />
      <ConfirmDialog open={!!deleting} busy={busy} title="Mesai kaydını sil"
        message={<>{deleting?.employeeName} · {deleting && shortDate(deleting.date)} {time(deleting?.clockIn ?? null)}–{time(deleting?.clockOut ?? null)} kaydı silinecek.</>}
        onConfirm={remove} onClose={() => setDeleting(null)} />
      <ImportDialog kind="time-entries" open={importOpen} file={droppedFile} onClose={() => { setImportOpen(false); setDroppedFile(null) }} onDone={reload} />
      <DropOverlay show={dragging} title="Mesai kayıtları (puantaj)" />
    </>
  )
}
