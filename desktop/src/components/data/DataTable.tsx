import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CellValue, ColumnType } from '../../types/electron'
import { useViewStore, type TableView } from '../../stores/useViewStore'
import { toast } from '../../stores/useToastStore'
import { Button, cx } from '../ui/Glass'
import { Icon, type IconName } from '../ui/Icons'
import { Tooltip } from '../ui/Tooltip'

export interface Column<T> {
  key: string
  header: string
  /** Hücrede gösterilecek içerik. */
  render: (row: T) => ReactNode
  /** Sıralama ve Excel'e aktarım için ham değer. */
  value: (row: T) => CellValue
  type?: ColumnType
  align?: 'right'
  /** Alt satırda toplamı gösterilir. */
  total?: boolean
  defaultHidden?: boolean
  className?: string
}

interface DataTableProps<T> {
  /** Görünüm tercihlerinin saklandığı anahtar (ör. "employees"). */
  tableId: string
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  /** Satır sonundaki işlem düğmeleri (düzenle, sil…). */
  actions?: (row: T) => ReactNode
  onRowDoubleClick?: (row: T) => void
  /** Excel'e aktarılan dosyanın adı. */
  exportName: string
  formatTotal?: (key: string, total: number) => ReactNode
  empty?: ReactNode
  /** Varsayılan sayfa boyutu (kullanıcı seçimi kayıtlıysa o kullanılır). */
  pageSize?: number
}

const PAGE_SIZES = [10, 15, 25, 50, 100]

function resolveView<T>(columns: Column<T>[], saved: TableView | undefined) {
  const keys = columns.map((c) => c.key)
  // Kayıtlı sırayı koru, sonradan eklenen sütunları sona ekle
  const order = [...(saved?.order ?? []).filter((k) => keys.includes(k)), ...keys.filter((k) => !saved?.order?.includes(k))]
  const hidden = saved ? saved.hidden.filter((k) => keys.includes(k)) : columns.filter((c) => c.defaultHidden).map((c) => c.key)
  return { order, hidden, sort: saved?.sort, pageSize: saved?.pageSize }
}

export function DataTable<T>({ tableId, columns, rows, rowKey, actions, onRowDoubleClick, exportName, formatTotal, empty, pageSize: defaultPageSize = 15 }: DataTableProps<T>) {
  const saved = useViewStore((s) => s.tables[tableId])
  const setTable = useViewStore((s) => s.setTable)
  const resetTable = useViewStore((s) => s.resetTable)
  const view = useMemo(() => resolveView(columns, saved), [columns, saved])
  const [chooserOpen, setChooserOpen] = useState(false)
  const dragKey = useRef<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const byKey = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns])
  const visible = view.order.filter((k) => !view.hidden.includes(k)).map((k) => byKey.get(k)!).filter(Boolean)

  const save = (patch: Partial<TableView>) => setTable(tableId, { order: view.order, hidden: view.hidden, sort: view.sort, pageSize: view.pageSize, ...patch })

  const sorted = useMemo(() => {
    if (!view.sort) return rows
    const col = byKey.get(view.sort.key)
    if (!col) return rows
    const dir = view.sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = col.value(a)
      const vb = col.value(b)
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return String(va).localeCompare(String(vb), 'tr', { numeric: true }) * dir
    })
  }, [rows, view.sort, byKey])

  // ---------- sayfalama: yalnızca görünen sayfa çizilir; toplam ve Excel'e aktarım tüm kayıtları kapsar
  const pageSize = view.pageSize ?? defaultPageSize
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const [page, setPage] = useState(0)
  // Filtre/arama değişince (satır sayısı değişir) ya da sıralama değişince ilk sayfaya dön
  useEffect(() => setPage(0), [rows.length, view.sort?.key, view.sort?.dir, pageSize])
  const current = Math.min(page, pageCount - 1)
  const pageRows = sorted.slice(current * pageSize, current * pageSize + pageSize)

  const toggleSort = (key: string) => {
    const cur = view.sort
    save({ sort: cur?.key !== key ? { key, dir: 'asc' } : cur.dir === 'asc' ? { key, dir: 'desc' } : undefined })
  }

  const move = (from: string, to: string) => {
    if (from === to) return
    const order = view.order.filter((k) => k !== from)
    order.splice(order.indexOf(to), 0, from)
    save({ order })
  }

  const toggleHidden = (key: string) => {
    const hidden = view.hidden.includes(key) ? view.hidden.filter((k) => k !== key) : [...view.hidden, key]
    if (hidden.length >= columns.length) return // en az bir sütun kalsın
    save({ hidden })
  }

  const exportExcel = async () => {
    const bridge = window.api
    if (!bridge) return toast.error("Excel'e aktarım yalnızca masaüstü uygulamasında kullanılabilir.")
    const result = await bridge.excel.exportTable({
      fileName: exportName,
      sheetName: exportName,
      columns: visible.map((c) => ({ header: c.header, type: c.type, total: c.total })),
      rows: sorted.map((r) => visible.map((c) => c.value(r))),
    })
    if (!result.ok) toast.error(result.error)
    else if (!result.canceled) toast.success(`Kaydedildi: ${result.filePath}`)
  }

  const totals = visible.some((c) => c.total)
    ? Object.fromEntries(visible.filter((c) => c.total).map((c) => [c.key, sorted.reduce((s, r) => s + (Number(c.value(r)) || 0), 0)]))
    : null

  // Sütun sürükle-bırak: hem başlıklarda hem sütun seçici listesinde aynı mantık
  const dragProps = (key: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { dragKey.current = key; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/x-column', key) },
    onDragOver: (e: React.DragEvent) => { if (dragKey.current) { e.preventDefault(); setDropTarget(key) } },
    onDragLeave: () => setDropTarget((t) => (t === key ? null : t)),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); if (dragKey.current) move(dragKey.current, key); dragKey.current = null; setDropTarget(null) },
    onDragEnd: () => { dragKey.current = null; setDropTarget(null) },
  })

  return (
    <div>
      <div className="relative flex items-center justify-end gap-1.5 px-1 pb-2">
        <span className="mr-auto min-w-0 truncate pl-2 text-[12px] text-[var(--text-muted)]" title="Başlıkları sürükleyerek sıralayabilir, tıklayarak sıralama yönünü değiştirebilirsiniz">{rows.length} kayıt · başlıkları sürükleyerek sıralayabilirsiniz</span>
        <Button variant="ghost" icon="download" className="!h-7 !px-2 text-[12.5px]" onClick={exportExcel} title="Görünen sütunlarla Excel'e kaydet">Excel</Button>
        <Button variant="ghost" icon="columns" className="!h-7 !px-2 text-[12.5px]" onClick={() => setChooserOpen((o) => !o)} aria-expanded={chooserOpen}>Sütunlar</Button>

        {chooserOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setChooserOpen(false)} />
            <div className="animate-pop absolute right-1 top-9 z-30 w-64 rounded-[14px] border border-[var(--glass-border)] bg-[var(--modal-bg)] p-2 shadow-[var(--shadow-pop)] backdrop-blur-2xl">
              <p className="px-2 pb-1.5 pt-1 text-[11px] text-[var(--text-muted)]">Göstermek istediklerinizi seçin, sürükleyerek sıralayın</p>
              <ul>
                {view.order.map((k) => {
                  const c = byKey.get(k)!
                  return (
                    <li key={k} {...dragProps(k)}
                      className={cx('flex cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-[var(--hover)]', dropTarget === k && 'ring-2 ring-[var(--accent)]/50')}>
                      <Icon name="grip" size={13} className="text-[var(--text-faint)]" />
                      <input type="checkbox" checked={!view.hidden.includes(k)} onChange={() => toggleHidden(k)} aria-label={`${c.header} sütununu göster`} />
                      <span className="flex-1">{c.header}</span>
                    </li>
                  )
                })}
              </ul>
              <button onClick={() => { resetTable(tableId); setChooserOpen(false) }} className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-[12px] text-[var(--accent)] hover:bg-[var(--hover)]">
                Varsayılan görünüme dön
              </button>
            </div>
          </>
        )}
      </div>

      {rows.length === 0 ? (
        empty ?? <p className="py-12 text-center text-[13px] text-[var(--text-muted)]">Kayıt yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {visible.map((c) => (
                  <th key={c.key} {...dragProps(c.key)} onClick={() => toggleSort(c.key)}
                    className={cx(
                      'cursor-pointer select-none whitespace-nowrap border-b border-[var(--glass-border)] px-3 py-2 text-left text-[11.5px] font-medium text-[var(--text-muted)] hover:text-[var(--text)]',
                      c.align === 'right' && 'text-right',
                      dropTarget === c.key && 'bg-[var(--today-bg)]',
                    )}>
                    {c.header}
                    {view.sort?.key === c.key && <Icon name={view.sort.dir === 'asc' ? 'chevronDown' : 'chevronDown'} size={12} strokeWidth={2.2} className={cx('ml-1 inline -mt-px text-[var(--accent)]', view.sort.dir === 'asc' && 'rotate-180')} />}
                  </th>
                ))}
                {actions && <th className="w-px border-b border-[var(--glass-border)]" />}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={rowKey(r)} className="group transition-colors hover:bg-[var(--hover)]" onDoubleClick={() => onRowDoubleClick?.(r)}>
                  {visible.map((c, ci) => (
                    <td key={c.key} className={cx('border-b border-[var(--row-border)] px-3 py-2.5', c.align === 'right' && 'whitespace-nowrap text-right tabular-nums', ci === 0 && 'whitespace-nowrap', c.className)}>
                      {c.render(r)}
                    </td>
                  ))}
                  {actions && (
                    <td className="whitespace-nowrap border-b border-[var(--row-border)] px-2 text-right">
                      <div className="flex justify-end gap-0.5 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">{actions(r)}</div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {totals && (
              <tfoot>
                <tr className="font-semibold">
                  {visible.map((c, i) => (
                    <td key={c.key} className={cx('px-3 py-2.5', c.align === 'right' && 'text-right tabular-nums')}>
                      {c.total ? (formatTotal ? formatTotal(c.key, totals[c.key]) : totals[c.key]) : i === 0 ? (pageCount > 1 ? 'Toplam (tüm kayıtlar)' : 'Toplam') : null}
                    </td>
                  ))}
                  {actions && <td />}
                </tr>
              </tfoot>
            )}
          </table>
          {sorted.length > PAGE_SIZES[0] && (
            <Pagination page={current} pageCount={pageCount} pageSize={pageSize} total={sorted.length}
              onPage={setPage} onPageSize={(n) => save({ pageSize: n })} />
          )}
        </div>
      )}
    </div>
  )
}

/** Sayfa numaraları: 1 … 4 5 [6] 7 8 … 16 */
function pageWindow(current: number, count: number): (number | '…')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i)
  const out: (number | '…')[] = [0]
  const from = Math.max(1, Math.min(current - 2, count - 6))
  const to = Math.min(count - 2, Math.max(current + 2, 5))
  if (from > 1) out.push('…')
  for (let i = from; i <= to; i++) out.push(i)
  if (to < count - 2) out.push('…')
  out.push(count - 1)
  return out
}

function Pagination({ page, pageCount, pageSize, total, onPage, onPageSize }: {
  page: number; pageCount: number; pageSize: number; total: number; onPage: (p: number) => void; onPageSize: (n: number) => void
}) {
  const from = page * pageSize + 1
  const to = Math.min(total, from + pageSize - 1)
  const btn = 'grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-[12px] tabular-nums transition disabled:cursor-not-allowed disabled:opacity-30'
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-2 pb-1 pt-3 text-[12px] text-[var(--text-muted)]">
      <span className="tabular-nums">{from.toLocaleString('tr-TR')}–{to.toLocaleString('tr-TR')} / {total.toLocaleString('tr-TR')}</span>
      <label className="flex items-center gap-1.5">
        Sayfa başına
        <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}
          className="h-7 rounded-md border border-[var(--glass-border)] bg-[var(--input-bg)] px-1.5 text-[12px] text-[var(--text)]">
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      {pageCount > 1 && (
        <nav aria-label="Sayfalar" className="ml-auto flex items-center gap-0.5">
          <button className={cx(btn, 'hover:bg-[var(--hover)]')} onClick={() => onPage(page - 1)} disabled={page === 0} aria-label="Önceki sayfa"><Icon name="chevronLeft" size={14} /></button>
          {pageWindow(page, pageCount).map((p, i) => p === '…'
            ? <span key={`e${i}`} className="px-1">…</span>
            : (
              <button key={p} onClick={() => onPage(p)} aria-current={p === page ? 'page' : undefined}
                className={cx(btn, p === page ? 'bg-[var(--accent)] font-semibold text-white' : 'text-[var(--text)] hover:bg-[var(--hover)]')}>
                {p + 1}
              </button>
            ))}
          <button className={cx(btn, 'hover:bg-[var(--hover)]')} onClick={() => onPage(page + 1)} disabled={page >= pageCount - 1} aria-label="Sonraki sayfa"><Icon name="chevronRight" size={14} /></button>
        </nav>
      )}
    </div>
  )
}

/** Satır işlem düğmesi (düzenle/sil gibi). Satırın üzerine gelince görünür. */
export function RowAction({ label, onClick, danger, disabled, icon }: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean; icon: IconName }) {
  return (
    <Tooltip content={label}>
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      disabled={disabled}
      aria-label={label}
      className={cx('grid size-7 place-items-center rounded-[8px] transition disabled:cursor-not-allowed disabled:opacity-30',
        danger ? 'text-[var(--text-muted)] hover:bg-[var(--critical-bg)] hover:text-[var(--danger)]' : 'text-[var(--text-muted)] hover:bg-[var(--hover-strong)] hover:text-[var(--text)]')}
    >
      <Icon name={icon} size={15} />
    </button>
    </Tooltip>
  )
}
