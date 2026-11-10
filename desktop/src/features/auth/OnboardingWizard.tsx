import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, Segmented, cx } from '../../components/ui/Glass'
import { Icon, type IconName } from '../../components/ui/Icons'
import { Input } from '../../components/ui/Form'
import { api, errorMessage, send } from '../../lib/apiClient'
import { useAuthStore } from '../../stores/useAuthStore'
import { useCompanyStore, type Company } from '../../stores/useCompanyStore'
import { useNavStore, type BuiltinPage } from '../../stores/useNavStore'
import { toast } from '../../stores/useToastStore'
import { useUiStore } from '../../stores/useUiStore'
import { CompanyMark } from '../../app/Sidebar'

const COLORS = ['#FF9F0A', '#0A84FF', '#30D158', '#BF5AF2', '#FF375F', '#64D2FF']
const STEPS = ['Hoş geldiniz', 'Şirketleriniz', 'Verileriniz', 'Güvenlik']

/** İlk girişte bir kez gösterilen kurulum sihirbazı. Her adım atlanabilir. */
export function OnboardingWizard() {
  const user = useAuthStore((s) => s.user)
  const refreshMe = useAuthStore((s) => s.refreshMe)
  const { companies, setCompanies } = useCompanyStore()
  const go = useNavStore((s) => s.go)
  const { setOnboarded, autoBackup, setAutoBackup, lockMinutes, setLockMinutes } = useUiStore()
  const [step, setStep] = useState(0)
  const owned = companies.filter((c) => user?.companies.find((u) => u.id === c.id)?.role === 'Owner')
  const [names, setNames] = useState<Record<string, { name: string; color: string }>>(() =>
    Object.fromEntries(owned.map((c, i) => [c.id, { name: c.name, color: c.accentColor ?? COLORS[i % COLORS.length] }])))
  const [busy, setBusy] = useState(false)

  const finish = (page?: BuiltinPage) => { if (user) setOnboarded(user.id); if (page) go(page) }

  const saveCompanies = async () => {
    setBusy(true)
    try {
      for (const c of owned) {
        const n = names[c.id]
        if (n && (n.name !== c.name || n.color !== c.accentColor)) await send('PUT', `/api/companies/${c.id}`, { name: n.name, taxNumber: null, accentColor: n.color })
      }
      setCompanies(await api<Company[]>('/api/companies'))
      await refreshMe()
      setStep(2)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const choice = (icon: IconName, title: string, text: string, onClick: () => void, primary?: boolean) => (
    <button onClick={onClick} className={cx('flex w-full items-start gap-3 rounded-[14px] border p-4 text-left transition hover:-translate-y-px',
      primary ? 'border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[var(--today-bg)]' : 'border-[var(--glass-border)] bg-[var(--bg-elev)] hover:bg-[var(--hover)]')}>
      <span className={cx('grid size-9 shrink-0 place-items-center rounded-[10px]', primary ? 'bg-[var(--accent)] text-white' : 'bg-[var(--hover-strong)] text-[var(--text-2)]')}><Icon name={icon} size={18} /></span>
      <span><span className="block text-[14px] font-semibold">{title}</span><span className="text-[12.5px] text-[var(--text-muted)]">{text}</span></span>
    </button>
  )

  return createPortal(
    <div className="animate-fade fixed inset-0 z-[80] grid place-items-center bg-black/30 p-6 backdrop-blur-[4px]">
      <div className="animate-pop w-full max-w-xl overflow-hidden rounded-[24px] border border-[var(--glass-border)] bg-[var(--modal-bg)] shadow-[var(--shadow-pop)] backdrop-blur-2xl">
        {/* adım göstergesi */}
        <div className="flex items-center gap-2 border-b border-[var(--glass-border)] px-6 py-3.5">
          {STEPS.map((s, i) => (
            <span key={s} className="flex items-center gap-2 text-[12px]">
              <span className={cx('grid size-5 place-items-center rounded-full text-[10.5px] font-bold', i < step ? 'bg-[var(--success)] text-white' : i === step ? 'bg-[var(--accent)] text-white' : 'bg-[var(--hover-strong)] text-[var(--text-muted)]')}>
                {i < step ? <Icon name="check" size={11} strokeWidth={3} /> : i + 1}
              </span>
              <span className={i === step ? 'font-semibold' : 'text-[var(--text-muted)]'}>{s}</span>
              {i < STEPS.length - 1 && <span className="mx-1 h-px w-4 bg-[var(--glass-border)]" />}
            </span>
          ))}
          <button onClick={() => finish()} className="ml-auto text-[12px] text-[var(--text-muted)] hover:text-[var(--text)]">Atla</button>
        </div>

        <div className="p-6">
          {step === 0 && (
            <div className="text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-[18px] bg-[linear-gradient(145deg,#3a3a3c,#1d1d1f)] text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]"><Icon name="layout" size={30} /></span>
              <h2 className="mt-4 text-[20px] font-semibold tracking-[-0.02em]">Hoş geldiniz, {user?.fullName.split(' ')[0]}</h2>
              <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-[var(--text-2)]">
                Şirketlerinizin personel, vardiya, puantaj, bordro, gelir-gider ve cari takibi tek yerde. Excel'leriniz çöpe gitmiyor: sürükleyip bırakarak içeri alabilir, her şeyi tek tıkla Excel'e geri verebilirsiniz.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-left text-[12px]">
                {([['buildings', 'Çoklu şirket', 'Tek tıkla geçiş, konsolide görünüm'], ['excel', 'Excel dostu', 'İçe ve dışa aktarım, şablonlar'], ['shield', 'Verileriniz sizde', 'Otomatik yerel yedek, kilit']] as [IconName, string, string][]).map(([i, t, d]) => (
                  <div key={t} className="rounded-[12px] bg-[var(--hover)] p-3"><Icon name={i} size={17} className="text-[var(--accent)]" /><p className="mt-1.5 font-semibold">{t}</p><p className="text-[var(--text-muted)]">{d}</p></div>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-[17px] font-semibold">Şirketlerinizi adlandırın</h2>
              <p className="mt-1 text-[13px] text-[var(--text-muted)]">Renk, şirketler arasında geçerken hangisinde olduğunuzu bir bakışta gösterir.</p>
              <div className="mt-4 space-y-2">
                {owned.map((c) => {
                  const n = names[c.id]
                  return (
                    <div key={c.id} className="flex items-center gap-3 rounded-[12px] bg-[var(--hover)] p-2.5">
                      <CompanyMark name={n?.name || c.name} color={n?.color ?? null} size={30} />
                      <Input value={n?.name ?? ''} onChange={(e) => setNames({ ...names, [c.id]: { ...n, name: e.target.value } })} className="flex-1" />
                      <div className="flex gap-1">
                        {COLORS.map((col) => (
                          <button key={col} onClick={() => setNames({ ...names, [c.id]: { ...n, color: col } })} aria-label={col}
                            className={cx('size-5 rounded-full', n?.color === col && 'ring-2 ring-[var(--text)] ring-offset-1 ring-offset-[var(--hover)]')} style={{ background: col }} />
                        ))}
                      </div>
                    </div>
                  )
                })}
                {owned.length === 0 && <p className="text-[13px] text-[var(--text-muted)]">Sahibi olduğunuz şirket yok; bu adımı atlayabilirsiniz.</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-[17px] font-semibold">Verilerinizi nasıl getirelim?</h2>
              <p className="mt-1 text-[13px] text-[var(--text-muted)]">Sonradan her zaman değiştirebilirsiniz.</p>
              <div className="mt-4 space-y-2">
                {choice('upload', 'Personel listemi Excel\'den alayım', 'Personel ekranında dosyanızı sürükleyip bırakın; sütunlar otomatik eşleşir.', () => finish('employees'), true)}
                {choice('gallery', 'Hazır sayfalara göz atayım', 'Enerji üretimi, satış, stok, bütçe… Excel şablonlarıyla birlikte.', () => finish('gallery'))}
                {choice('dashboard', 'Önce etrafa bakayım', 'Genel Bakış ekranıyla başlayın.', () => setStep(3))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-[17px] font-semibold">Güvenlik ve yedek</h2>
              <p className="mt-1 text-[13px] text-[var(--text-muted)]">Önerilen ayarlar açık; Ayarlar'dan değiştirebilirsiniz.</p>
              <div className="mt-4 space-y-3 text-[13px]">
                <label className="flex items-start gap-3 rounded-[12px] bg-[var(--hover)] p-3">
                  <input type="checkbox" className="mt-0.5" checked={autoBackup} onChange={(e) => setAutoBackup(e.target.checked)} />
                  <span><b>Günlük otomatik yedek</b><span className="block text-[12px] text-[var(--text-muted)]">Her şirketin verisi bu bilgisayarda Belgeler/MiniErp-Yedek klasörüne kaydedilir.</span></span>
                </label>
                <div className="rounded-[12px] bg-[var(--hover)] p-3">
                  <b>Otomatik kilit</b><span className="block text-[12px] text-[var(--text-muted)]">Bilgisayar başında değilken uygulama kilitlenir.</span>
                  <div className="mt-2"><Segmented size="sm" value={String(lockMinutes)} onChange={(v) => setLockMinutes(Number(v))} options={[{ value: '5', label: '5 dk' }, { value: '15', label: '15 dk' }, { value: '30', label: '30 dk' }, { value: '0', label: 'Kapalı' }]} /></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--glass-border)] px-6 py-3.5">
          <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>Geri</Button>
          {step === 0 && <Button onClick={() => setStep(1)}>Başlayalım</Button>}
          {step === 1 && <Button onClick={saveCompanies} disabled={busy}>{busy ? 'Kaydediliyor…' : 'Devam'}</Button>}
          {step === 2 && <Button variant="secondary" onClick={() => setStep(3)}>Devam</Button>}
          {step === 3 && <Button icon="check" onClick={() => finish('dashboard')}>Bitir</Button>}
        </div>
      </div>
    </div>,
    document.body,
  )
}
