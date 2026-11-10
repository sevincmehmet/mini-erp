import { useMemo, useState } from 'react'
import { DataTable, RowAction, type Column } from '../../components/data/DataTable'
import { EmptyHint } from '../../components/data/EmptyHint'
import { Avatar, Badge, Button, GlassCard, LoadState, PageHeader, SearchField, StatTile } from '../../components/ui/Glass'
import { ConfirmDialog } from '../../components/ui/Modal'
import { errorMessage, send } from '../../lib/apiClient'
import { money, MONTHS_SHORT, number, parseDate } from '../../lib/format'
import type { Employee } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { toast } from '../../stores/useToastStore'
import { useNavStore } from '../../stores/useNavStore'
import { ImportDialog } from '../import/ImportDialog'
import { DropOverlay, useFileDrop } from '../import/useFileDrop'
import { EmployeeForm } from './EmployeeForm'

const dateLabel = (iso: string | null) => {
  if (!iso) return '—'
  const d = parseDate(iso)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

const COLUMNS: Column<Employee>[] = [
  { key: 'number', header: 'Sicil', value: (e) => e.employeeNumber, render: (e) => <span className="tabular-nums text-[var(--text-muted)]">{e.employeeNumber}</span> },
  {
    key: 'name', header: 'Ad Soyad', value: (e) => `${e.firstName} ${e.lastName}`,
    render: (e) => (
      <div className="flex items-center gap-2.5">
        <Avatar name={`${e.firstName} ${e.lastName}`} />
        <span className="font-medium">{e.firstName} {e.lastName}</span>
      </div>
    ),
  },
  { key: 'position', header: 'Pozisyon', value: (e) => e.position, render: (e) => e.position },
  { key: 'phone', header: 'Telefon', value: (e) => e.phone, render: (e) => <span className="tabular-nums text-[var(--text-muted)]">{e.phone}</span> },
  { key: 'nationalId', header: 'TC Kimlik', defaultHidden: true, value: (e) => e.nationalId, render: (e) => <span className="tabular-nums">{e.nationalId}</span> },
  { key: 'hireDate', header: 'İşe Giriş', type: 'date', value: (e) => e.hireDate, render: (e) => <span className="tabular-nums">{dateLabel(e.hireDate)}</span> },
  { key: 'terminationDate', header: 'İşten Çıkış', type: 'date', defaultHidden: true, value: (e) => e.terminationDate, render: (e) => dateLabel(e.terminationDate) },
  { key: 'status', header: 'Durum', value: (e) => (e.isActive ? 'Aktif' : 'Pasif'), render: (e) => <Badge dot tone={e.isActive ? 'good' : 'neutral'}>{e.isActive ? 'Aktif' : 'Pasif'}</Badge> },
  { key: 'payType', header: 'Ücret Tipi', value: (e) => (e.payType === 'Monthly' ? 'Aylık' : 'Saatlik'), render: (e) => <Badge tone={e.payType === 'Monthly' ? 'info' : 'neutral'}>{e.payType === 'Monthly' ? 'Aylık' : 'Saatlik'}</Badge> },
  {
    key: 'pay', header: 'Ücret', align: 'right', type: 'money', value: (e) => (e.payType === 'Monthly' ? e.baseSalary : e.hourlyRate),
    render: (e) => (e.payType === 'Monthly' ? `${money(e.baseSalary)} / ay` : `${money(e.hourlyRate ?? 0)} / saat`),
  },
  { key: 'otMultiplier', header: 'FM Katsayısı', align: 'right', type: 'number', defaultHidden: true, value: (e) => e.overtimeMultiplier, render: (e) => `×${number(e.overtimeMultiplier)}` },
]

export function EmployeesPage() {
  const { data, loading, error, reload } = useApi<Employee[]>('/api/employees')
  // Komut paletinden bir çalışan seçildiyse arama kutusu dolu gelir
  const [q, setQ] = useState(() => { const s = useNavStore.getState().search ?? ''; useNavStore.getState().clearSearch(); return s })
  const [editing, setEditing] = useState<Employee | null | undefined>(undefined) // undefined = kapalı, null = yeni
  const [deleting, setDeleting] = useState<Employee | null>(null)
  const [busy, setBusy] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)

  const dragging = useFileDrop((file) => { setDroppedFile(file); setImportOpen(true) }, !importOpen)

  const rows = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('tr')
    return (data ?? []).filter((e) =>
      !term || `${e.firstName} ${e.lastName} ${e.position ?? ''} ${e.employeeNumber ?? ''} ${e.phone ?? ''}`.toLocaleLowerCase('tr').includes(term))
  }, [data, q])

  const active = (data ?? []).filter((e) => e.isActive)
  const monthly = active.filter((e) => e.payType === 'Monthly').length

  const remove = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await send('DELETE', `/api/employees/${deleting.id}`)
      toast.success('Çalışan silindi.')
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
        title="Personel"
        subtitle="Çalışan listesi ve ücret bilgileri"
        actions={<>
          <SearchField value={q} onChange={setQ} placeholder="Ad, pozisyon, sicil, telefon" />
          <Button variant="secondary" icon="upload" onClick={() => { setDroppedFile(null); setImportOpen(true) }}>Excel'den Aktar</Button>
          <Button icon="plus" onClick={() => setEditing(null)}>Yeni Personel</Button>
        </>}
      />

      <div className="mb-3 grid grid-cols-3 gap-3">
        <StatTile icon="employees" tone="accent" label="Aktif Çalışan" value={data ? String(active.length) : '–'} hint={data && data.length > active.length ? `${data.length - active.length} pasif çalışan` : 'Tümü aktif'} />
        <StatTile icon="calendar" tone="info" label="Aylık Ücretli" value={data ? String(monthly) : '–'} hint={data ? `Toplam brüt ${money(active.filter((e) => e.payType === 'Monthly').reduce((s, e) => s + e.baseSalary, 0))}` : undefined} />
        <StatTile icon="timesheet" tone="neutral" label="Saatlik Ücretli" value={data ? String(active.length - monthly) : '–'} hint={data && active.length - monthly > 0 ? `Ort. ${money(active.filter((e) => e.payType === 'Hourly').reduce((s, e) => s + (e.hourlyRate ?? 0), 0) / (active.length - monthly))} / saat` : undefined} />
      </div>

      <GlassCard className="p-2">
        {!data ? <LoadState loading={loading} error={error} /> : (
          <DataTable
            tableId="employees"
            exportName="Personel"
            columns={COLUMNS}
            rows={rows}
            rowKey={(e) => e.id}
            onRowDoubleClick={setEditing}
            actions={(e) => <>
              <RowAction label="Düzenle" onClick={() => setEditing(e)} icon="edit" />
              <RowAction label="Sil" danger onClick={() => setDeleting(e)} icon="trash" />
            </>}
            empty={<EmptyHint onAdd={() => setEditing(null)} onImport={() => setImportOpen(true)} />}
          />
        )}
      </GlassCard>

      <EmployeeForm open={editing !== undefined} employee={editing ?? null} onClose={() => setEditing(undefined)} onSaved={reload} />
      <ConfirmDialog open={!!deleting} busy={busy} title="Çalışanı sil"
        message={<>{deleting?.firstName} {deleting?.lastName} silinecek. Geçmiş vardiya ve mesai kayıtları korunur. Sadece işten ayrıldıysa silmek yerine <b>Pasif</b> yapmanız önerilir.</>}
        onConfirm={remove} onClose={() => setDeleting(null)} />
      <ImportDialog kind="employees" open={importOpen} file={droppedFile} onClose={() => { setImportOpen(false); setDroppedFile(null) }} onDone={reload} />
      <DropOverlay show={dragging} title="Personel listesi" />
    </>
  )
}
