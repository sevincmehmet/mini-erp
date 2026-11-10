import { useEffect, useState } from 'react'
import { Button, cx } from '../../components/ui/Glass'
import { Modal } from '../../components/ui/Modal'
import { Field, Input } from '../../components/ui/Form'
import { errorMessage } from '../../lib/apiClient'
import { useNavStore } from '../../stores/useNavStore'
import { toast } from '../../stores/useToastStore'
import { PAGE_TEMPLATES } from './autoPage'
import { PAGE_ICONS } from './CustomPageView'
import { usePagesStore } from './usePagesStore'

type Start = 'excel' | 'blank' | string // string = şablon id

export function NewPageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = usePagesStore((s) => s.create)
  const go = useNavStore((s) => s.go)
  const [title, setTitle] = useState('Yeni Sayfa')
  const [icon, setIcon] = useState('📊')
  const [start, setStart] = useState<Start>('excel')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) { setTitle('Yeni Sayfa'); setIcon('📊'); setStart('excel') } }, [open])

  const submit = async () => {
    setBusy(true)
    try {
      const template = PAGE_TEMPLATES.find((t) => t.id === start)
      const page = await create(title.trim() || template?.title || 'Yeni Sayfa', icon, template?.widgets() ?? [])
      onClose()
      go(`custom:${page.id}`, start === 'excel' ? 'excel' : null)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const options: { id: Start; icon: string; title: string; text: string }[] = [
    { id: 'excel', icon: '✨', title: "Excel'den otomatik", text: 'Dosyayı seçin, bileşenler verinize göre oluşsun' },
    { id: 'blank', icon: '▢', title: 'Boş sayfa', text: 'Bileşenleri kendiniz ekleyin' },
    ...PAGE_TEMPLATES.map((t) => ({ id: t.id, icon: t.icon, title: t.title, text: t.description })),
  ]

  return (
    <Modal open={open} onClose={onClose} title="Yeni Sayfa" width="md"
      footer={<>
        <Button variant="ghost" icon="gallery" className="mr-auto" onClick={() => { onClose(); go('gallery') }}>Örnek sayfalara göz at</Button>
        <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
        <Button onClick={submit} disabled={busy}>{busy ? 'Oluşturuluyor…' : 'Oluştur'}</Button>
      </>}>
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr] gap-3">
          <Field label="Sayfa adı"><Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} /></Field>
          <div className="flex flex-wrap gap-1">
            {PAGE_ICONS.map((i) => (
              <button key={i} onClick={() => setIcon(i)} className={cx('rounded-lg p-1.5 text-[18px]', icon === i ? 'bg-[var(--today-bg)] ring-2 ring-[var(--accent)]' : 'hover:bg-[var(--hover)]')}>{i}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {options.map((o) => (
            <button key={o.id} onClick={() => { setStart(o.id); const t = PAGE_TEMPLATES.find((x) => x.id === o.id); if (t && title === 'Yeni Sayfa') { setTitle(t.title); setIcon(t.icon) } }}
              className={cx('flex items-start gap-2.5 rounded-xl border p-3 text-left transition', start === o.id ? 'border-[var(--accent)] bg-[var(--today-bg)]' : 'border-[var(--glass-border)] hover:bg-[var(--hover)]')}>
              <span className="text-[20px]">{o.icon}</span>
              <span><span className="block text-[13px] font-semibold">{o.title}</span><span className="text-[11.5px] text-[var(--text-muted)]">{o.text}</span></span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}
