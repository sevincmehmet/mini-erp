import { useEffect, useState } from 'react'
import { Button, Segmented } from '../../components/ui/Glass'
import { Modal } from '../../components/ui/Modal'
import { Field, FormError, FormGrid, Input, toNumber } from '../../components/ui/Form'
import { errorMessage, send } from '../../lib/apiClient'
import { isoDate } from '../../lib/format'
import type { Category, Transaction, TransactionType } from '../../lib/types'
import { toast } from '../../stores/useToastStore'
import { AttachmentsPanel } from '../../components/data/Attachments'

interface Props {
  open: boolean
  transaction: Transaction | null
  categories: Category[]
  defaultType?: TransactionType
  onClose: () => void
  onSaved: () => void
}

export function TransactionForm({ open, transaction, categories, defaultType = 'Expense', onClose, onSaved }: Props) {
  const [type, setType] = useState<TransactionType>(defaultType)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(isoDate(new Date()))
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [documentNo, setDocumentNo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setType(transaction?.type ?? defaultType)
    setAmount(transaction ? String(transaction.amount).replace('.', ',') : '')
    setDate(transaction?.date ?? isoDate(new Date()))
    setDescription(transaction?.description ?? '')
    setCategory(transaction?.category ?? '')
    setDocumentNo(transaction?.documentNo ?? '')
  }, [open, transaction, defaultType])

  const options = categories.filter((c) => c.type === type)

  const save = async () => {
    setBusy(true)
    setError(null)
    // Listede olan kategori Id ile, yeni yazılan kategori adıyla gönderilir (sunucu oluşturur)
    const match = options.find((c) => c.name.toLocaleLowerCase('tr') === category.trim().toLocaleLowerCase('tr'))
    const body = {
      type, amount: toNumber(amount), date, description, documentNo: documentNo || null,
      categoryId: match?.id ?? null, categoryName: match ? null : category.trim() || null,
    }
    try {
      if (transaction) await send('PUT', `/api/finance/transactions/${transaction.id}`, body)
      else await send('POST', '/api/finance/transactions', body)
      toast.success(transaction ? 'Kayıt güncellendi.' : 'Kayıt eklendi.')
      onSaved()
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={transaction ? 'Hareketi Düzenle' : 'Yeni Gelir / Gider'}
      footer={<><Button variant="secondary" onClick={onClose}>Vazgeç</Button><Button onClick={save} disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); void save() }}>
        <div className="mb-3">
          <Segmented value={type} onChange={setType} options={[{ value: 'Income', label: 'Gelir' }, { value: 'Expense', label: 'Gider' }]} />
        </div>
        <FormGrid>
          <Field label="Tutar (₺)" required><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="12.500,00" /></Field>
          <Field label="Tarih" required><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Açıklama" required className="col-span-2"><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <Field label="Kategori" hint="Listede yoksa yazın, yeni kategori açılır">
            <Input list="tx-categories" value={category} onChange={(e) => setCategory(e.target.value)} />
            <datalist id="tx-categories">{options.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          </Field>
          <Field label="Belge / Fatura No"><Input value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} /></Field>
        </FormGrid>
        <button type="submit" hidden />
      </form>
      {transaction && (
        <div className="mt-4 border-t border-[var(--row-border)] pt-3">
          <p className="mb-2 text-[12px] font-medium text-[var(--text-muted)]">Ekler</p>
          <AttachmentsPanel entityType="IncomeExpense" entityId={transaction.id} />
        </div>
      )}
      <FormError message={error} />
    </Modal>
  )
}
