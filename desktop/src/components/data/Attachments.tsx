import { useRef, useState } from 'react'
import { download, errorMessage, send, upload } from '../../lib/apiClient'
import { useApi } from '../../lib/useApi'
import { toast } from '../../stores/useToastStore'
import { Button, cx } from '../ui/Glass'
import { Icon } from '../ui/Icons'
import { Modal } from '../ui/Modal'

interface AttachmentDto {
  id: string
  fileName: string
  contentType: string
  size: number
  createdAt: string
}

const sizeLabel = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

/** Kayda iliştirilmiş dosyalar: sürükle-bırak ya da seçerek ekle, indir, sil. */
export function AttachmentsPanel({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { data, reload } = useApi<AttachmentDto[]>(`/api/attachments?entityType=${entityType}&entityId=${entityId}`)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const add = async (files: FileList | File[]) => {
    setBusy(true)
    try {
      for (const f of Array.from(files)) {
        const form = new FormData()
        form.append('entityType', entityType)
        form.append('entityId', entityId)
        form.append('file', f)
        await upload('/api/attachments', form)
      }
      toast.success('Dosya eklendi.')
      reload()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const get = async (a: AttachmentDto) => {
    try {
      const blob = await download(`/api/attachments/${a.id}/download`)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = a.fileName
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const remove = async (a: AttachmentDto) => {
    try { await send('DELETE', `/api/attachments/${a.id}`); reload() } catch (e) { toast.error(errorMessage(e)) }
  }

  return (
    <div>
      <ul className="space-y-1">
        {(data ?? []).map((a) => (
          <li key={a.id} className="flex items-center gap-2.5 rounded-[10px] bg-[var(--hover)] px-3 py-2 text-[13px]">
            <Icon name={a.contentType.startsWith('image/') ? 'eye' : a.fileName.match(/\.xlsx?$/i) ? 'excel' : 'file'} size={15} className="text-[var(--text-muted)]" />
            <span className="min-w-0 flex-1 truncate">{a.fileName}</span>
            <span className="text-[11.5px] text-[var(--text-muted)]">{sizeLabel(a.size)}</span>
            <Button variant="ghost" className="!h-7 !px-2" icon="download" onClick={() => get(a)}>İndir</Button>
            <button onClick={() => remove(a)} aria-label="Eki sil" className="grid size-7 place-items-center rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--critical-bg)] hover:text-[var(--danger)]"><Icon name="trash" size={14} /></button>
          </li>
        ))}
      </ul>
      <button onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); if (e.dataTransfer.files.length) void add(e.dataTransfer.files) }}
        className={cx('mt-2 flex w-full items-center justify-center gap-2 rounded-[12px] border-2 border-dashed px-3 py-4 text-[12.5px] text-[var(--text-muted)] transition',
          over ? 'border-[var(--accent)] bg-[var(--today-bg)]' : 'border-[var(--hover-strong)] hover:border-[var(--accent)]')}>
        <Icon name="paperclip" size={15} /> {busy ? 'Yükleniyor…' : 'Fatura, fiş ya da belge ekleyin (PDF, resim, Excel · en fazla 10 MB)'}
      </button>
      <input ref={input} type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.heic,.webp,.xlsx,.xls,.csv,.docx,.doc,.txt" onChange={(e) => { if (e.target.files?.length) void add(e.target.files); e.target.value = '' }} />
    </div>
  )
}

export function AttachmentsDialog({ target, onClose }: { target: { entityType: string; entityId: string; title: string } | null; onClose: () => void }) {
  return (
    <Modal open={!!target} onClose={onClose} title={`Ekler · ${target?.title ?? ''}`} footer={<Button onClick={onClose}>Kapat</Button>}>
      {target && <AttachmentsPanel entityType={target.entityType} entityId={target.entityId} />}
    </Modal>
  )
}
