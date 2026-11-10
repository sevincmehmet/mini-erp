import { useMemo, useState } from 'react'
import { DataTable, RowAction, type Column } from '../../components/data/DataTable'
import { Badge, GlassCard, LoadState, PageHeader, SearchField } from '../../components/ui/Glass'
import { Icon } from '../../components/ui/Icons'
import { ConfirmDialog } from '../../components/ui/Modal'
import { errorMessage, send } from '../../lib/apiClient'
import { useApi } from '../../lib/useApi'
import { roleIn, useAuthStore } from '../../stores/useAuthStore'
import { useCompanyStore } from '../../stores/useCompanyStore'
import { toast } from '../../stores/useToastStore'

interface Item { type: string; typeLabel: string; id: string; label: string; detail: string | null; deletedAt: string | null }

export function TrashPage() {
  const { data, loading, error, reload } = useApi<Item[]>('/api/trash')
  const [q, setQ] = useState('')
  const [purging, setPurging] = useState<Item | null>(null)
  const isOwner = roleIn(useAuthStore((s) => s.user), useCompanyStore((s) => s.activeCompanyId)) === 'Owner'

  const rows = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('tr')
    return (data ?? []).filter((i) => !term || `${i.label} ${i.typeLabel} ${i.detail ?? ''}`.toLocaleLowerCase('tr').includes(term))
  }, [data, q])

  const restore = async (i: Item) => {
    try { await send('POST', '/api/trash/restore', { type: i.type, id: i.id }); toast.success(`"${i.label}" geri getirildi.`); reload() } catch (e) { toast.error(errorMessage(e)) }
  }
  const purge = async () => {
    if (!purging) return
    try { await send('DELETE', `/api/trash/${purging.type}/${purging.id}`); toast.success('Kalıcı olarak silindi.'); reload() } catch (e) { toast.error(errorMessage(e)) } finally { setPurging(null) }
  }

  const cols: Column<Item>[] = [
    { key: 'label', header: 'Kayıt', value: (i) => i.label, render: (i) => <span className="font-medium">{i.label}</span> },
    { key: 'type', header: 'Tür', value: (i) => i.typeLabel, render: (i) => <Badge>{i.typeLabel}</Badge> },
    { key: 'detail', header: 'Ayrıntı', value: (i) => i.detail, render: (i) => <span className="tabular-nums text-[var(--text-muted)]">{i.detail}</span> },
    { key: 'at', header: 'Silinme', value: (i) => i.deletedAt, render: (i) => (i.deletedAt ? new Date(`${i.deletedAt}Z`).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—') },
  ]

  return (
    <>
      <PageHeader title="Çöp Kutusu" subtitle="Silinen kayıtlar burada bekler · geri getirebilir ya da kalıcı olarak silebilirsiniz"
        actions={<SearchField value={q} onChange={setQ} placeholder="Kayıt ara" />} />
      <GlassCard className="p-2">
        {!data ? <LoadState loading={loading} error={error} /> : (
          <DataTable tableId="trash" exportName="Çöp Kutusu" columns={cols} rows={rows} rowKey={(i) => `${i.type}-${i.id}`}
            onRowDoubleClick={restore}
            actions={(i) => <>
              <RowAction icon="undo" label="Geri getir" onClick={() => restore(i)} />
              <RowAction icon="trash" label={isOwner ? 'Kalıcı olarak sil' : 'Kalıcı silme yalnızca şirket sahibine açık'} danger disabled={!isOwner} onClick={() => setPurging(i)} />
            </>}
            empty={
              <div className="flex flex-col items-center py-14 text-center">
                <span className="grid size-12 place-items-center rounded-[14px] bg-[var(--hover-strong)] text-[var(--text-muted)]"><Icon name="trashOpen" size={22} /></span>
                <p className="mt-3 text-[15px] font-semibold">Çöp kutusu boş</p>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">Silinen personel, hareket, sayfa ve belgeler burada görünür.</p>
              </div>
            } />
        )}
      </GlassCard>
      <ConfirmDialog open={!!purging} title="Kalıcı olarak sil" confirmLabel="Kalıcı Olarak Sil"
        message={<>"{purging?.label}" <b>geri getirilemeyecek</b> şekilde silinecek. Değişiklik kaydında izi kalır.</>}
        onConfirm={purge} onClose={() => setPurging(null)} />
    </>
  )
}
