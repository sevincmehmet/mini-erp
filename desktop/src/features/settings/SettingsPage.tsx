import { useEffect, useState, type ReactNode } from 'react'
import { DataTable, RowAction, type Column } from '../../components/data/DataTable'
import { Avatar, Badge, Button, GlassCard, PageHeader, Segmented, cx } from '../../components/ui/Glass'
import { Icon, type IconName } from '../../components/ui/Icons'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Field, FormError, FormGrid, Input, Select, toNumber } from '../../components/ui/Form'
import { api, errorMessage, send } from '../../lib/apiClient'
import { money } from '../../lib/format'
import { session } from '../../lib/session'
import { useApi } from '../../lib/useApi'
import { roleIn, useAuthStore, type CompanyRole } from '../../stores/useAuthStore'
import { useActiveCompany, useCompanyStore, type Company } from '../../stores/useCompanyStore'
import { toast } from '../../stores/useToastStore'
import { useUiStore } from '../../stores/useUiStore'
import { ROLE_LABEL } from '../../app/UserMenu'

type Tab = 'company' | 'users' | 'payroll' | 'security' | 'backup' | 'server' | 'demo'
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'company', label: 'Şirket', icon: 'buildings' },
  { id: 'users', label: 'Kullanıcılar', icon: 'employees' },
  { id: 'payroll', label: 'Bordro Parametreleri', icon: 'calculator' },
  { id: 'security', label: 'Güvenlik', icon: 'lock' },
  { id: 'backup', label: 'Otomatik Yedek', icon: 'backup' },
  // Demoda sunucu adresi uygulamanın içindedir; onun yerine demo ayarları gösterilir
  session.isDemo ? { id: 'demo', label: 'Demo', icon: 'sparkles' } : { id: 'server', label: 'Sunucu', icon: 'server' },
]

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('company')
  const company = useActiveCompany()
  const user = useAuthStore((s) => s.user)
  const role = roleIn(user, company?.id ?? null)
  const isOwner = role === 'Owner'
  return (
    <>
      <PageHeader title="Ayarlar" subtitle={`${company?.name ?? ''} · rolünüz: ${role ? ROLE_LABEL[role] : '—'}`} />
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <nav className="flex flex-row flex-wrap gap-1 lg:flex-col">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cx('flex h-9 items-center gap-2.5 rounded-[10px] px-3 text-left text-[13px] transition',
                tab === t.id ? 'bg-[var(--bg-elev)] font-medium shadow-[var(--shadow-card)]' : 'text-[var(--text-2)] hover:bg-[var(--hover)]')}>
              <Icon name={t.icon} size={16} className={tab === t.id ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'} />{t.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {tab === 'company' && company && <CompanySettings company={company} canEdit={isOwner} />}
          {tab === 'users' && (isOwner ? <UsersSettings /> : <OwnerOnly />)}
          {tab === 'payroll' && <PayrollSettings canEdit={isOwner} />}
          {tab === 'security' && <SecuritySettings />}
          {tab === 'backup' && <BackupSettings />}
          {tab === 'server' && <ServerSettings />}
          {tab === 'demo' && <DemoSettings />}
        </div>
      </div>
    </>
  )
}

function Section({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <GlassCard className="mb-3 p-5">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-[12.5px] text-[var(--text-muted)]">{description}</p>}
      <div className="mt-4">{children}</div>
      {footer && <div className="mt-4 flex justify-end gap-2 border-t border-[var(--row-border)] pt-4">{footer}</div>}
    </GlassCard>
  )
}

function OwnerOnly() {
  return <Section title="Yetki gerekiyor"><p className="text-[13px] text-[var(--text-muted)]">Bu bölümü yalnızca şirket sahibi yönetebilir.</p></Section>
}

// ---------------------------------------------------------------- şirket
const COLORS = ['#FF9F0A', '#0A84FF', '#30D158', '#BF5AF2', '#FF375F', '#64D2FF', '#5E5CE6', '#AC8E68']

function CompanySettings({ company, canEdit }: { company: Company; canEdit: boolean }) {
  const setCompanies = useCompanyStore((s) => s.setCompanies)
  const refreshMe = useAuthStore((s) => s.refreshMe)
  const [name, setName] = useState(company.name)
  const [tax, setTax] = useState('')
  const [color, setColor] = useState(company.accentColor ?? COLORS[0])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setName(company.name); setColor(company.accentColor ?? COLORS[0]) }, [company])
  const save = async () => {
    try {
      await send('PUT', `/api/companies/${company.id}`, { name, taxNumber: tax || null, accentColor: color })
      setCompanies(await api<Company[]>('/api/companies'))
      await refreshMe()
      toast.success('Şirket bilgileri kaydedildi.')
    } catch (e) { setError(errorMessage(e)) }
  }
  return (
    <Section title="Şirket bilgileri" description="Şirket adı ve rengi kenar çubuğunda, raporlarda ve yedek dosya adlarında kullanılır."
      footer={canEdit && <Button onClick={save}>Kaydet</Button>}>
      <FormGrid>
        <Field label="Şirket adı" required><Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Vergi no"><Input value={tax} onChange={(e) => setTax(e.target.value)} disabled={!canEdit} placeholder="İsteğe bağlı" /></Field>
        <Field label="Renk" className="col-span-2">
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button key={c} disabled={!canEdit} onClick={() => setColor(c)} aria-label={c}
                className={cx('size-7 rounded-full transition', color === c && 'ring-2 ring-[var(--text)] ring-offset-2 ring-offset-[var(--bg-elev)]')} style={{ background: c }} />
            ))}
          </div>
        </Field>
      </FormGrid>
      <FormError message={error} />
    </Section>
  )
}

// ---------------------------------------------------------------- kullanıcılar
interface CompanyUser { id: string; fullName: string; email: string; role: CompanyRole; isActive: boolean; lastLoginAt: string | null }

function UsersSettings() {
  const { data, reload } = useApi<CompanyUser[]>('/api/users')
  const me = useAuthStore((s) => s.user)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<CompanyUser | null>(null)
  const [resetting, setResetting] = useState<CompanyUser | null>(null)
  const [removing, setRemoving] = useState<CompanyUser | null>(null)
  const act = async (fn: () => Promise<unknown>, m: string) => { try { await fn(); toast.success(m); reload() } catch (e) { toast.error(errorMessage(e)) } }
  const cols: Column<CompanyUser>[] = [
    { key: 'name', header: 'Kullanıcı', value: (u) => u.fullName, render: (u) => <span className="inline-flex items-center gap-2.5"><Avatar name={u.fullName} /><span><span className="block font-medium">{u.fullName}{u.id === me?.id && <span className="ml-1.5 text-[11px] text-[var(--text-muted)]">(siz)</span>}</span><span className="block text-[11.5px] text-[var(--text-muted)]">{u.email}</span></span></span> },
    { key: 'role', header: 'Rol', value: (u) => ROLE_LABEL[u.role], render: (u) => <Badge tone={u.role === 'Owner' ? 'info' : u.role === 'Manager' ? 'good' : 'neutral'}>{ROLE_LABEL[u.role]}</Badge> },
    { key: 'status', header: 'Durum', value: (u) => (u.isActive ? 'Aktif' : 'Pasif'), render: (u) => <Badge dot tone={u.isActive ? 'good' : 'neutral'}>{u.isActive ? 'Aktif' : 'Pasif'}</Badge> },
    { key: 'last', header: 'Son giriş', value: (u) => u.lastLoginAt, render: (u) => (u.lastLoginAt ? new Date(`${u.lastLoginAt}Z`).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : <span className="text-[var(--text-muted)]">Hiç</span>) },
  ]
  return (
    <Section title="Bu şirketin kullanıcıları" description={<>Rol şirket bazındadır: aynı kişi bir şirkette <b>Sahip</b>, diğerinde <b>Salt okuma</b> olabilir. Sahip: her şey + kullanıcı yönetimi, geri yükleme. Yönetici: kayıt ekler/değiştirir. Salt okuma: yalnızca görür.</>}>
      <div className="mb-2 flex justify-end"><Button icon="plus" onClick={() => setAdding(true)}>Kullanıcı Ekle</Button></div>
      <DataTable tableId="users" exportName="Kullanıcılar" columns={cols} rows={data ?? []} rowKey={(u) => u.id}
        actions={(u) => <>
          <RowAction icon="edit" label="Rolü değiştir" onClick={() => setEditing(u)} />
          <RowAction icon="key" label="Şifre sıfırla" onClick={() => setResetting(u)} />
          <RowAction icon="trash" label="Şirketten çıkar" danger disabled={u.id === me?.id} onClick={() => setRemoving(u)} />
        </>} />
      <AddUserDialog open={adding} onClose={() => setAdding(false)} onSaved={reload} />
      <EditUserDialog user={editing} onClose={() => setEditing(null)} onSaved={reload} />
      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
      <ConfirmDialog open={!!removing} title="Şirketten çıkar" confirmLabel="Çıkar" message={<>{removing?.fullName} bu şirkete artık erişemeyecek. Hesabı silinmez; diğer şirketlerdeki erişimi sürer.</>}
        onConfirm={() => { const u = removing!; setRemoving(null); void act(() => send('DELETE', `/api/users/${u.id}`), 'Kullanıcı şirketten çıkarıldı.') }} onClose={() => setRemoving(null)} />
    </Section>
  )
}

function AddUserDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ fullName: '', email: '', password: '', role: 'Manager' as CompanyRole })
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (open) { setF({ fullName: '', email: '', password: '', role: 'Manager' }); setError(null) } }, [open])
  const save = async () => {
    try { await send('POST', '/api/users', f); toast.success('Kullanıcı eklendi.'); onSaved(); onClose() } catch (e) { setError(errorMessage(e)) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Kullanıcı Ekle" width="sm" footer={<><Button variant="secondary" onClick={onClose}>Vazgeç</Button><Button onClick={save}>Ekle</Button></>}>
      <FormGrid>
        <Field label="Ad soyad" required className="col-span-2"><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
        <Field label="E-posta" required className="col-span-2" hint="Kayıtlı bir e-postaysa mevcut hesap bu şirkete bağlanır"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="İlk şifre" hint="Yeni hesaplar için; en az 8 karakter, harf ve rakam"><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Field label="Rol"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as CompanyRole })}>{(Object.keys(ROLE_LABEL) as CompanyRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>
      </FormGrid>
      <FormError message={error} />
    </Modal>
  )
}

function EditUserDialog({ user, onClose, onSaved }: { user: CompanyUser | null; onClose: () => void; onSaved: () => void }) {
  const [role, setRole] = useState<CompanyRole>('Manager')
  const [active, setActive] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (user) { setRole(user.role); setActive(user.isActive); setError(null) } }, [user])
  const save = async () => {
    try { await send('PUT', `/api/users/${user!.id}`, { role, isActive: active }); toast.success('Kullanıcı güncellendi.'); onSaved(); onClose() } catch (e) { setError(errorMessage(e)) }
  }
  return (
    <Modal open={!!user} onClose={onClose} title={user?.fullName ?? ''} width="sm" footer={<><Button variant="secondary" onClick={onClose}>Vazgeç</Button><Button onClick={save}>Kaydet</Button></>}>
      <div className="space-y-3">
        <Segmented value={role} onChange={setRole} options={(Object.keys(ROLE_LABEL) as CompanyRole[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Hesap aktif <span className="text-[12px] text-[var(--text-muted)]">(pasif hesap hiçbir şirkete giriş yapamaz)</span></label>
      </div>
      <FormError message={error} />
    </Modal>
  )
}

function ResetPasswordDialog({ user, onClose }: { user: CompanyUser | null; onClose: () => void }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setPw(''); setError(null) }, [user])
  const save = async () => {
    try { await send('POST', `/api/users/${user!.id}/reset-password`, { newPassword: pw }); toast.success('Şifre sıfırlandı; kullanıcının açık oturumları kapandı.'); onClose() } catch (e) { setError(errorMessage(e)) }
  }
  return (
    <Modal open={!!user} onClose={onClose} title={`Şifre sıfırla · ${user?.fullName ?? ''}`} width="sm" footer={<><Button variant="secondary" onClick={onClose}>Vazgeç</Button><Button onClick={save} disabled={!pw}>Sıfırla</Button></>}>
      <Field label="Yeni şifre" hint="Kullanıcıya güvenli bir kanaldan iletin"><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
      <FormError message={error} />
    </Modal>
  )
}

// ---------------------------------------------------------------- bordro parametreleri
interface Bracket { upTo: number | null; rate: number }
interface PayrollParams {
  year: number; method: 'Statutory' | 'Approximate'; approxDeductionRate: number; minimumWageGross: number
  sgkEmployeeRate: number; unemploymentEmployeeRate: number; sgkEmployerRate: number; unemploymentEmployerRate: number
  stampTaxRate: number; sgkCeilingMultiplier: number; brackets: Bracket[]; applyMinimumWageExemption: boolean; isDefault: boolean
}

const pct = (v: number) => String(Math.round(v * 100000) / 1000).replace('.', ',')
const fromPct = (s: string) => (toNumber(s) || 0) / 100

function PayrollSettings({ canEdit }: { canEdit: boolean }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const { data, reload } = useApi<PayrollParams>(`/api/payrolls/settings/${year}`)
  const [p, setP] = useState<PayrollParams | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setP(data ?? null); setError(null) }, [data])
  if (!p) return <Section title="Bordro parametreleri"><div className="skeleton h-40" /></Section>
  const set = (patch: Partial<PayrollParams>) => setP({ ...p, ...patch })
  const save = async () => {
    try { await send('PUT', `/api/payrolls/settings/${year}`, p); toast.success(`${year} bordro parametreleri kaydedildi. Taslak bordroları "Puantajdan Hesapla" ile yenileyin.`); reload() } catch (e) { setError(errorMessage(e)) }
  }
  const rateField = (label: string, key: keyof PayrollParams, hint?: string) => (
    <Field label={label} hint={hint}><Input inputMode="decimal" disabled={!canEdit} value={pct(p[key] as number)} onChange={(e) => set({ [key]: fromPct(e.target.value) } as Partial<PayrollParams>)} /></Field>
  )
  return (
    <>
      <div className="mb-3 rounded-[14px] border border-[color-mix(in_srgb,var(--warning-text)_35%,transparent)] bg-[var(--warning-bg)] px-4 py-3 text-[12.5px] text-[var(--warning-text)]">
        <b>Önemli:</b> Varsayılan değerler bilgi amaçlıdır. Resmî bordro ve SGK bildirgesi öncesinde mali müşavirinize doğrulatın; teşvik, engellilik indirimi, AGİ gibi özel durumlar hesaplanmaz.
      </div>
      <Section title={`${year} bordro parametreleri`} description={p.isDefault ? 'Henüz kaydedilmedi: varsayılan değerler gösteriliyor.' : 'Bu şirket için kaydedilmiş değerler.'}
        footer={canEdit && <Button onClick={save}>Kaydet</Button>}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="!w-28">{[year - 1, year, year + 1].map((y) => <option key={y}>{y}</option>)}</Select>
          <Segmented value={p.method} onChange={(method) => canEdit && set({ method })} options={[{ value: 'Statutory', label: 'Mevzuata göre' }, { value: 'Approximate', label: 'Yaklaşık (sabit oran)' }]} />
        </div>
        {p.method === 'Approximate' ? (
          <FormGrid>{rateField('Kesinti oranı (%)', 'approxDeductionRate', 'Brütün bu oranı kesinti sayılır')}</FormGrid>
        ) : (
          <>
            <FormGrid>
              <Field label="Brüt asgari ücret (₺)" hint={`Net yaklaşık ${money(p.minimumWageGross * (1 - p.sgkEmployeeRate - p.unemploymentEmployeeRate))}`}>
                <Input inputMode="decimal" disabled={!canEdit} value={String(p.minimumWageGross).replace('.', ',')} onChange={(e) => set({ minimumWageGross: toNumber(e.target.value) || 0 })} />
              </Field>
              <Field label="SGK tavan katsayısı" hint={`Tavan: ${money(p.minimumWageGross * p.sgkCeilingMultiplier)}`}>
                <Input inputMode="decimal" disabled={!canEdit} value={String(p.sgkCeilingMultiplier).replace('.', ',')} onChange={(e) => set({ sgkCeilingMultiplier: toNumber(e.target.value) || 0 })} />
              </Field>
              {rateField('SGK işçi payı (%)', 'sgkEmployeeRate')}
              {rateField('İşsizlik işçi payı (%)', 'unemploymentEmployeeRate')}
              {rateField('SGK işveren payı (%)', 'sgkEmployerRate', '5 puan teşvikli oran varsayılandır')}
              {rateField('İşsizlik işveren payı (%)', 'unemploymentEmployerRate')}
              {rateField('Damga vergisi (%)', 'stampTaxRate')}
              <label className="flex items-center gap-2 self-end pb-2 text-[13px]"><input type="checkbox" disabled={!canEdit} checked={p.applyMinimumWageExemption} onChange={(e) => set({ applyMinimumWageExemption: e.target.checked })} /> Asgari ücret GV ve damga vergisi istisnası</label>
            </FormGrid>
            <p className="mb-2 mt-5 text-[12px] font-semibold text-[var(--text-muted)]">Gelir vergisi dilimleri (yıllık kümülatif matrah)</p>
            <div className="space-y-1.5">
              {p.brackets.map((b, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
                  <Input inputMode="decimal" disabled={!canEdit || b.upTo === null} value={b.upTo === null ? 'üzeri (sınırsız)' : String(b.upTo).replace('.', ',')}
                    onChange={(e) => set({ brackets: p.brackets.map((x, j) => (j === i ? { ...x, upTo: toNumber(e.target.value) || 0 } : x)) })} />
                  <Input inputMode="decimal" disabled={!canEdit} value={pct(b.rate)} onChange={(e) => set({ brackets: p.brackets.map((x, j) => (j === i ? { ...x, rate: fromPct(e.target.value) } : x)) })} />
                  <span className="text-[12px] text-[var(--text-muted)]">%</span>
                </div>
              ))}
            </div>
          </>
        )}
        <FormError message={error} />
      </Section>
    </>
  )
}

// ---------------------------------------------------------------- güvenlik
function SecuritySettings() {
  const replaceToken = useAuthStore((s) => s.replaceToken)
  const { lockMinutes, setLockMinutes } = useUiStore()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [next2, setNext2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const change = async () => {
    if (next !== next2) { setError('Yeni şifreler aynı değil.'); return }
    try {
      const r = await send<Parameters<typeof replaceToken>[0]>('POST', '/api/auth/change-password', { currentPassword: cur, newPassword: next })
      await replaceToken(r)
      setCur(''); setNext(''); setNext2(''); setError(null)
      toast.success('Şifre değiştirildi; diğer cihazlardaki oturumlar kapandı.')
    } catch (e) { setError(errorMessage(e)) }
  }
  return (
    <>
      <Section title="Şifreyi değiştir" footer={<Button onClick={change} disabled={!cur || !next}>Değiştir</Button>}>
        <FormGrid>
          <Field label="Mevcut şifre" className="col-span-2"><Input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
          <Field label="Yeni şifre" hint="En az 8 karakter, harf ve rakam"><Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
          <Field label="Yeni şifre (tekrar)"><Input type="password" autoComplete="new-password" value={next2} onChange={(e) => setNext2(e.target.value)} /></Field>
        </FormGrid>
        <FormError message={error} />
      </Section>
      <Section title="Otomatik kilit" description="Bilgisayar başında değilken verilerinizi korur. Kilit ekranında şifrenizle devam edersiniz.">
        <Segmented value={String(lockMinutes)} onChange={(v) => setLockMinutes(Number(v))}
          options={[{ value: '5', label: '5 dk' }, { value: '15', label: '15 dk' }, { value: '30', label: '30 dk' }, { value: '60', label: '1 saat' }, { value: '0', label: 'Kapalı' }]} />
        <p className="mt-3 text-[12px] text-[var(--text-muted)]">İstediğiniz an kilitlemek için {window.api?.platform === 'darwin' ? '⌘L' : 'Ctrl+L'}.</p>
      </Section>
    </>
  )
}

// ---------------------------------------------------------------- otomatik yedek
function BackupSettings() {
  const { autoBackup, keepBackups, setAutoBackup } = useUiStore()
  return (
    <Section title="Otomatik yedek" description="Uygulama açıkken her şirketin yedeği günde bir kez sessizce Belgeler/MiniErp-Yedek klasörüne alınır.">
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={autoBackup} onChange={(e) => setAutoBackup(e.target.checked)} /> Otomatik yedek açık</label>
      <div className="mt-4 flex items-center gap-3 text-[13px]">
        <span>Şirket başına saklanacak yedek:</span>
        <Segmented value={String(keepBackups)} onChange={(v) => setAutoBackup(autoBackup, Number(v))} options={[{ value: '7', label: '7' }, { value: '30', label: '30' }, { value: '90', label: '90' }, { value: '365', label: '365' }]} />
      </div>
      <p className="mt-3 text-[12px] text-[var(--text-muted)]">Daha eski yedekler kendiliğinden silinir. Elle aldığınız "Farklı kaydet" yedeklerine dokunulmaz.</p>
    </Section>
  )
}

// ---------------------------------------------------------------- sunucu
function DemoSettings() {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const reset = async () => {
    setBusy(true)
    const res = await window.api!.demo!.reset()
    setBusy(false)
    if (!res.ok) toast.error(res.error)
  }
  return (
    <>
      <Section title="Demo sürüm" description="Bu kopya sunucusuz çalışır: uygulama kendi içindeki sunucuyu bu bilgisayarda başlatır ve verileri yerel bir dosyada tutar. Veriler örnektir, internete gönderilmez.">
        <ul className="space-y-1.5 text-[13px] text-[var(--text-2)]">
          <li className="flex gap-2"><Icon name="check" size={15} className="mt-0.5 shrink-0 text-[var(--good-text)]" />Tüm ekranlar ve özellikler gerçek sürümle aynıdır; Excel içe/dışa aktarım ve yedekler de çalışır.</li>
          <li className="flex gap-2"><Icon name="check" size={15} className="mt-0.5 shrink-0 text-[var(--good-text)]" />Yaptığınız değişiklikler bu bilgisayarda saklanır; uygulamayı kapatıp açınca kaldığınız yerden devam edersiniz.</li>
          <li className="flex gap-2"><Icon name="info" size={15} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />Canlı sürümde veriler şirketinize ait güvenli bir sunucuda tutulur ve birden fazla kişi aynı anda çalışabilir.</li>
        </ul>
      </Section>
      <Section title="Demo verilerini sıfırla" description="Tüm değişiklikler silinir ve uygulama ilk açıldığı hâldeki örnek verilerle yeniden kurulur."
        footer={<Button variant="secondary" icon="refresh" disabled={busy} onClick={() => setConfirm(true)}>{busy ? 'Kuruluyor…' : 'Demoyu Baştan Kur'}</Button>}>
        <p className="text-[12.5px] text-[var(--text-muted)]">Giriş bilgileri sıfırlamadan sonra da aynıdır: yonetici@ornek.com · MiniErp2026!</p>
      </Section>
      <ConfirmDialog open={confirm} title="Demo baştan kurulsun mu?" confirmLabel="Baştan Kur" busy={busy}
        message="Demoda yaptığınız tüm değişiklikler silinecek ve örnek veriler yeniden oluşturulacak."
        onClose={() => setConfirm(false)} onConfirm={() => { setConfirm(false); void reset() }} />
    </>
  )
}

function ServerSettings() {
  const [url, setUrl] = useState(session.server)
  return (
    <Section title="Sunucu bağlantısı" description="Uygulamanın verilerini tuttuğu sunucu (API) adresi. Kurulumu yapan kişi size bildirir."
      footer={<><Button variant="ghost" onClick={() => { session.setServer(''); location.reload() }}>Varsayılana dön</Button><Button onClick={() => { session.setServer(url); location.reload() }}>Kaydet ve yeniden bağlan</Button></>}>
      <Field label="Sunucu adresi" hint={`Varsayılan: ${session.defaultServer}`}><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://erp.sirketiniz.com" /></Field>
      {url.startsWith('http://') && !url.includes('localhost') && <p className="mt-2 text-[12px] text-[var(--critical-text)]">Uyarı: şifreli olmayan (http) bağlantı. Gerçek kullanımda https kullanın.</p>}
    </Section>
  )
}
