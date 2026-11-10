import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Glass'
import { Modal } from '../../components/ui/Modal'
import { Field, FormError, FormGrid, Input, Select } from '../../components/ui/Form'
import { errorMessage, send } from '../../lib/apiClient'
import { addDays, isoDate, parseDate } from '../../lib/format'
import type { Employee, TimeEntry } from '../../lib/types'
import { toast } from '../../stores/useToastStore'

interface Props {
  open: boolean
  entry: TimeEntry | null
  employees: Employee[]
  onClose: () => void
  onSaved: () => void
}

export function TimeEntryForm({ open, entry, employees, onClose, onSaved }: Props) {
  const [employeeId, setEmployeeId] = useState('')
  const [date, setDate] = useState(isoDate(new Date()))
  const [clockIn, setClockIn] = useState('08:00')
  const [clockOut, setClockOut] = useState('17:00')
  const [breakMin, setBreakMin] = useState('30')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setEmployeeId(entry?.employeeId ?? employees[0]?.id ?? '')
    setDate(entry?.date ?? isoDate(new Date()))
    setClockIn(entry?.clockIn.slice(11, 16) ?? '08:00')
    setClockOut(entry?.clockOut?.slice(11, 16) ?? '17:00')
    setBreakMin(String(entry?.breakMinutes ?? 30))
    setNote(entry?.note ?? '')
  }, [open, entry, employees])

  // Çıkış girişten önceyse gece vardiyası: ertesi güne taşar
  const overnight = clockOut <= clockIn
  const save = async () => {
    setBusy(true)
    setError(null)
    const outDate = overnight ? isoDate(addDays(parseDate(date), 1)) : date
    const body = { employeeId, clockIn: `${date}T${clockIn}:00`, clockOut: `${outDate}T${clockOut}:00`, breakMinutes: Number(breakMin) || 0, note: note || null }
    try {
      if (entry) await send('PUT', `/api/time-entries/${entry.id}`, body)
      else await send('POST', '/api/time-entries', body)
      toast.success(entry ? 'Mesai kaydı güncellendi.' : 'Mesai kaydı eklendi.')
      onSaved()
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={entry ? 'Mesai Kaydını Düzenle' : 'Mesai Kaydı Ekle'} width="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Vazgeç</Button><Button onClick={save} disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); void save() }}>
        <FormGrid>
          <Field label="Çalışan" required className="col-span-2">
            <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}{e.employeeNumber ? ` · ${e.employeeNumber}` : ''}</option>)}
            </Select>
          </Field>
          <Field label="Tarih" required className="col-span-2"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Giriş" required><Input type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} /></Field>
          <Field label="Çıkış" required hint={overnight ? 'Ertesi gün' : undefined}><Input type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} /></Field>
          <Field label="Mola (dk)"><Input inputMode="numeric" value={breakMin} onChange={(e) => setBreakMin(e.target.value)} /></Field>
          <Field label="Not"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </FormGrid>
        <p className="mt-3 text-[11px] text-[var(--text-muted)]">Çalışılan saat ve fazla mesai, o günkü vardiya planına göre otomatik hesaplanır (plan yoksa 7,5 saatin üstü fazla mesai sayılır).</p>
        <button type="submit" hidden />
      </form>
      <FormError message={error} />
    </Modal>
  )
}
