import { useMemo, useState } from 'react'
import { Button, GlassCard, LoadState, PageHeader, Pager, cx } from '../../components/ui/Glass'
import { Icon } from '../../components/ui/Icons'
import { addDays, isoDate, MONTHS_SHORT, number, startOfWeek, WEEKDAYS_SHORT } from '../../lib/format'
import type { Employee, ShiftAssignment, ShiftTemplate } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { ImportDialog } from '../import/ImportDialog'
import { DropOverlay, useFileDrop } from '../import/useFileDrop'
import { AssignmentForm, STATUS_LABEL, TemplatesDialog } from './ShiftForms'

export function ShiftsPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const from = isoDate(days[0])
  const to = isoDate(days[6])
  const today = isoDate(new Date())

  const employees = useApi<Employee[]>('/api/employees')
  const templates = useApi<ShiftTemplate[]>('/api/shifts/templates')
  const assignments = useApi<ShiftAssignment[]>(`/api/shifts/assignments?from=${from}&to=${to}`)

  const [form, setForm] = useState<{ assignment?: ShiftAssignment; employeeId?: string; date?: string } | null>(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const dragging = useFileDrop((file) => { setDroppedFile(file); setImportOpen(true) }, !importOpen && !form && !templatesOpen)

  const byKey = useMemo(() => {
    const map = new Map<string, ShiftAssignment[]>()
    for (const a of assignments.data ?? []) {
      const key = `${a.employeeId}|${a.date}`
      map.set(key, [...(map.get(key) ?? []), a])
    }
    return map
  }, [assignments.data])

  const tpl = useMemo(() => new Map((templates.data ?? []).map((t) => [t.id, t])), [templates.data])
  const activeEmployees = (employees.data ?? []).filter((e) => e.isActive)

  const label = `${days[0].getDate()} ${MONTHS_SHORT[days[0].getMonth()]} – ${days[6].getDate()} ${MONTHS_SHORT[days[6].getMonth()]} ${days[6].getFullYear()}`
  const ready = employees.data && templates.data && assignments.data

  return (
    <>
      <PageHeader
        title="Vardiya Planı"
        subtitle="Boş hücreye tıklayarak vardiya ekleyin, vardiyaya tıklayarak düzenleyin"
        actions={<>
          <Button variant="secondary" icon="gear" onClick={() => setTemplatesOpen(true)}>Vardiya Tanımları</Button>
          <Button variant="secondary" icon="upload" onClick={() => { setDroppedFile(null); setImportOpen(true) }}>Excel'den Aktar</Button>
        </>}
        toolbar={<>
          <Pager label={label} onPrev={() => setWeekStart(addDays(weekStart, -7))} onNext={() => setWeekStart(addDays(weekStart, 7))} onToday={() => setWeekStart(startOfWeek(new Date()))} />
          <div className="ml-auto flex flex-wrap gap-1.5">
            {(templates.data ?? []).map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--hover)] px-2.5 py-1 text-[12px]">
                <span className="size-2 rounded-full" style={{ background: t.color ?? 'var(--accent)' }} />
                <span className="font-medium">{t.name}</span>
                <span className="tabular-nums text-[var(--text-muted)]">{t.startTime.slice(0, 5)}–{t.endTime.slice(0, 5)}</span>
              </span>
            ))}
          </div>
        </>}
      />

      <GlassCard className="overflow-hidden p-0">
        {!ready ? (
          <LoadState loading error={employees.error ?? assignments.error ?? templates.error} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-[12px]">
              <thead>
                <tr>
                  <th className="w-48 border-b border-[var(--glass-border)] px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Çalışan</th>
                  {days.map((d, i) => {
                    const isToday = isoDate(d) === today
                    return (
                      <th key={i} className={cx('border-b border-l border-[var(--glass-border)] px-2 py-2.5 text-center font-medium', isToday && 'bg-[var(--today-bg)]')}>
                        <span className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{WEEKDAYS_SHORT[i]}</span>{' '}
                        <span className={cx('tabular-nums', isToday && 'rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-white')}>{d.getDate()}</span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {activeEmployees.map((e) => (
                  <tr key={e.id} className="hover:bg-[var(--hover)]">
                    <td className="border-b border-[var(--row-border)] px-4 py-2">
                      <p className="font-medium">{e.firstName} {e.lastName}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">{e.position}</p>
                    </td>
                    {days.map((d, i) => {
                      const date = isoDate(d)
                      const list = byKey.get(`${e.id}|${date}`) ?? []
                      return (
                        <td key={i}
                          onClick={() => setForm({ employeeId: e.id, date })}
                          className={cx('group/cell cursor-pointer border-b border-l border-[var(--row-border)] p-1.5 align-top', date === today && 'bg-[var(--today-bg)]')}>
                          {list.map((a) => <ShiftChip key={a.id} a={a} t={tpl.get(a.shiftTemplateId)} onClick={() => setForm({ assignment: a })} />)}
                          {list.length === 0 && <span className="grid h-10 place-items-center rounded-lg border border-dashed border-transparent text-[var(--text-muted)] opacity-0 transition group-hover/cell:border-[var(--glass-border)] group-hover/cell:opacity-100"><Icon name="plus" size={15} /></span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {activeEmployees.length === 0 && <p className="py-10 text-center text-[13px] text-[var(--text-muted)]">Önce Personel ekranından çalışan ekleyin.</p>}
          </div>
        )}
      </GlassCard>

      <AssignmentForm open={!!form} initial={form} employees={activeEmployees} templates={templates.data ?? []} onClose={() => setForm(null)} onSaved={assignments.reload} />
      <TemplatesDialog open={templatesOpen} templates={templates.data ?? []} onClose={() => setTemplatesOpen(false)} onSaved={templates.reload} />
      <ImportDialog kind="shift-assignments" open={importOpen} file={droppedFile} onClose={() => { setImportOpen(false); setDroppedFile(null) }} onDone={assignments.reload} />
      <DropOverlay show={dragging} title="Vardiya planı" />
    </>
  )
}

function ShiftChip({ a, t, onClick }: { a: ShiftAssignment; t: ShiftTemplate | undefined; onClick: () => void }) {
  const color = t?.color ?? '#8e8e93'
  const off = a.status === 'Absent' || a.status === 'Leave'
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title={`${t?.name} · ${STATUS_LABEL[a.status]}${a.note ? ` · ${a.note}` : ''}`}
      className={cx('mb-1 block w-full rounded-lg border-l-[3px] px-2 py-1 text-left transition hover:brightness-95 last:mb-0', off && 'opacity-80')}
      style={{ borderColor: off ? 'var(--text-muted)' : color, background: off ? 'var(--hover)' : `${color}22` }}
    >
      <p className="font-medium">{t?.name}</p>
      <p className="text-[10.5px] text-[var(--text-muted)]">
        {a.status === 'Completed' && a.workedHours != null
          ? <>✓ {number(a.workedHours)} sa{a.overtimeHours ? <> · <b className="font-semibold text-[var(--text)]">+{number(a.overtimeHours)} FM</b></> : null}</>
          : STATUS_LABEL[a.status]}
      </p>
    </button>
  )
}
