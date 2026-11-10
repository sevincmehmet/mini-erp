import { useEffect, useState } from 'react'
import { Button, Segmented } from '../../components/ui/Glass'
import { Modal } from '../../components/ui/Modal'
import { Field, FormError, FormGrid, Input, toNumber } from '../../components/ui/Form'
import { errorMessage, send } from '../../lib/apiClient'
import { isoDate } from '../../lib/format'
import type { Employee, PayType } from '../../lib/types'
import { toast } from '../../stores/useToastStore'

interface Props {
  open: boolean
  employee: Employee | null // null = yeni kayıt
  onClose: () => void
  onSaved: () => void
}

const empty = () => ({
  firstName: '', lastName: '', employeeNumber: '', nationalId: '', position: '', phone: '',
  hireDate: isoDate(new Date()), terminationDate: '', isActive: true, payType: 'Monthly' as PayType,
  baseSalary: '', hourlyRate: '', overtimeMultiplier: '1,5',
})

export function EmployeeForm({ open, employee, onClose, onSaved }: Props) {
  const [f, setF] = useState(empty)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setF(employee ? {
      firstName: employee.firstName, lastName: employee.lastName, employeeNumber: employee.employeeNumber ?? '',
      nationalId: employee.nationalId ?? '', position: employee.position ?? '', phone: employee.phone ?? '',
      hireDate: employee.hireDate, terminationDate: employee.terminationDate ?? '', isActive: employee.isActive,
      payType: employee.payType, baseSalary: employee.baseSalary ? String(employee.baseSalary).replace('.', ',') : '',
      hourlyRate: employee.hourlyRate ? String(employee.hourlyRate).replace('.', ',') : '',
      overtimeMultiplier: String(employee.overtimeMultiplier).replace('.', ','),
    } : empty())
  }, [open, employee])

  const set = <K extends keyof ReturnType<typeof empty>>(k: K, v: ReturnType<typeof empty>[K]) => setF((s) => ({ ...s, [k]: v }))

  const save = async () => {
    setBusy(true)
    setError(null)
    const body = {
      firstName: f.firstName, lastName: f.lastName, employeeNumber: f.employeeNumber || null, nationalId: f.nationalId || null,
      position: f.position || null, phone: f.phone || null, hireDate: f.hireDate, terminationDate: f.terminationDate || null,
      isActive: f.isActive, payType: f.payType, baseSalary: toNumber(f.baseSalary),
      hourlyRate: f.hourlyRate ? toNumber(f.hourlyRate) : null, overtimeMultiplier: toNumber(f.overtimeMultiplier) || 1.5,
      monthlyStandardHours: employee?.monthlyStandardHours ?? 225,
    }
    try {
      if (employee) await send('PUT', `/api/employees/${employee.id}`, body)
      else await send('POST', '/api/employees', body)
      toast.success(employee ? 'Çalışan güncellendi.' : 'Çalışan eklendi.')
      onSaved()
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={employee ? `${employee.firstName} ${employee.lastName}` : 'Yeni Personel'}
      footer={<><Button variant="secondary" onClick={onClose}>Vazgeç</Button><Button onClick={save} disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); void save() }}>
        <FormGrid>
          <Field label="Ad" required><Input value={f.firstName} onChange={(e) => set('firstName', e.target.value)} /></Field>
          <Field label="Soyad" required><Input value={f.lastName} onChange={(e) => set('lastName', e.target.value)} /></Field>
          <Field label="Sicil No" hint="Şirket içinde benzersiz"><Input value={f.employeeNumber} onChange={(e) => set('employeeNumber', e.target.value)} /></Field>
          <Field label="TC Kimlik No"><Input inputMode="numeric" maxLength={11} value={f.nationalId} onChange={(e) => set('nationalId', e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Pozisyon"><Input value={f.position} onChange={(e) => set('position', e.target.value)} /></Field>
          <Field label="Telefon"><Input value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="İşe Giriş" required><Input type="date" value={f.hireDate} onChange={(e) => set('hireDate', e.target.value)} /></Field>
          <Field label="İşten Çıkış"><Input type="date" value={f.terminationDate} onChange={(e) => set('terminationDate', e.target.value)} /></Field>

          <div className="col-span-2 mt-1 border-t border-[var(--glass-border)] pt-3">
            <Segmented value={f.payType} onChange={(v) => set('payType', v)} options={[{ value: 'Monthly', label: 'Aylık ücretli' }, { value: 'Hourly', label: 'Saatlik ücretli' }]} />
          </div>
          {f.payType === 'Monthly' ? (
            <Field label="Brüt Maaş (₺)" required hint="Fazla mesai saat ücreti = maaş ÷ 225"><Input inputMode="decimal" value={f.baseSalary} onChange={(e) => set('baseSalary', e.target.value)} placeholder="45.000" /></Field>
          ) : (
            <Field label="Saat Ücreti (₺)" required><Input inputMode="decimal" value={f.hourlyRate} onChange={(e) => set('hourlyRate', e.target.value)} placeholder="210" /></Field>
          )}
          <Field label="Fazla Mesai Katsayısı" hint="Genelde 1,5"><Input inputMode="decimal" value={f.overtimeMultiplier} onChange={(e) => set('overtimeMultiplier', e.target.value)} /></Field>
          <label className="col-span-2 flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={f.isActive} onChange={(e) => set('isActive', e.target.checked)} />
            Aktif çalışan <span className="text-[12px] text-[var(--text-muted)]">(pasif çalışanlar bordro hesabına girmez)</span>
          </label>
        </FormGrid>
        <button type="submit" hidden />
      </form>
      <FormError message={error} />
    </Modal>
  )
}
