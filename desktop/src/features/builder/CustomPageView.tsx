import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/ui/Icons'
import { Button, GlassCard, LoadState, cx } from '../../components/ui/Glass'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Form'
import { api, errorMessage, send } from '../../lib/apiClient'
import { useNavStore } from '../../stores/useNavStore'
import { toast } from '../../stores/useToastStore'
import { useCompanyStore } from '../../stores/useCompanyStore'
import { DropOverlay, useFileDrop } from '../import/useFileDrop'
import { NavbarPortal } from '../../components/ui/Navbar'
import { useGridSpan } from '../../components/ui/useGridSpan'
import { autoWidgets, PAGE_TEMPLATES } from './autoPage'
import { DatasetUploadDialog } from './DatasetUploadDialog'
import { invalidateSources, sourceName, useDatasetsStore } from './sources'
import { blankWidget, newId, type CustomPage, type Widget } from './types'
import { usePagesStore } from './usePagesStore'
import { WidgetBody } from './WidgetBody'
import { WidgetEditor } from './WidgetEditor'
import { exportPdf } from '../../lib/pdf'

export const PAGE_ICONS = ['📊', '📈', '💰', '🏭', '⚡', '🌱', '📦', '🚚', '👥', '⏱', '🧾', '🗂', '🎯', '🛠', '📋', '⭐']
const SIZES = [{ value: 3, label: '¼' }, { value: 4, label: '⅓' }, { value: 6, label: '½' }, { value: 8, label: '⅔' }, { value: 12, label: 'Tam' }]
const CHART_TYPES = new Set(['bar', 'hbar', 'line', 'donut'])

export function CustomPageView({ pageId }: { pageId: string }) {
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const { intent, clearIntent, go } = useNavStore()
  const refreshPages = usePagesStore((s) => s.refresh)
  const datasets = useDatasetsStore((s) => s.list)

  const [page, setPage] = useState<CustomPage | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState('📊')
  const [editing, setEditing] = useState(false)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty'>('saved')
  const [editor, setEditor] = useState<{ widget: Widget; isNew: boolean } | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [iconPicker, setIconPicker] = useState(false)
  const [asTable, setAsTable] = useState<Set<string>>(new Set())
  const dragId = useRef<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const loaded = useRef(false)
  const grid = useGridSpan<HTMLDivElement>()

  // ---------- yükle
  useEffect(() => {
    loaded.current = false
    setPage(null)
    setLoadError(null)
    api<CustomPage>(`/api/pages/${pageId}`)
      .then((p) => {
        setPage(p)
        setWidgets(p.layout?.widgets ?? [])
        setTitle(p.title)
        setIcon(p.icon ?? '📊')
        setEditing((p.layout?.widgets ?? []).length === 0)
        setSaveState('saved')
        setTimeout(() => (loaded.current = true), 0)
      })
      .catch((e) => setLoadError(errorMessage(e)))
  }, [pageId, companyId])

  // Yeni sayfa "Excel'den başla" ile açıldıysa yükleme penceresini hemen aç
  useEffect(() => { if (page && intent === 'excel') { setUploadOpen(true); clearIntent() } }, [page, intent, clearIntent])

  // ---------- otomatik kaydet (değişiklikten 700 ms sonra)
  useEffect(() => {
    if (!loaded.current || !page) return
    setSaveState('dirty')
    const t = setTimeout(async () => {
      setSaveState('saving')
      try {
        await send('PUT', `/api/pages/${page.id}`, { title: title.trim() || 'Adsız sayfa', icon, layout: { widgets } })
        setSaveState('saved')
        void refreshPages()
      } catch (e) {
        setSaveState('dirty')
        toast.error(`Sayfa kaydedilemedi: ${errorMessage(e)}`)
      }
    }, 700)
    return () => clearTimeout(t)
  }, [widgets, title, icon]) // eslint-disable-line react-hooks/exhaustive-deps

  const dragging = useFileDrop((f) => { setDroppedFile(f); setUploadOpen(true) }, !uploadOpen && !editor)

  const patch = (id: string, p: Partial<Widget>) => setWidgets((ws) => ws.map((w) => (w.id === id ? { ...w, ...p } : w)))
  const remove = (id: string) => setWidgets((ws) => ws.filter((w) => w.id !== id))
  const duplicate = (w: Widget) => setWidgets((ws) => { const i = ws.findIndex((x) => x.id === w.id); const copy = { ...w, id: newId(), title: `${w.title} (kopya)` }; return [...ws.slice(0, i + 1), copy, ...ws.slice(i + 1)] })
  const move = (from: string, to: string) => setWidgets((ws) => {
    if (from === to) return ws
    const item = ws.find((w) => w.id === from)!
    const list = ws.filter((w) => w.id !== from)
    list.splice(list.findIndex((w) => w.id === to), 0, item)
    return list
  })

  const addWidget = () => {
    const last = [...widgets].reverse().find((w) => w.source)
    setEditor({ widget: blankWidget({ source: last?.source, dateColumn: last?.dateColumn }), isNew: true })
  }

  const onEditorSave = (w: Widget) => {
    setWidgets((ws) => (editor?.isNew ? [...ws, w] : ws.map((x) => (x.id === w.id ? w : x))))
    setEditor(null)
  }

  const deletePage = async () => {
    try {
      await send('DELETE', `/api/pages/${pageId}`)
      await refreshPages()
      toast.success('Sayfa silindi.')
      go('dashboard')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const refreshData = useCallback(() => { invalidateSources(); toast.info('Veriler yenilendi.') }, [])

  if (loadError) return <LoadState error={loadError} />
  if (!page) return <LoadState loading />

  return (
    <>
      {/* ---------- başlık */}
      <NavbarPortal>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="relative">
          <button onClick={() => editing && setIconPicker((o) => !o)} className={cx('grid size-8 place-items-center rounded-[9px] bg-[var(--accent-soft)] text-[17px]', editing && 'ring-1 ring-[var(--glass-border)] hover:ring-2')} title={editing ? 'Simge seç' : undefined}>{icon}</button>
          {iconPicker && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setIconPicker(false)} />
              <div className="animate-pop absolute left-0 top-10 z-40 grid w-56 grid-cols-8 gap-1 rounded-xl border border-[var(--glass-border)] bg-[var(--modal-bg)] p-2 shadow-xl">
                {PAGE_ICONS.map((i) => <button key={i} onClick={() => { setIcon(i); setIconPicker(false) }} className="rounded-md p-1 text-[18px] hover:bg-[var(--hover)]">{i}</button>)}
              </div>
            </>
          )}
        </div>
        {editing
          ? <Input value={title} onChange={(e) => setTitle(e.target.value)} className="!h-8 !w-64 !text-[14px] font-semibold" aria-label="Sayfa başlığı" />
          : <h1 className="truncate text-[15px] font-semibold tracking-[-0.01em]">{title}</h1>}
        <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--text-muted)]">
          {saveState === 'saved' ? <><Icon name="check" size={12} strokeWidth={2.2} className="text-[var(--success)]" />Kaydedildi</> : saveState === 'saving' ? 'Kaydediliyor…' : 'Kaydedilecek…'}
        </span>

      </div>
        <div className="flex shrink-0 items-center gap-2">
          {editing ? <>
            <Button variant="ghost" icon="trash" className="!text-[var(--danger)]" onClick={() => setConfirmDelete(true)}>Sayfayı Sil</Button>
            <Button variant="secondary" icon="excel" onClick={() => { setDroppedFile(null); setUploadOpen(true) }}>Excel'den Veri Ekle</Button>
            <Button variant="secondary" icon="plus" onClick={addWidget}>Bileşen</Button>
            <Button icon="check" onClick={() => setEditing(false)}>Bitti</Button>
          </> : <>
            <Button variant="ghost" icon="printer" onClick={() => exportPdf(title)}>PDF</Button>
            <Button variant="ghost" icon="refresh" onClick={refreshData} title="Verileri yeniden çek">Yenile</Button>
            <Button variant="secondary" icon="edit" onClick={() => setEditing(true)}>Düzenle</Button>
          </>}
        </div>
      </NavbarPortal>

      {editing && widgets.length > 0 && (
        <p className="mb-3 mt-1 rounded-xl border border-dashed border-[var(--accent)]/50 bg-[var(--today-bg)] px-4 py-2 text-[12px] text-[var(--text-muted)]">
          Bileşenleri sürükleyerek sıralayın · dişli simgesiyle veri ve görünümü ayarlayın · genişliği üstteki düğmelerden seçin · sayfaya Excel sürükleyip bırakarak yeni veri ekleyin
        </p>
      )}

      {/* ---------- boş sayfa */}
      {widgets.length === 0 ? (
        <EmptyPage
          onAdd={addWidget}
          onExcel={() => { setDroppedFile(null); setUploadOpen(true) }}
          onTemplate={(id) => { const t = PAGE_TEMPLATES.find((x) => x.id === id)!; setWidgets(t.widgets()); if (title === 'Yeni Sayfa') { setTitle(t.title); setIcon(t.icon) } }}
        />
      ) : (
        <div ref={grid.ref} className="grid grid-cols-12 gap-3">
          {widgets.map((w) => (
            <div key={w.id} style={{ gridColumn: `span ${grid.span(w.size)} / span ${grid.span(w.size)}` }}
              className={cx('relative min-w-0', editing && 'cursor-grab', over === w.id && 'rounded-2xl ring-2 ring-[var(--accent)]')}
              draggable={editing}
              onDragStart={(e) => { dragId.current = w.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/x-widget', w.id) }}
              onDragOver={(e) => { if (dragId.current) { e.preventDefault(); setOver(w.id) } }}
              onDragLeave={() => setOver((o) => (o === w.id ? null : o))}
              onDrop={(e) => { e.preventDefault(); if (dragId.current) move(dragId.current, w.id); dragId.current = null; setOver(null) }}
              onDragEnd={() => { dragId.current = null; setOver(null) }}>
              {editing && (
                <div className="absolute -top-2.5 right-3 z-10 flex items-center gap-0.5 rounded-full border border-[var(--glass-border)] bg-[var(--modal-bg)] px-1 py-0.5 text-[11px] shadow-md">
                  <span className="px-1 text-[var(--text-muted)]" aria-hidden><Icon name="grip" size={13} /></span>
                  {SIZES.map((s) => (
                    <button key={s.value} onClick={() => patch(w.id, { size: s.value })} className={cx('rounded-full px-1.5 py-0.5', w.size === s.value ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--hover)]')}>{s.label}</button>
                  ))}
                  <span className="mx-0.5 h-3 w-px bg-[var(--glass-border)]" />
                  <button onClick={() => setEditor({ widget: w, isNew: false })} title="Ayarlar" className="grid size-5 place-items-center rounded-full hover:bg-[var(--hover)]"><Icon name="gear" size={12} /></button>
                  <button onClick={() => duplicate(w)} title="Çoğalt" className="grid size-5 place-items-center rounded-full hover:bg-[var(--hover)]"><Icon name="copy" size={12} /></button>
                  <button onClick={() => remove(w.id)} title="Kaldır" className="grid size-5 place-items-center rounded-full text-[var(--danger)] hover:bg-[var(--critical-bg)]"><Icon name="x" size={12} strokeWidth={2.2} /></button>
                </div>
              )}
              <GlassCard className={cx('h-full p-4', w.type === 'table' && 'px-2 pt-3')}>
                {w.type !== 'text' && (
                  <div className={cx('mb-2 flex items-start gap-2', w.type === 'table' && 'px-2')}>
                    <div className="min-w-0 flex-1">
                      <p className={cx('truncate font-semibold', w.type === 'stat' ? 'text-[12px] font-medium text-[var(--text-muted)]' : 'text-[14px]')}>{w.title}</p>
                      {editing && <p className="truncate text-[10.5px] text-[var(--text-muted)]">{sourceName(w.source, datasets)}</p>}
                    </div>
                    {!editing && CHART_TYPES.has(w.type) && (
                      <button onClick={() => setAsTable((s) => { const n = new Set(s); if (n.has(w.id)) n.delete(w.id); else n.add(w.id); return n })}
                        className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] hover:bg-[var(--hover)]" title="Tablo / grafik">
                        <span className="inline-flex items-center gap-1"><Icon name={asTable.has(w.id) ? 'chart' : 'table'} size={12} />{asTable.has(w.id) ? 'Grafik' : 'Tablo'}</span>
                      </button>
                    )}
                  </div>
                )}
                <div className={cx(editing && 'pointer-events-none select-none')}>
                  <WidgetBody widget={w} tableId={`page-${pageId}-${w.id}`} asTable={asTable.has(w.id)} />
                </div>
              </GlassCard>
            </div>
          ))}
          {editing && (
            <button onClick={addWidget} className="col-span-12 rounded-2xl border-2 border-dashed border-[var(--glass-border)] py-6 text-[13px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)]">
              <span className="inline-flex items-center gap-1.5"><Icon name="plus" size={14} />Bileşen ekle</span>
            </button>
          )}
        </div>
      )}

      <WidgetEditor open={!!editor} widget={editor?.widget ?? null} isNew={!!editor?.isNew} onClose={() => setEditor(null)} onSave={onEditorSave} />
      <DatasetUploadDialog open={uploadOpen} file={droppedFile} offerAutoPage
        onClose={() => { setUploadOpen(false); setDroppedFile(null) }}
        onSaved={({ id, name, data, autoPage }) => {
          setUploadOpen(false)
          setDroppedFile(null)
          if (autoPage) {
            setWidgets((ws) => [...ws, ...autoWidgets(data, { kind: 'dataset', id }, name)])
            if (title === 'Yeni Sayfa') setTitle(name)
            toast.success('Bileşenler Excel verisine göre oluşturuldu; Düzenle ile değiştirebilirsiniz.')
          } else {
            setEditor({ widget: blankWidget({ source: { kind: 'dataset', id }, title: name }), isNew: true })
          }
        }} />
      <ConfirmDialog open={confirmDelete} title="Sayfayı sil" message={<>"{title}" sayfası ve bileşenleri silinecek. Veri kümeleri silinmez.</>}
        onConfirm={deletePage} onClose={() => setConfirmDelete(false)} />
      <DropOverlay show={dragging} title="Yeni veri kümesi (otomatik bileşenlerle)" />
    </>
  )
}

function EmptyPage({ onAdd, onExcel, onTemplate }: { onAdd: () => void; onExcel: () => void; onTemplate: (id: string) => void }) {
  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2">
        <button onClick={onExcel} className="rounded-[18px] border-2 border-dashed p-6 text-left transition hover:-translate-y-px" style={{ borderColor: 'color-mix(in srgb, var(--accent) 50%, transparent)', background: 'var(--today-bg)' }}>
          <span className="grid size-10 place-items-center rounded-[12px] bg-[var(--accent)] text-white"><Icon name="sparkles" size={20} /></span>
          <p className="mt-3 text-[15px] font-semibold">Excel'den otomatik doldur</p>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">Dosyayı bırakın; sütunlar tanınsın, göstergeler, grafikler ve tablolar kendiliğinden oluşsun.</p>
        </button>
        <button onClick={onAdd} className="rounded-[18px] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-px">
          <span className="grid size-10 place-items-center rounded-[12px] bg-[var(--hover-strong)] text-[var(--text-2)]"><Icon name="layout" size={20} /></span>
          <p className="mt-3 text-[15px] font-semibold">Bileşenleri kendim seçeyim</p>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">Gösterge, tablo, liste ya da grafik ekleyip sistem verisine veya Excel'e bağlayın.</p>
        </button>
      </div>
      <p className="mb-2 mt-6 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">ya da hazır bir şablonla başlayın</p>
      <div className="grid gap-3 md:grid-cols-2">
        {PAGE_TEMPLATES.map((t) => (
          <button key={t.id} onClick={() => onTemplate(t.id)} className="flex items-start gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 text-left hover:bg-[var(--hover)]">
            <span className="text-2xl">{t.icon}</span>
            <span><span className="block text-[14px] font-semibold">{t.title}</span><span className="text-[12px] text-[var(--text-muted)]">{t.description}</span></span>
          </button>
        ))}
      </div>
    </div>
  )
}
