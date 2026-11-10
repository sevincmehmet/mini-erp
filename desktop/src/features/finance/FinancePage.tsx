import { useMemo, useState } from 'react'
import { DataTable, RowAction, type Column } from '../../components/data/DataTable'
import { EmptyHint } from '../../components/data/EmptyHint'
import { Badge, Button, GlassCard, LoadState, PageHeader, Pager, SearchField, Segmented, StatTile } from '../../components/ui/Glass'
import { ConfirmDialog } from '../../components/ui/Modal'
import { errorMessage, send } from '../../lib/apiClient'
import { isoDate, money, moneyExact, MONTHS, shortDate } from '../../lib/format'
import type { Category, Transaction } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { toast } from '../../stores/useToastStore'
import { ImportDialog } from '../import/ImportDialog'
import { DropOverlay, useFileDrop } from '../import/useFileDrop'
import { TransactionForm } from './TransactionForm'
import { AttachmentsDialog } from '../../components/data/Attachments'

type Filter = 'all' | 'Income' | 'Expense'

const COLUMNS: Column<Transaction>[] = [
  { key: 'date', header: 'Tarih', type: 'date', value: (t) => t.date, render: (t) => <span className="whitespace-nowrap tabular-nums">{shortDate(t.date)}</span> },
  { key: 'description', header: 'Açıklama', value: (t) => t.description, render: (t) => <>{t.description}{t.isPayroll && <span className="ml-2"><Badge tone="info">Bordro</Badge></span>}</> },
  { key: 'category', header: 'Kategori', value: (t) => t.category, render: (t) => <span className="text-[var(--text-muted)]">{t.category}</span> },
  { key: 'documentNo', header: 'Belge No', value: (t) => t.documentNo, render: (t) => <span className="tabular-nums text-[var(--text-muted)]">{t.documentNo}</span> },
  {
    key: 'type', header: 'Tür', value: (t) => (t.type === 'Income' ? 'Gelir' : 'Gider'),
    render: (t) => (
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ background: t.type === 'Income' ? 'var(--series-income)' : 'var(--series-expense)' }} />
        {t.type === 'Income' ? 'Gelir' : 'Gider'}
      </span>
    ),
  },
  {
    key: 'amount', header: 'Tutar', align: 'right', type: 'money', total: true,
    value: (t) => (t.type === 'Income' ? t.amount : -t.amount),
    render: (t) => <span className="font-medium">{t.type === 'Income' ? '+' : '−'}{moneyExact(t.amount)}</span>,
  },
]

export function FinancePage() {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 1, 1) })
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Transaction | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<Transaction | null>(null)
  const [busy, setBusy] = useState(false)
  const [attach, setAttach] = useState<{ entityType: string; entityId: string; title: string } | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)

  const from = isoDate(month)
  const to = isoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0))
  const { data, loading, error, reload } = useApi<Transaction[]>(`/api/finance/transactions?from=${from}&to=${to}`)
  const categories = useApi<Category[]>('/api/finance/categories')

  const dragging = useFileDrop((file) => { setDroppedFile(file); setImportOpen(true) }, !importOpen && editing === undefined)

  const income = (data ?? []).filter((t) => t.type === 'Income').reduce((s, t) => s + t.amount, 0)
  const expense = (data ?? []).filter((t) => t.type === 'Expense').reduce((s, t) => s + t.amount, 0)

  const rows = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('tr')
    return (data ?? []).filter((t) =>
      (filter === 'all' || t.type === filter) &&
      (!term || `${t.description} ${t.category ?? ''} ${t.documentNo ?? ''}`.toLocaleLowerCase('tr').includes(term)))
  }, [data, filter, q])

  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))
  const refresh = () => { reload(); categories.reload() }

  const remove = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await send('DELETE', `/api/finance/transactions/${deleting.id}`)
      toast.success('Kayıt silindi.')
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
        title="Gelir ve Gider"
        subtitle="Aylık finansal hareketler"
        actions={<>
          <Button variant="secondary" icon="upload" onClick={() => { setDroppedFile(null); setImportOpen(true) }}>Excel'den Aktar</Button>
          <Button icon="plus" onClick={() => setEditing(null)}>Yeni Kayıt</Button>
        </>}
        toolbar={<>
          <Pager label={`${MONTHS[month.getMonth()]} ${month.getFullYear()}`} onPrev={() => shift(-1)} onNext={() => shift(1)} />
          <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Tümü' }, { value: 'Income', label: 'Gelir' }, { value: 'Expense', label: 'Gider' }]} />
          <div className="ml-auto"><SearchField value={q} onChange={setQ} placeholder="Açıklama, kategori, belge no" /></div>
        </>}
      />

      <div className="mb-3 grid grid-cols-3 gap-3">
        <StatTile icon="arrowDownCircle" tone="income" label="Toplam Gelir" value={money(income)} hint={`${(data ?? []).filter((t) => t.type === 'Income').length} hareket`} />
        <StatTile icon="arrowUpCircle" tone="expense" label="Toplam Gider" value={money(expense)} hint={`${(data ?? []).filter((t) => t.type === 'Expense').length} hareket`} />
        <StatTile icon="scale" tone={income - expense >= 0 ? 'good' : 'warning'} label="Net" value={money(income - expense)} hint={income - expense >= 0 ? 'Bu ay kâr' : 'Bu ay zarar'} />
      </div>


      <GlassCard className="p-2">
        {!data ? <LoadState loading={loading} error={error} /> : (
          <DataTable
            tableId="transactions"
            exportName={`Gelir-Gider ${MONTHS[month.getMonth()]} ${month.getFullYear()}`}
            columns={COLUMNS}
            rows={rows}
            rowKey={(t) => t.id}
            formatTotal={(_k, total) => (total >= 0 ? '+' : '−') + moneyExact(Math.abs(total))}
            onRowDoubleClick={(t) => !t.isPayroll && setEditing(t)}
            actions={(t) => <>
              <RowAction icon="paperclip" label="Ekler (fatura, fiş)" onClick={() => setAttach({ entityType: 'IncomeExpense', entityId: t.id, title: t.description })} />
              <RowAction label={t.isPayroll ? 'Maaş ödemeleri bordro ekranından yönetilir' : 'Düzenle'} disabled={t.isPayroll} onClick={() => setEditing(t)} icon="edit" />
              <RowAction label="Sil" danger disabled={t.isPayroll} onClick={() => setDeleting(t)} icon="trash" />
            </>}
            empty={<EmptyHint onAdd={() => setEditing(null)} onImport={() => setImportOpen(true)} />}
          />
        )}
      </GlassCard>

      <TransactionForm open={editing !== undefined} transaction={editing ?? null} categories={categories.data ?? []}
        defaultType={filter === 'Income' ? 'Income' : 'Expense'} onClose={() => setEditing(undefined)} onSaved={refresh} />
      <ConfirmDialog open={!!deleting} busy={busy} title="Kaydı sil"
        message={<>"{deleting?.description}" ({deleting && moneyExact(deleting.amount)}) silinecek.</>}
        onConfirm={remove} onClose={() => setDeleting(null)} />
      <AttachmentsDialog target={attach} onClose={() => setAttach(null)} />
      <ImportDialog kind="transactions" open={importOpen} file={droppedFile} onClose={() => { setImportOpen(false); setDroppedFile(null) }} onDone={refresh} />
      <DropOverlay show={dragging} title="Gelir-gider hareketleri" />
    </>
  )
}
