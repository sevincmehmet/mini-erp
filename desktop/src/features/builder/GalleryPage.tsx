import { useState } from 'react'
import { Badge, Button, GlassCard, PageHeader, SectionTitle, Segmented, cx } from '../../components/ui/Glass'
import { Icon } from '../../components/ui/Icons'
import { Modal } from '../../components/ui/Modal'
import { useGridSpan } from '../../components/ui/useGridSpan'
import { errorMessage, send } from '../../lib/apiClient'
import { useNavStore } from '../../stores/useNavStore'
import { toast } from '../../stores/useToastStore'
import { autoWidgets, PAGE_TEMPLATES } from './autoPage'
import { DatasetUploadDialog } from './DatasetUploadDialog'
import { ExcelPreview } from './ExcelPreview'
import { LayoutThumb } from './LayoutThumb'
import { keyOf, SAMPLE_PAGES, sampleData, type SamplePage } from './samples'
import { useDatasetsStore } from './sources'
import type { DatasetSummary, Widget } from './types'
import { usePagesStore } from './usePagesStore'
import { WidgetBody } from './WidgetBody'

type Preview = { kind: 'sample'; sample: SamplePage } | { kind: 'system'; template: (typeof PAGE_TEMPLATES)[number] }

/** Şablonu Excel olarak kaydeder: başlıklar (zorunlular *), ilk 12 örnek satır ve açıklama sayfası. */
async function downloadTemplate(s: SamplePage) {
  const bridge = window.api
  if (!bridge) return toast.error('Şablon yalnızca masaüstü uygulamasında indirilebilir.')
  const res = await bridge.excel.saveTemplate({
    fileName: s.title,
    sheetName: 'Veri',
    columns: s.columns.map((c) => ({ header: c.header, type: c.type, required: c.required, help: c.help })),
    examples: (sampleData(s.id)?.rows ?? []).slice(0, 12),
  })
  if (!res.ok) toast.error(res.error)
  else if (!res.canceled) toast.success(`Şablon kaydedildi: ${res.filePath}`)
}

export function GalleryPage() {
  const [preview, setPreview] = useState<Preview | null>(null)
  return (
    <>
      <PageHeader title="Örnek Sayfalar" subtitle="Hazır sayfa şablonları · Excel'de nasıl görüneceğini inceleyin, şablonu indirin, tek tıkla oluşturun" />

      <SectionTitle>Excel şablonlu örnekler</SectionTitle>
      <div className="mb-7 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SAMPLE_PAGES.map((s) => {
          const widgets = s.widgets({ kind: 'sample', id: s.id })
          return (
            <GlassCard key={s.id} className="group flex flex-col overflow-hidden transition hover:-translate-y-px hover:shadow-[var(--shadow-pop)]">
              <button onClick={() => setPreview({ kind: 'sample', sample: s })} className="block bg-[var(--hover)] p-3 text-left" aria-label={`${s.title} önizle`}>
                <LayoutThumb widgets={widgets} />
              </button>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start gap-2.5">
                  <span className="text-[22px] leading-none">{s.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-semibold">{s.title}</p>
                    <p className="text-[11.5px] text-[var(--text-muted)]">{s.tag}</p>
                  </div>
                </div>
                <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-[var(--text-2)]">{s.description}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {s.columns.slice(0, 5).map((c) => <Badge key={c.header}>{c.header}</Badge>)}
                  {s.columns.length > 5 && <Badge>+{s.columns.length - 5}</Badge>}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" icon="eye" onClick={() => setPreview({ kind: 'sample', sample: s })}>Önizle</Button>
                  <Button variant="ghost" icon="download" onClick={() => downloadTemplate(s)}>Excel Şablonu</Button>
                </div>
              </div>
            </GlassCard>
          )
        })}
      </div>

      <SectionTitle>Sistem verilerinizle · Excel gerekmez</SectionTitle>
      <div className="grid gap-3 md:grid-cols-2">
        {PAGE_TEMPLATES.map((t) => (
          <GlassCard key={t.id} className="flex flex-col overflow-hidden transition hover:-translate-y-px hover:shadow-[var(--shadow-pop)]">
            <button onClick={() => setPreview({ kind: 'system', template: t })} className="block bg-[var(--hover)] p-3 text-left" aria-label={`${t.title} önizle`}>
              <LayoutThumb widgets={t.widgets()} />
            </button>
            <div className="flex items-start gap-2.5 p-4">
              <span className="text-[22px] leading-none">{t.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold">{t.title}</p>
                <p className="mt-1 text-[12.5px] text-[var(--text-2)]">{t.description}</p>
              </div>
              <Button variant="secondary" icon="eye" onClick={() => setPreview({ kind: 'system', template: t })}>Önizle</Button>
            </div>
          </GlassCard>
        ))}
      </div>

      <PreviewDialog preview={preview} onClose={() => setPreview(null)} />
    </>
  )
}

function PreviewDialog({ preview, onClose }: { preview: Preview | null; onClose: () => void }) {
  const [tab, setTab] = useState<'page' | 'excel' | 'columns'>('page')
  const [busy, setBusy] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const createPage = usePagesStore((s) => s.create)
  const refreshDatasets = useDatasetsStore((s) => s.refresh)
  const go = useNavStore((s) => s.go)
  const grid = useGridSpan<HTMLDivElement>()

  if (!preview) return null
  const isSample = preview.kind === 'sample'
  const title = isSample ? preview.sample.title : preview.template.title
  const icon = isSample ? preview.sample.icon : preview.template.icon
  const widgets: Widget[] = isSample ? preview.sample.widgets({ kind: 'sample', id: preview.sample.id }) : preview.template.widgets()

  const finish = async (pageWidgets: Widget[], message: string) => {
    const page = await createPage(title, icon, pageWidgets)
    toast.success(message)
    onClose()
    setTab('page')
    go(`custom:${page.id}`)
  }

  const createWithSample = async () => {
    if (!isSample) {
      setBusy(true)
      try { await finish(widgets, `"${title}" sayfası oluşturuldu.`) } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
      return
    }
    const s = preview.sample
    const data = sampleData(s.id)!
    setBusy(true)
    try {
      // Örnek veri kalıcı bir veri kümesine dönüşür; sonra Veri Kaynakları'ndan kendi Excel'inizle yenileyebilirsiniz
      const ds = await send<DatasetSummary>('POST', '/api/datasets', { name: `${s.title} (örnek veri)`, description: 'Örnek Sayfalar galerisinden', sourceFileName: 'örnek veri', sourceSheet: 'Veri', columns: data.columns, rows: data.rows })
      await refreshDatasets()
      await finish(s.widgets({ kind: 'dataset', id: ds.id }), `"${title}" örnek veriyle oluşturuldu. Kendi verinize geçmek için Veri Kaynakları'nda "Yenile"yi kullanın.`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Modal open={!!preview && !uploadOpen} onClose={() => { setTab('page'); onClose() }} width="xl" title={`${icon}  ${title}`}
        footer={
          <>
            {isSample && <Button variant="ghost" icon="download" className="mr-auto" onClick={() => downloadTemplate(preview.sample)}>Excel Şablonunu İndir</Button>}
            {isSample && <Button variant="secondary" icon="upload" onClick={() => setUploadOpen(true)}>Kendi Excel'imle Oluştur</Button>}
            <Button icon={isSample ? 'sparkles' : 'plus'} disabled={busy} onClick={createWithSample}>{busy ? 'Oluşturuluyor…' : isSample ? 'Örnek Veriyle Oluştur' : 'Sayfayı Oluştur'}</Button>
          </>
        }>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-[13px] text-[var(--text-2)]">{isSample ? preview.sample.description : preview.template.description}</p>
          {isSample && (
            <Segmented value={tab} onChange={setTab} options={[
              { value: 'page', label: <><Icon name="dashboard" size={13} />Sayfa</> },
              { value: 'excel', label: <><Icon name="excel" size={13} />Excel görünümü</> },
              { value: 'columns', label: <><Icon name="columns" size={13} />Şablon sütunları</> },
            ]} />
          )}
        </div>

        {tab === 'page' || !isSample ? (
          <div className="rounded-[16px] bg-[var(--panel-bg)] p-3 shadow-[inset_0_0_0_0.5px_var(--panel-border)]">
            <div ref={grid.ref} className="grid grid-cols-12 gap-3">
              {widgets.map((w) => (
                <div key={w.id} className="min-w-0" style={{ gridColumn: `span ${grid.span(w.size)} / span ${grid.span(w.size)}` }}>
                  <GlassCard className={cx('h-full p-4', w.type === 'table' && 'px-2 pt-3')}>
                    {w.type !== 'text' && <p className={cx('mb-2 truncate', w.type === 'stat' ? 'text-[12px] font-medium text-[var(--text-muted)]' : 'text-[14px] font-semibold', w.type === 'table' && 'px-2')}>{w.title}</p>}
                    <WidgetBody widget={w} tableId={`gallery-${w.id}`} />
                  </GlassCard>
                </div>
              ))}
            </div>
          </div>
        ) : tab === 'excel' ? (
          <div>
            <ExcelPreview fileName={`${preview.sample.title}.xlsx`} sheetName="Veri" columns={preview.sample.columns} rows={sampleData(preview.sample.id)?.rows ?? []} />
            <p className="mt-3 text-[12px] text-[var(--text-muted)]">
              Kendi dosyanızı bu düzende hazırlayın: ilk satırda başlıklar, altında her satır bir kayıt. Yıldızlı sütunlar zorunlu; sütun sırası önemli değil, başlık adları aynı olmalı.
              Üstte rapor başlığı ya da altta "TOPLAM" satırı olması sorun değil, otomatik ayıklanır.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-[var(--glass-border)]">
            <table className="w-full border-collapse text-[13px]">
              <thead className="bg-[var(--hover)] text-left text-[12px] text-[var(--text-muted)]">
                <tr><th className="px-3 py-2 font-medium">Sütun başlığı</th><th className="px-3 py-2 font-medium">Tip</th><th className="px-3 py-2 font-medium">Zorunlu</th><th className="px-3 py-2 font-medium">Açıklama</th><th className="px-3 py-2 font-medium">Bileşenlerde</th></tr>
              </thead>
              <tbody>
                {preview.sample.columns.map((c) => {
                  const used = widgets.filter((w) => JSON.stringify(w).includes(`"${keyOf(c.header)}"`)).length
                  return (
                    <tr key={c.header} className="border-t border-[var(--row-border)]">
                      <td className="px-3 py-2 font-medium">{c.header}</td>
                      <td className="px-3 py-2"><Badge tone={c.type === 'money' ? 'good' : c.type === 'date' ? 'info' : 'neutral'}>{{ date: 'Tarih', money: 'Tutar (₺)', number: 'Sayı', text: 'Metin' }[c.type]}</Badge></td>
                      <td className="px-3 py-2">{c.required ? <Badge tone="warning" dot>Zorunlu</Badge> : <span className="text-[var(--text-faint)]">İsteğe bağlı</span>}</td>
                      <td className="px-3 py-2 text-[var(--text-2)]">{c.help}</td>
                      <td className="px-3 py-2 tabular-nums text-[var(--text-muted)]">{used ? `${used} bileşen` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {isSample && (
        <DatasetUploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)}
          onSaved={async ({ id, name, data }) => {
            setUploadOpen(false)
            const s = preview.sample
            // Şablon sütunları dosyada varsa hazır bileşenler; yoksa dosyaya göre otomatik bileşenler
            const keys = new Set(data.columns.map((c) => c.key))
            const missing = s.columns.filter((c) => c.required && !keys.has(keyOf(c.header)))
            const src = { kind: 'dataset' as const, id }
            try {
              if (missing.length) {
                toast.info(`Dosyada şablonun ${missing.map((c) => `"${c.header}"`).join(', ')} sütunları yok; bileşenler dosyanıza göre otomatik oluşturuldu.`)
                await finish(autoWidgets(data, src, name), `"${title}" sayfası oluşturuldu.`)
              } else {
                await finish(s.widgets(src), `"${title}" sayfası Excel'inizle oluşturuldu.`)
              }
            } catch (e) {
              toast.error(errorMessage(e))
            }
          }} />
      )}
    </>
  )
}
