import { useEffect, useState } from 'react'
import { Button, GlassCard, PageHeader, SectionTitle, cx } from '../../components/ui/Glass'
import { Icon, type IconName } from '../../components/ui/Icons'
import { useActiveCompany } from '../../stores/useCompanyStore'
import { Modal } from '../../components/ui/Modal'
import { Field, Input } from '../../components/ui/Form'
import { api, errorMessage, send } from '../../lib/apiClient'
import { roleIn, useAuthStore } from '../../stores/useAuthStore'
import { toast } from '../../stores/useToastStore'
import { invalidateSources } from '../builder/sources'
import type { BackupMeta, BackupPayload } from '../../types/electron'
import { lastBackups, markBackup } from './useAutoBackup'
import { useBackup } from './useBackup'

function ActionCard({ icon, title, text, button, variant = 'secondary', onClick, disabled, highlight }: {
  icon: IconName; title: string; text: string; button: string; variant?: 'primary' | 'secondary'; onClick: () => void; disabled?: boolean; highlight?: boolean
}) {
  return (
    <GlassCard className={cx('flex flex-col p-5', highlight && 'ring-1 ring-[color-mix(in_srgb,var(--accent)_35%,transparent)]')}>
      <span className={cx('grid size-11 place-items-center rounded-[13px]', highlight ? 'bg-[var(--accent)] text-white' : 'bg-[var(--accent-soft)] text-[var(--accent-text)]')}><Icon name={icon} size={21} /></span>
      <p className="mt-4 text-[15px] font-semibold">{title}</p>
      <p className="mt-1 flex-1 text-[13px] leading-relaxed text-[var(--text-muted)]">{text}</p>
      <Button className="mt-4 self-start" variant={variant} onClick={onClick} disabled={disabled}>{button}</Button>
    </GlassCard>
  )
}

export function BackupPage() {
  const company = useActiveCompany()
  const { status, run, isDesktop, revealFolder } = useBackup()
  const [last, setLast] = useState<string | null>(() => (company ? lastBackups()[company.id] ?? null : null))
  const busy = status.kind === 'busy'

  const act = async (action: 'quickSave' | 'saveJson' | 'excel') => {
    const ok = await run(action)
    if (ok && company && action !== 'excel') { markBackup(company.id); setLast(new Date().toISOString()) }
  }

  const lastText = last ? new Date(last).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : null
  const stale = !last || Date.now() - new Date(last).getTime() > 7 * 86400000

  return (
    <>
      <PageHeader title="Yedekleme" subtitle="Verileriniz bu bilgisayarda, sizin kontrolünüzde"
        actions={isDesktop && <Button variant="secondary" icon="folder" onClick={revealFolder}>Yedek Klasörünü Aç</Button>} />

      <GlassCard className="mb-4 flex items-center gap-4 p-5">
        <span className={cx('grid size-12 shrink-0 place-items-center rounded-full', stale ? 'bg-[var(--warning-bg)] text-[var(--warning-text)]' : 'bg-[var(--good-bg)] text-[var(--good-text)]')}>
          <Icon name="shield" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{stale ? (last ? 'Son yedek bir haftadan eski' : 'Bu bilgisayarda henüz yedek yok') : 'Verileriniz yedekli'}</p>
          <p className="text-[13px] text-[var(--text-muted)]">
            {company?.name} · {lastText ? `son yedek ${lastText}` : 'tek tıkla Belgeler/MiniErp-Yedek klasörüne yedek alabilirsiniz'}
          </p>
        </div>
        <Button icon="save" disabled={!company || busy} onClick={() => act('quickSave')}>{busy ? 'Hazırlanıyor…' : 'Şimdi Yedekle'}</Button>
      </GlassCard>

      <div className="grid gap-3 md:grid-cols-3">
        <ActionCard highlight icon="save" title="Tek tıkla yedek" button="Yedek Al" variant="primary" disabled={!company || busy} onClick={() => act('quickSave')}
          text="Şirketin tüm verisi tarihli bir JSON dosyası olarak Belgeler/MiniErp-Yedek klasörüne yazılır. Dosya önce geçici olarak yazıldığı için yarım kalmaz." />
        <ActionCard icon="download" title="Farklı konuma kaydet" button="Farklı Kaydet…" disabled={!company || busy} onClick={() => act('saveJson')}
          text="Yedeği USB bellek, harici disk ya da paylaşılan klasör gibi seçtiğiniz bir yere kaydedin." />
        <ActionCard icon="excel" title="Excel raporu" button="Excel'e Aktar" disabled={!company || busy} onClick={() => act('excel')}
          text="Personel, puantaj, bordro ve gelir-gider ayrı sayfalarda; başlıklar sabit, tutarlar ₺ biçimli, toplam satırlarıyla." />
      </div>

      <p aria-live="polite" className="mt-3 min-h-5 text-[13px]">
        {status.kind === 'done' && <span className="inline-flex items-center gap-1.5 text-[var(--success)]"><Icon name="check" size={14} strokeWidth={2.2} />{status.message}</span>}
        {status.kind === 'error' && <span className="text-[var(--danger)]">{status.message}</span>}
      </p>

      <RestoreSection />

      <SectionTitle>Yedekte neler var</SectionTitle>
      <GlassCard className="grid gap-x-6 gap-y-3 p-5 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
        {([['employees', 'Personel ve ücretler'], ['shifts', 'Vardiya tanımları ve planı'], ['timesheet', 'Puantaj kayıtları'], ['payroll', 'Bordrolar'],
          ['finance', 'Gelir-gider ve kategoriler'], ['handshake', 'Cari hesaplar ve vadeler'], ['beach', 'İzinler ve bordro ayarları'], ['layout', 'Oluşturduğunuz sayfalar'], ['datasets', "Excel'den yüklenen veriler"], ['shield', 'Yalnızca bu şirketin verisi'], ['paperclip', 'Belge ekleri hariç (sunucuda kalır)']] as [IconName, string][]).map(([icon, label]) => (
          <span key={label} className="flex items-center gap-2 text-[var(--text-2)]"><Icon name={icon} size={15} className="text-[var(--text-muted)]" />{label}</span>
        ))}
      </GlassCard>
    </>
  )
}

// ---------------------------------------------------------------- geri yükleme
interface BackupFile { fileName: string; filePath: string; size: number; modifiedAt: string }
type Picked = { filePath: string; meta: BackupMeta; data: BackupPayload }

const COUNT_LABEL: [keyof BackupPayload | string, string][] = [
  ['employees', 'Personel'], ['shiftAssignments', 'Vardiya'], ['timeEntries', 'Mesai kaydı'], ['payrolls', 'Bordro'],
  ['transactions', 'Gelir-gider'], ['parties', 'Cari'], ['cariDocuments', 'Cari belge'], ['leaveRequests', 'İzin'], ['customPages', 'Sayfa'], ['datasets', 'Veri kümesi'],
]

function RestoreSection() {
  const company = useActiveCompany()
  const isOwner = roleIn(useAuthStore((s) => s.user), company?.id ?? null) === 'Owner'
  const [files, setFiles] = useState<BackupFile[]>([])
  const [picked, setPicked] = useState<Picked | null>(null)
  const bridge = window.api

  const load = async () => {
    if (!bridge || !company) return
    const r = await bridge.backup.list(company.name)
    if (r.ok && !r.canceled) setFiles(r.items)
  }
  useEffect(() => { void load() }, [company?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (filePath?: string) => {
    if (!bridge) return
    const r = filePath ? await bridge.backup.read(filePath) : await bridge.backup.openJson()
    if (!r.ok) toast.error(r.error)
    else if (!r.canceled) setPicked(r)
  }

  if (!bridge) return null
  return (
    <>
      <SectionTitle>Yedekten geri yükle</SectionTitle>
      <GlassCard className="mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl">
            <p className="text-[14px] font-semibold">Bir yedeği bu şirkete geri yükleyin</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
              Şirketin mevcut verisi seçtiğiniz yedekteki hâliyle <b>tamamen değiştirilir</b>. Belge ekleri korunur. İşlemden hemen önce mevcut hâlin güvenlik yedeği otomatik alınır.
              {!isOwner && <span className="mt-1 block text-[var(--warning-text)]">Geri yükleme yalnızca şirket sahibine açıktır.</span>}
            </p>
          </div>
          <Button variant="secondary" icon="folder" disabled={!isOwner} onClick={() => open()}>Dosyadan Seç…</Button>
        </div>
        {files.length > 0 && (
          <ul className="mt-4 divide-y divide-[var(--row-border)] rounded-[12px] border border-[var(--glass-border)]">
            {files.slice(0, 6).map((f) => (
              <li key={f.filePath} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                <Icon name="file" size={15} className="text-[var(--text-muted)]" />
                <span className="flex-1 tabular-nums">{new Date(f.modifiedAt).toLocaleString('tr-TR', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-[11.5px] text-[var(--text-muted)]">{(f.size / 1024).toFixed(0)} KB</span>
                <Button variant="ghost" icon="restore" className="!h-7" disabled={!isOwner} onClick={() => open(f.filePath)}>Geri Yükle…</Button>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
      <RestoreDialog picked={picked} onClose={() => setPicked(null)} onDone={load} />
    </>
  )
}

function RestoreDialog({ picked, onClose, onDone }: { picked: Picked | null; onClose: () => void; onDone: () => void }) {
  const company = useActiveCompany()
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => setConfirmText(''), [picked])
  if (!picked || !company) return null
  const d = picked.data as unknown as Record<string, unknown[]>
  const otherCompany = picked.data.company?.id && picked.data.company.id !== company.id

  const restore = async () => {
    setBusy(true)
    try {
      // Güvenlik ağı: önce mevcut hâli yedekle
      const current = await api<BackupPayload>('/api/backup/export')
      const safety = await window.api!.backup.quickSave(current)
      if (!safety.ok) throw new Error(`Güvenlik yedeği alınamadı: ${safety.error}`)
      markBackup(company.id)
      const r = await send<{ message: string }>('POST', '/api/backup/restore', picked.data)
      invalidateSources()
      toast.success(`${r.message} Önceki hâl yedeklendi.`)
      onClose()
      onDone()
      setTimeout(() => location.reload(), 900)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Yedekten geri yükle" width="md"
      footer={<><Button variant="secondary" onClick={onClose}>Vazgeç</Button><Button variant="danger" icon="restore" disabled={busy || confirmText.trim().toLocaleLowerCase('tr') !== company.name.toLocaleLowerCase('tr')} onClick={restore}>{busy ? 'Geri yükleniyor…' : 'Geri Yükle'}</Button></>}>
      <div className="rounded-[12px] bg-[var(--hover)] p-3 text-[13px]">
        <p><b>Yedek:</b> {picked.data.company?.name} · {new Date(picked.meta.createdAt).toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        <p className="truncate text-[12px] text-[var(--text-muted)]">{picked.filePath}</p>
      </div>
      {otherCompany && <p className="mt-3 rounded-[10px] bg-[var(--warning-bg)] px-3 py-2 text-[12.5px] text-[var(--warning-text)]">Bu yedek <b>{picked.data.company.name}</b> şirketine ait; <b>{company.name}</b> şirketine aktarılacak.</p>}
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-3">
        {COUNT_LABEL.map(([k, label]) => <span key={k} className="flex justify-between"><span className="text-[var(--text-muted)]">{label}</span><b className="tabular-nums">{Array.isArray(d[k]) ? d[k].length : 0}</b></span>)}
      </div>
      <p className="mt-4 text-[12.5px] text-[var(--critical-text)]"><b>{company.name}</b> şirketinin şu anki verisi bu yedekle değiştirilecek. Onaylamak için şirket adını yazın:</p>
      <Field label=""><Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={company.name} /></Field>
    </Modal>
  )
}
