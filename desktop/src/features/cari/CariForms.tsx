import { useEffect, useState } from 'react'
import { Button, Segmented } from '../../components/ui/Glass'
import { Modal } from '../../components/ui/Modal'
import { Field, FormError, FormGrid, Input, Select, TextArea, toNumber } from '../../components/ui/Form'
import { DataTable, type Column } from '../../components/data/DataTable'
import { errorMessage, send } from '../../lib/apiClient'
import { addDays, isoDate, money, moneyExact, parseDate, shortDate } from '../../lib/format'
import { useApi } from '../../lib/useApi'
import { toast } from '../../stores/useToastStore'

export type PartyType = 'Customer' | 'Supplier' | 'Both'
export type DocType = 'Receivable' | 'Payable'

export interface Party {
  id: string; name: string; type: PartyType; taxNumber: string | null; phone: string | null; email: string | null; note: string | null; defaultTermDays: number
  receivableOpen: number; payableOpen: number; overdue: number; openDocuments: number
}

export interface CariDoc {
  id: string; partyId: string; partyName: string; type: DocType; documentNo: string | null; date: string; dueDate: string
  amount: number; paid: number; remaining: number; status: 'open' | 'partial' | 'due-soon' | 'overdue' | 'paid'; daysToDue: number; description: string | null
}

export const PARTY_TYPE: Record<PartyType, string> = { Customer: 'Müşteri', Supplier: 'Tedarikçi', Both: 'Müşteri ve tedarikçi' }

function useSubmit(onDone: () => void) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true); setError(null)
    try { await fn(); toast.success(message); onDone() } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  return { error, busy, run, setError }
}

// ---------------------------------------------------------------- cari
export function PartyForm({ open, party, onClose, onSaved }: { open: boolean; party: Party | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: '', type: 'Customer' as PartyType, taxNumber: '', phone: '', email: '', note: '', defaultTermDays: '30' })
  const { error, busy, run, setError } = useSubmit(() => { onSaved(); onClose() })
  useEffect(() => {
    if (!open) return
    setError(null)
    setF(party ? { name: party.name, type: party.type, taxNumber: party.taxNumber ?? '', phone: party.phone ?? '', email: party.email ?? '', note: party.note ?? '', defaultTermDays: String(party.defaultTermDays) }
      : { name: '', type: 'Customer', taxNumber: '', phone: '', email: '', note: '', defaultTermDays: '30' })
  }, [open, party, setError])
  const body = { ...f, defaultTermDays: Number(f.defaultTermDays) || 0 }
  return (
    <Modal open={open} onClose={onClose} title={party ? party.name : 'Yeni Cari'}
      footer={<><Button variant="secondary" onClick={onClose}>Vazgeç</Button><Button disabled={busy} onClick={() => run(() => (party ? send('PUT', `/api/cari/parties/${party.id}`, body) : send('POST', '/api/cari/parties', body)), 'Cari kaydedildi.')}>Kaydet</Button></>}>
      <div className="mb-3"><Segmented value={f.type} onChange={(type) => setF({ ...f, type })} options={(Object.keys(PARTY_TYPE) as PartyType[]).map((t) => ({ value: t, label: PARTY_TYPE[t] }))} /></div>
      <FormGrid>
        <Field label="Ünvan / ad" required className="col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Vergi no"><Input value={f.taxNumber} onChange={(e) => setF({ ...f, taxNumber: e.target.value })} /></Field>
        <Field label="Varsayılan vade (gün)" hint="Yeni belgelerde vade tarihi buna göre önerilir"><Input inputMode="numeric" value={f.defaultTermDays} onChange={(e) => setF({ ...f, defaultTermDays: e.target.value })} /></Field>
        <Field label="Telefon"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="E-posta"><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Not" className="col-span-2"><TextArea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </FormGrid>
      <FormError message={error} />
    </Modal>
  )
}

// ---------------------------------------------------------------- belge
export function DocumentForm({ open, doc, parties, defaultType, onClose, onSaved }: { open: boolean; doc: CariDoc | null; parties: Party[]; defaultType: DocType; onClose: () => void; onSaved: () => void }) {
  const today = isoDate(new Date())
  const [f, setF] = useState({ partyId: '', type: defaultType, documentNo: '', date: today, dueDate: today, amount: '', description: '' })
  const { error, busy, run, setError } = useSubmit(() => { onSaved(); onClose() })
  useEffect(() => {
    if (!open) return
    setError(null)
    const first = parties.find((p) => (defaultType === 'Receivable' ? p.type !== 'Supplier' : p.type !== 'Customer')) ?? parties[0]
    setF(doc ? { partyId: doc.partyId, type: doc.type, documentNo: doc.documentNo ?? '', date: doc.date, dueDate: doc.dueDate, amount: String(doc.amount).replace('.', ','), description: doc.description ?? '' }
      : { partyId: first?.id ?? '', type: defaultType, documentNo: '', date: today, dueDate: isoDate(addDays(new Date(), first?.defaultTermDays ?? 30)), amount: '', description: '' })
  }, [open, doc, parties, defaultType, today, setError])
  // Cari ya da tarih değişince vade, carinin varsayılan vadesine göre önerilir
  const setParty = (partyId: string) => {
    const p = parties.find((x) => x.id === partyId)
    setF({ ...f, partyId, dueDate: isoDate(addDays(parseDate(f.date), p?.defaultTermDays ?? 30)) })
  }
  const body = { ...f, amount: toNumber(f.amount) }
  return (
    <Modal open={open} onClose={onClose} title={doc ? `Belge · ${doc.documentNo ?? doc.partyName}` : 'Yeni Vadeli Belge'}
      footer={<><Button variant="secondary" onClick={onClose}>Vazgeç</Button><Button disabled={busy || !f.partyId} onClick={() => run(() => (doc ? send('PUT', `/api/cari/documents/${doc.id}`, body) : send('POST', '/api/cari/documents', body)), 'Belge kaydedildi.')}>Kaydet</Button></>}>
      {parties.length === 0 ? <p className="text-[13px] text-[var(--text-muted)]">Önce "Cariler" sekmesinden bir müşteri ya da tedarikçi ekleyin.</p> : (
        <>
          <div className="mb-3"><Segmented value={f.type} onChange={(type) => setF({ ...f, type })} options={[{ value: 'Receivable', label: 'Satış faturası (alacak)' }, { value: 'Payable', label: 'Alış faturası (borç)' }]} /></div>
          <FormGrid>
            <Field label="Cari" required className="col-span-2">
              <Select value={f.partyId} onChange={(e) => setParty(e.target.value)}>{parties.map((p) => <option key={p.id} value={p.id}>{p.name} · {PARTY_TYPE[p.type]}</option>)}</Select>
            </Field>
            <Field label="Belge / fatura no"><Input value={f.documentNo} onChange={(e) => setF({ ...f, documentNo: e.target.value })} /></Field>
            <Field label="Tutar (₺)" required><Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="45.000,00" /></Field>
            <Field label="Belge tarihi" required><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Vade tarihi" required><Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
            <Field label="Açıklama" className="col-span-2"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          </FormGrid>
        </>
      )}
      <FormError message={error} />
    </Modal>
  )
}

// ---------------------------------------------------------------- tahsilat / ödeme
export function PaymentDialog({ doc, onClose, onSaved }: { doc: CariDoc | null; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(isoDate(new Date()))
  const [method, setMethod] = useState('Havale/EFT')
  const payments = useApi<{ id: string; date: string; amount: number; method: string | null }[]>(doc ? `/api/cari/documents/${doc.id}/payments` : null)
  const { error, busy, run, setError } = useSubmit(() => { onSaved(); onClose() })
  useEffect(() => { if (doc) { setAmount(String(doc.remaining).replace('.', ',')); setDate(isoDate(new Date())); setError(null) } }, [doc, setError])
  if (!doc) return null
  const income = doc.type === 'Receivable'
  return (
    <Modal open={!!doc} onClose={onClose} title={`${income ? 'Tahsilat' : 'Ödeme'} · ${doc.partyName}`} width="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Vazgeç</Button><Button disabled={busy || doc.remaining <= 0} icon="wallet" onClick={() => run(() => send('POST', `/api/cari/documents/${doc.id}/payments`, { date, amount: toNumber(amount), method }), income ? 'Tahsilat kaydedildi.' : 'Ödeme kaydedildi.')}>Kaydet</Button></>}>
      <div className="mb-4 grid grid-cols-3 gap-2 rounded-[12px] bg-[var(--hover)] p-3 text-[12px]">
        <div><p className="text-[var(--text-muted)]">Belge tutarı</p><p className="font-semibold tabular-nums">{money(doc.amount)}</p></div>
        <div><p className="text-[var(--text-muted)]">Ödenen</p><p className="font-semibold tabular-nums">{money(doc.paid)}</p></div>
        <div><p className="text-[var(--text-muted)]">Kalan</p><p className="font-semibold tabular-nums">{money(doc.remaining)}</p></div>
      </div>
      <FormGrid>
        <Field label="Tutar (₺)" required><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Tarih" required><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Yöntem" className="col-span-2">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>{['Havale/EFT', 'Nakit', 'Kredi kartı', 'Çek', 'Senet', 'Mahsup'].map((m) => <option key={m}>{m}</option>)}</Select>
        </Field>
      </FormGrid>
      <p className="mt-3 text-[11.5px] text-[var(--text-muted)]">Kayıt, Gelir ve Gider'e de "{income ? 'Tahsilatlar' : 'Tedarikçi Ödemeleri'}" kategorisiyle otomatik yazılır.</p>
      {(payments.data?.length ?? 0) > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11.5px] font-semibold text-[var(--text-muted)]">Önceki {income ? 'tahsilatlar' : 'ödemeler'}</p>
          <ul className="space-y-1 text-[12.5px]">
            {payments.data!.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-[8px] bg-[var(--hover)] px-2.5 py-1.5">
                <span className="tabular-nums">{shortDate(p.date)}</span><span className="text-[var(--text-muted)]">{p.method}</span>
                <span className="ml-auto font-medium tabular-nums">{moneyExact(p.amount)}</span>
                <button aria-label="Ödemeyi sil" onClick={() => run(() => send('DELETE', `/api/cari/payments/${p.id}`), 'Ödeme silindi.')} className="text-[var(--text-muted)] hover:text-[var(--danger)]">✕</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <FormError message={error} />
    </Modal>
  )
}

// ---------------------------------------------------------------- ekstre
interface Line { date: string; kind: string; documentNo: string | null; description: string | null; debit: number; credit: number; balance: number }

export function StatementDialog({ party, onClose }: { party: Party | null; onClose: () => void }) {
  const { data } = useApi<Line[]>(party ? `/api/cari/parties/${party.id}/statement` : null)
  const rows = data ?? []
  const cols: Column<Line>[] = [
    { key: 'date', header: 'Tarih', type: 'date', value: (l) => l.date, render: (l) => shortDate(l.date) },
    { key: 'kind', header: 'İşlem', value: (l) => l.kind, render: (l) => l.kind },
    { key: 'doc', header: 'Belge No', value: (l) => l.documentNo, render: (l) => <span className="tabular-nums text-[var(--text-muted)]">{l.documentNo}</span> },
    { key: 'desc', header: 'Açıklama', value: (l) => l.description, render: (l) => <span className="text-[var(--text-muted)]">{l.description}</span> },
    { key: 'debit', header: 'Borç', align: 'right', type: 'money', total: true, value: (l) => l.debit, render: (l) => (l.debit ? moneyExact(l.debit) : '') },
    { key: 'credit', header: 'Alacak', align: 'right', type: 'money', total: true, value: (l) => l.credit, render: (l) => (l.credit ? moneyExact(l.credit) : '') },
    { key: 'balance', header: 'Bakiye', align: 'right', type: 'money', value: (l) => l.balance, render: (l) => <b className="tabular-nums">{moneyExact(l.balance)}</b> },
  ]
  const keys = new Map(rows.map((r, i) => [r, String(i)]))
  return (
    <Modal open={!!party} onClose={onClose} title={`Hesap Ekstresi · ${party?.name ?? ''}`} width="xl" footer={<Button onClick={onClose}>Kapat</Button>}>
      <p className="mb-3 text-[12.5px] text-[var(--text-muted)]">Pozitif bakiye: cari size borçlu (alacağınız). Negatif bakiye: siz cariye borçlusunuz.</p>
      <DataTable tableId="cari-statement" exportName={`Ekstre ${party?.name ?? ''}`} columns={cols} rows={rows} rowKey={(r) => keys.get(r) ?? ''} formatTotal={(_k, t) => moneyExact(t)} />
    </Modal>
  )
}
