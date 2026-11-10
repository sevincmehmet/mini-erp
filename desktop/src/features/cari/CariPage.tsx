import { useMemo, useState } from 'react'
import { AttachmentsDialog } from '../../components/data/Attachments'
import { DataTable, RowAction, type Column } from '../../components/data/DataTable'
import { EmptyHint } from '../../components/data/EmptyHint'
import { Avatar, Badge, Button, GlassCard, LoadState, PageHeader, SearchField, Segmented, StatTile } from '../../components/ui/Glass'
import { ConfirmDialog } from '../../components/ui/Modal'
import { errorMessage, send } from '../../lib/apiClient'
import { money, moneyExact, shortDate } from '../../lib/format'
import { useApi } from '../../lib/useApi'
import { toast } from '../../stores/useToastStore'
import { ImportDialog } from '../import/ImportDialog'
import { DropOverlay, useFileDrop } from '../import/useFileDrop'
import { DocumentForm, PARTY_TYPE, PartyForm, PaymentDialog, StatementDialog, type CariDoc, type DocType, type Party } from './CariForms'

type Tab = 'docs' | 'parties'
type Filter = 'open' | 'overdue' | 'due-soon' | 'paid' | 'all'

const STATUS: Record<CariDoc['status'], { label: string; tone: 'critical' | 'warning' | 'info' | 'good' | 'neutral' }> = {
  overdue: { label: 'Vadesi geçti', tone: 'critical' },
  'due-soon': { label: 'Yaklaşıyor', tone: 'warning' },
  partial: { label: 'Kısmi ödendi', tone: 'info' },
  open: { label: 'Açık', tone: 'neutral' },
  paid: { label: 'Kapandı', tone: 'good' },
}

export function CariPage() {
  const [tab, setTab] = useState<Tab>('docs')
  const [filter, setFilter] = useState<Filter>('open')
  const [docType, setDocType] = useState<'all' | DocType>('all')
  const [q, setQ] = useState('')
  const parties = useApi<Party[]>('/api/cari/parties')
  const docs = useApi<CariDoc[]>('/api/cari/documents')
  const [partyForm, setPartyForm] = useState<Party | null | undefined>(undefined)
  const [docForm, setDocForm] = useState<CariDoc | null | undefined>(undefined)
  const [paying, setPaying] = useState<CariDoc | null>(null)
  const [statement, setStatement] = useState<Party | null>(null)
  const [attach, setAttach] = useState<{ entityType: string; entityId: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState<{ kind: 'party' | 'doc'; id: string; label: string } | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const dragging = useFileDrop((f) => { setDroppedFile(f); setImportOpen(true) }, !importOpen && docForm === undefined && partyForm === undefined)
  const reload = () => { parties.reload(); docs.reload() }

  const all = docs.data ?? []
  const open = all.filter((d) => d.remaining > 0)
  const sumBy = (list: CariDoc[], t: DocType) => list.filter((d) => d.type === t).reduce((s, d) => s + d.remaining, 0)
  const soonPayable = open.filter((d) => d.type === 'Payable' && d.daysToDue >= 0 && d.daysToDue <= 7)

  const docRows = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('tr')
    return all.filter((d) =>
      (docType === 'all' || d.type === docType) &&
      (filter === 'all' || (filter === 'open' && d.remaining > 0) || (filter === 'paid' && d.remaining <= 0) || d.status === filter) &&
      (!term || `${d.partyName} ${d.documentNo ?? ''} ${d.description ?? ''}`.toLocaleLowerCase('tr').includes(term)))
  }, [all, docType, filter, q])

  const partyRows = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('tr')
    return (parties.data ?? []).filter((p) => !term || `${p.name} ${p.taxNumber ?? ''}`.toLocaleLowerCase('tr').includes(term))
  }, [parties.data, q])

  const docCols: Column<CariDoc>[] = [
    { key: 'due', header: 'Vade', type: 'date', value: (d) => d.dueDate, render: (d) => (
      <span className="whitespace-nowrap tabular-nums">{shortDate(d.dueDate)}
        {d.remaining > 0 && <span className="ml-1.5 text-[11px] text-[var(--text-muted)]">{d.daysToDue < 0 ? `${-d.daysToDue} gün geçti` : d.daysToDue === 0 ? 'bugün' : `${d.daysToDue} gün`}</span>}</span>) },
    { key: 'party', header: 'Cari', value: (d) => d.partyName, render: (d) => <span className="inline-flex items-center gap-2 font-medium"><Avatar name={d.partyName} size={24} />{d.partyName}</span> },
    { key: 'type', header: 'Tür', value: (d) => (d.type === 'Receivable' ? 'Alacak' : 'Borç'), render: (d) => <Badge tone={d.type === 'Receivable' ? 'info' : 'neutral'}>{d.type === 'Receivable' ? 'Alacak' : 'Borç'}</Badge> },
    { key: 'doc', header: 'Belge No', value: (d) => d.documentNo, render: (d) => <span className="whitespace-nowrap tabular-nums text-[var(--text-muted)]">{d.documentNo}</span> },
    { key: 'date', header: 'Belge Tarihi', type: 'date', defaultHidden: true, value: (d) => d.date, render: (d) => shortDate(d.date) },
    { key: 'amount', header: 'Tutar', align: 'right', type: 'money', total: true, value: (d) => d.amount, render: (d) => moneyExact(d.amount) },
    { key: 'paid', header: 'Ödenen', align: 'right', type: 'money', total: true, value: (d) => d.paid, render: (d) => (d.paid ? moneyExact(d.paid) : '—') },
    { key: 'remaining', header: 'Kalan', align: 'right', type: 'money', total: true, value: (d) => d.remaining, render: (d) => <b className="tabular-nums">{d.remaining > 0 ? moneyExact(d.remaining) : '—'}</b> },
    { key: 'status', header: 'Durum', value: (d) => STATUS[d.status].label, render: (d) => <Badge dot tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge> },
  ]
  const partyCols: Column<Party>[] = [
    { key: 'name', header: 'Cari', value: (p) => p.name, render: (p) => <span className="inline-flex items-center gap-2.5 font-medium"><Avatar name={p.name} />{p.name}</span> },
    { key: 'type', header: 'Tür', value: (p) => PARTY_TYPE[p.type], render: (p) => <Badge>{PARTY_TYPE[p.type]}</Badge> },
    { key: 'phone', header: 'Telefon', value: (p) => p.phone, render: (p) => <span className="tabular-nums text-[var(--text-muted)]">{p.phone}</span> },
    { key: 'tax', header: 'Vergi No', defaultHidden: true, value: (p) => p.taxNumber, render: (p) => p.taxNumber },
    { key: 'rec', header: 'Açık alacak', align: 'right', type: 'money', total: true, value: (p) => p.receivableOpen, render: (p) => (p.receivableOpen ? money(p.receivableOpen) : '—') },
    { key: 'pay', header: 'Açık borç', align: 'right', type: 'money', total: true, value: (p) => p.payableOpen, render: (p) => (p.payableOpen ? money(p.payableOpen) : '—') },
    { key: 'over', header: 'Gecikmiş', align: 'right', type: 'money', total: true, value: (p) => p.overdue, render: (p) => (p.overdue ? <span className="font-medium text-[var(--critical-text)]">{money(p.overdue)}</span> : '—') },
    { key: 'docs', header: 'Açık belge', align: 'right', type: 'number', value: (p) => p.openDocuments, render: (p) => p.openDocuments || '—' },
  ]

  const remove = async () => {
    if (!deleting) return
    try {
      await send('DELETE', deleting.kind === 'party' ? `/api/cari/parties/${deleting.id}` : `/api/cari/documents/${deleting.id}`)
      toast.success('Silindi.')
      reload()
    } catch (e) { toast.error(errorMessage(e)) } finally { setDeleting(null) }
  }

  return (
    <>
      <PageHeader title="Cari ve Vade" subtitle="Müşteri alacakları, tedarikçi borçları ve vade takibi"
        actions={<>
          <Button variant="secondary" icon="upload" onClick={() => { setDroppedFile(null); setImportOpen(true) }}>Excel'den Aktar</Button>
          <Button variant="secondary" icon="plus" onClick={() => setPartyForm(null)}>Yeni Cari</Button>
          <Button icon="plus" onClick={() => setDocForm(null)}>Yeni Belge</Button>
        </>}
        toolbar={<>
          <Segmented value={tab} onChange={setTab} options={[{ value: 'docs', label: 'Vadeler' }, { value: 'parties', label: 'Cariler' }]} />
          {tab === 'docs' && <>
            <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: 'open', label: 'Açık' }, { value: 'overdue', label: 'Gecikmiş' }, { value: 'due-soon', label: '7 gün içinde' }, { value: 'paid', label: 'Kapanan' }, { value: 'all', label: 'Tümü' }]} />
            <Segmented size="sm" value={docType} onChange={setDocType} options={[{ value: 'all', label: 'Hepsi' }, { value: 'Receivable', label: 'Alacak' }, { value: 'Payable', label: 'Borç' }]} />
          </>}
          <div className="ml-auto"><SearchField value={q} onChange={setQ} placeholder={tab === 'docs' ? 'Cari, belge no, açıklama' : 'Cari adı, vergi no'} /></div>
        </>} />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="arrowDownCircle" tone="income" label="Açık alacak" value={money(sumBy(open, 'Receivable'))} hint={`${open.filter((d) => d.type === 'Receivable').length} belge`} />
        <StatTile icon="info" tone={sumBy(open.filter((d) => d.status === 'overdue'), 'Receivable') > 0 ? 'warning' : 'good'} label="Vadesi geçmiş alacak"
          value={money(sumBy(open.filter((d) => d.status === 'overdue'), 'Receivable'))} hint="Tahsil edilmeyi bekliyor" onClick={() => { setTab('docs'); setFilter('overdue'); setDocType('Receivable') }} />
        <StatTile icon="arrowUpCircle" tone="expense" label="Açık borç" value={money(sumBy(open, 'Payable'))} hint={`${open.filter((d) => d.type === 'Payable').length} belge`} />
        <StatTile icon="calendar" tone={soonPayable.length ? 'warning' : 'neutral'} label="7 gün içinde ödenecek" value={money(soonPayable.reduce((s, d) => s + d.remaining, 0))}
          hint={`${soonPayable.length} ödeme`} onClick={() => { setTab('docs'); setFilter('due-soon'); setDocType('Payable') }} />
      </div>

      <GlassCard className="p-2">
        {tab === 'docs' ? (!docs.data ? <LoadState loading={docs.loading} error={docs.error} /> : (
          <DataTable tableId="cari-docs" exportName="Vadeler" columns={docCols} rows={docRows} rowKey={(d) => d.id} formatTotal={(_k, t) => moneyExact(t)}
            onRowDoubleClick={(d) => d.remaining > 0 && setPaying(d)}
            actions={(d) => <>
              <RowAction icon="wallet" label={d.type === 'Receivable' ? 'Tahsilat kaydet' : 'Ödeme kaydet'} disabled={d.remaining <= 0} onClick={() => setPaying(d)} />
              <RowAction icon="paperclip" label="Ekler" onClick={() => setAttach({ entityType: 'CariDocument', entityId: d.id, title: d.documentNo ?? d.partyName })} />
              <RowAction icon="edit" label="Düzenle" onClick={() => setDocForm(d)} />
              <RowAction icon="trash" label="Sil" danger disabled={d.paid > 0} onClick={() => setDeleting({ kind: 'doc', id: d.id, label: d.documentNo ?? d.partyName })} />
            </>}
            empty={<EmptyHint icon="handshake" title="Bu filtrede belge yok" onAdd={() => setDocForm(null)} onImport={() => setImportOpen(true)} />} />
        )) : (!parties.data ? <LoadState loading={parties.loading} error={parties.error} /> : (
          <DataTable tableId="cari-parties" exportName="Cariler" columns={partyCols} rows={partyRows} rowKey={(p) => p.id} formatTotal={(_k, t) => money(t)}
            onRowDoubleClick={setStatement}
            actions={(p) => <>
              <RowAction icon="table" label="Hesap ekstresi" onClick={() => setStatement(p)} />
              <RowAction icon="edit" label="Düzenle" onClick={() => setPartyForm(p)} />
              <RowAction icon="trash" label="Sil" danger disabled={p.openDocuments > 0} onClick={() => setDeleting({ kind: 'party', id: p.id, label: p.name })} />
            </>}
            empty={<EmptyHint icon="handshake" title="Henüz cari yok" onAdd={() => setPartyForm(null)} onImport={() => setImportOpen(true)} />} />
        ))}
      </GlassCard>

      <PartyForm open={partyForm !== undefined} party={partyForm ?? null} onClose={() => setPartyForm(undefined)} onSaved={reload} />
      <DocumentForm open={docForm !== undefined} doc={docForm ?? null} parties={parties.data ?? []} defaultType={docType === 'Payable' ? 'Payable' : 'Receivable'} onClose={() => setDocForm(undefined)} onSaved={reload} />
      <PaymentDialog doc={paying} onClose={() => setPaying(null)} onSaved={reload} />
      <StatementDialog party={statement} onClose={() => setStatement(null)} />
      <AttachmentsDialog target={attach} onClose={() => setAttach(null)} />
      <ConfirmDialog open={!!deleting} title="Sil" message={<>"{deleting?.label}" silinecek. Çöp kutusundan geri getirebilirsiniz.</>} onConfirm={remove} onClose={() => setDeleting(null)} />
      <ImportDialog kind="cari-documents" open={importOpen} file={droppedFile} onClose={() => { setImportOpen(false); setDroppedFile(null) }} onDone={reload} />
      <DropOverlay show={dragging} title="Cari belgeler (faturalar)" />
    </>
  )
}
