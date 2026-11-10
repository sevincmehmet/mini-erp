import { useEffect, useState } from 'react'
import { Button, Segmented, cx } from '../../components/ui/Glass'
import { Modal } from '../../components/ui/Modal'
import { Field, FormError, FormGrid, Input, Select } from '../../components/ui/Form'
import { errorMessage, send } from '../../lib/apiClient'
import type { Employee, ShiftAssignment, ShiftStatus, ShiftTemplate } from '../../lib/types'
import { toast } from '../../stores/useToastStore'

export const STATUS_LABEL: Record<ShiftStatus, string> = { Planned: 'Planlandı', Completed: 'Tamamlandı', Absent: 'Gelmedi', Leave: 'İzinli' }

// ---------------------------------------------------------------- Vardiya atama
interface AssignmentProps {
  open: boolean
  /** Düzenlenen kayıt ya da yeni kayıt için ön değerler. */
  initial: { assignment?: ShiftAssignment; employeeId?: string; date?: string } | null
  employees: Employee[]
  templates: ShiftTemplate[]
  onClose: () => void
  onSaved: () => void
}

export function AssignmentForm({ open, initial, employees, templates, onClose, onSaved }: AssignmentProps) {
  const a = initial?.assignment
  const [employeeId, setEmployeeId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [date, setDate] = useState('')
  const [status, setStatus] = useState<ShiftStatus>('Planned')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setEmployeeId(a?.employeeId ?? initial?.employeeId ?? employees[0]?.id ?? '')
    setTemplateId(a?.shiftTemplateId ?? templates[0]?.id ?? '')
    setDate(a?.date ?? initial?.date ?? '')
    setStatus(a?.status ?? 'Planned')
    setNote(a?.note ?? '')
  }, [open, a, initial, employees, templates])

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      toast.success(message)
      onSaved()
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const body = { employeeId, shiftTemplateId: templateId, date, status, note: note || null }
  const save = () => run(() => (a ? send('PUT', `/api/shifts/assignments/${a.id}`, body) : send('POST', '/api/shifts/assignments', body)), a ? 'Vardiya güncellendi.' : 'Vardiya eklendi.')
  const remove = () => a && run(() => send('DELETE', `/api/shifts/assignments/${a.id}`), 'Vardiya silindi.')

  return (
    <Modal open={open} onClose={onClose} title={a ? 'Vardiyayı Düzenle' : 'Vardiya Ekle'} width="sm"
      footer={<>
        {a && <Button variant="ghost" className="mr-auto !text-[var(--danger)]" onClick={remove} disabled={busy}>Sil</Button>}
        <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
        <Button onClick={save} disabled={busy || !templateId}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</Button>
      </>}>
      {templates.length === 0 ? (
        <p className="text-[13px] text-[var(--text-muted)]">Önce "Vardiya Tanımları"ndan en az bir vardiya (ör. Sabah 08:00–16:00) oluşturun.</p>
      ) : (
        <FormGrid>
          <Field label="Çalışan" required className="col-span-2">
            <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}{e.employeeNumber ? ` · ${e.employeeNumber}` : ''}</option>)}
            </Select>
          </Field>
          <Field label="Tarih" required><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Vardiya" required>
            <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.startTime.slice(0, 5)}–{t.endTime.slice(0, 5)})</option>)}
            </Select>
          </Field>
          <div className="col-span-2">
            <p className="mb-1 text-[12px] font-medium text-[var(--text-muted)]">Durum</p>
            <Segmented value={status} onChange={setStatus} options={(Object.keys(STATUS_LABEL) as ShiftStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
            {status === 'Completed' && !a?.workedHours && <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">Gerçek giriş/çıkış saatlerini Puantaj ekranından girerseniz fazla mesai otomatik hesaplanır.</p>}
          </div>
          <Field label="Not" className="col-span-2"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. Yıllık izin" /></Field>
        </FormGrid>
      )}
      <FormError message={error} />
    </Modal>
  )
}

// ---------------------------------------------------------------- Vardiya tanımları
const COLORS = ['#FF9F0A', '#0A84FF', '#5E5CE6', '#30D158', '#BF5AF2', '#FF375F', '#64D2FF', '#8E8E93']

export function TemplatesDialog({ open, templates, onClose, onSaved }: { open: boolean; templates: ShiftTemplate[]; onClose: () => void; onSaved: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null) // 'new' = yeni
  const [name, setName] = useState('')
  const [start, setStart] = useState('08:00')
  const [end, setEnd] = useState('16:00')
  const [breakMin, setBreakMin] = useState('30')
  const [color, setColor] = useState(COLORS[0])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) { setEditingId(null); setError(null) } }, [open])

  const edit = (t: ShiftTemplate | null) => {
    setError(null)
    setEditingId(t?.id ?? 'new')
    setName(t?.name ?? '')
    setStart(t?.startTime.slice(0, 5) ?? '08:00')
    setEnd(t?.endTime.slice(0, 5) ?? '16:00')
    setBreakMin(String(t?.breakMinutes ?? 30))
    setColor(t?.color ?? COLORS[templates.length % COLORS.length])
  }

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      toast.success(message)
      setEditingId(null)
      onSaved()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const body = { name, startTime: start, endTime: end, breakMinutes: Number(breakMin) || 0, color }

  return (
    <Modal open={open} onClose={onClose} title="Vardiya Tanımları" footer={<Button onClick={onClose}>Kapat</Button>}>
      <ul className="divide-y divide-[var(--row-border)]">
        {templates.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2 text-[13px]">
            <span className="size-3 rounded-full" style={{ background: t.color ?? 'var(--accent)' }} />
            <span className="w-28 font-medium">{t.name}</span>
            <span className="tabular-nums text-[var(--text-muted)]">{t.startTime.slice(0, 5)}–{t.endTime.slice(0, 5)} · {t.breakMinutes} dk mola</span>
            <span className="ml-auto flex gap-1">
              <Button variant="ghost" onClick={() => edit(t)}>Düzenle</Button>
              <Button variant="ghost" className="!text-[var(--danger)]" onClick={() => run(() => send('DELETE', `/api/shifts/templates/${t.id}`), 'Vardiya tanımı silindi.')}>Sil</Button>
            </span>
          </li>
        ))}
      </ul>

      {editingId ? (
        <form className="mt-3 rounded-xl bg-[var(--hover)] p-3" onSubmit={(e) => {
          e.preventDefault()
          void run(() => (editingId === 'new' ? send('POST', '/api/shifts/templates', body) : send('PUT', `/api/shifts/templates/${editingId}`, body)), 'Vardiya tanımı kaydedildi.')
        }}>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Ad" required className="col-span-4"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ör. Sabah" /></Field>
            <Field label="Başlangıç"><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="Bitiş" hint={end <= start ? 'Ertesi gün biter' : undefined}><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
            <Field label="Mola (dk)"><Input inputMode="numeric" value={breakMin} onChange={(e) => setBreakMin(e.target.value)} /></Field>
            <Field label="Renk">
              <div className="flex h-8 items-center gap-1">
                {COLORS.map((c) => (
                  <button type="button" key={c} onClick={() => setColor(c)} aria-label={c}
                    className={cx('size-4 rounded-full', color === c && 'ring-2 ring-[var(--text)] ring-offset-2 ring-offset-[var(--modal-bg)]')} style={{ background: c }} />
                ))}
              </div>
            </Field>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>Vazgeç</Button>
            <Button type="submit" disabled={busy}>Kaydet</Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" icon="plus" className="mt-3" onClick={() => edit(null)}>Yeni Vardiya</Button>
      )}
      <FormError message={error} />
    </Modal>
  )
}
