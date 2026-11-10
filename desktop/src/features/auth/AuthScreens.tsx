import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Avatar, Button, cx } from '../../components/ui/Glass'
import { Icon } from '../../components/ui/Icons'
import { Field, FormError, Input } from '../../components/ui/Form'
import { errorMessage } from '../../lib/apiClient'
import { session } from '../../lib/session'
import { useAuthStore } from '../../stores/useAuthStore'
import { useTourStore } from '../../stores/useTourStore'
import { ProductTour } from '../tour/ProductTour'

export const DEMO_EMAIL = 'yonetici@ornek.com'
export const DEMO_PASSWORD = 'MiniErp2026!'

/** Giriş/kurulum ekranlarının ortak zemini: ortada buzlu cam kart, arkada yumuşak ışıma. */
function AuthShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const tour = useTourStore()
  return (
    <div className="drag relative grid h-screen place-items-center overflow-hidden bg-[var(--base-bg)] p-6">
      {/* Uygulama tanıtımı: giriş yapmadan önce de görülebilir */}
      <button onClick={tour.show}
        className={cx('absolute top-4 z-10 inline-flex h-9 items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--modal-bg)] pl-2 pr-3.5 text-[13px] font-medium shadow-[var(--shadow-card)] backdrop-blur-xl transition hover:bg-[var(--bg-elev)]',
          window.api?.platform === 'darwin' || !window.api ? 'right-5' : 'right-[150px]')}>
        <span className="grid size-6 place-items-center rounded-full bg-[var(--accent)] text-white"><Icon name="help" size={15} /></span>
        Uygulamayı Tanı
      </button>
      <ProductTour open={tour.open} onClose={tour.hide} />
      <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 size-[520px] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,#0a84ff_22%,transparent),transparent_70%)]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 -right-40 size-[560px] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,#ff9f0a_20%,transparent),transparent_70%)]" />
      <div className={cx('animate-pop relative w-full rounded-[24px] border border-[var(--glass-border)] bg-[var(--modal-bg)] p-8 shadow-[var(--shadow-pop)] backdrop-blur-2xl', wide ? 'max-w-lg' : 'max-w-sm')}>
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid size-14 place-items-center rounded-[16px] bg-[linear-gradient(145deg,#3a3a3c,#1d1d1f)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_24px_rgba(0,0,0,0.25)]">
            <Icon name="layout" size={26} />
          </span>
          <p className="mt-3 text-[18px] font-semibold tracking-[-0.01em]">Mini-ERP</p>
          <p className="text-[12.5px] text-[var(--text-muted)]">Yönetim ve Finans</p>
        </div>
        {children}
      </div>
    </div>
  )
}

function ServerSetting() {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState(session.server)
  return (
    <div className="mt-5 text-center">
      {open ? (
        <div className="space-y-2 text-left">
          <Field label="Sunucu adresi" hint={`Varsayılan: ${session.defaultServer}`}>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://erp.sirketiniz.com" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Vazgeç</Button>
            <Button variant="secondary" onClick={() => { session.setServer(url); location.reload() }}>Kaydet ve Yenile</Button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-[12px] text-[var(--text-muted)] hover:text-[var(--text)]">
          <Icon name="gear" size={12} /> Sunucu: {session.server.replace(/^https?:\/\//, '')}
        </button>
      )}
    </div>
  )
}

export function LoginScreen() {
  const { login, notice } = useAuthStore()
  const demo = session.isDemo
  const [email, setEmail] = useState(() => { if (demo) return DEMO_EMAIL; try { return localStorage.getItem('minierp-last-email') ?? '' } catch { return '' } })
  const [password, setPassword] = useState(demo ? DEMO_PASSWORD : '')
  const showTour = useTourStore((s) => s.show)

  // Demo ilk açılışta tanıtımı kendiliğinden gösterir (bir kez)
  useEffect(() => {
    if (!demo) return
    try {
      if (localStorage.getItem('minierp-tour-seen')) return
      localStorage.setItem('minierp-tour-seen', '1')
    } catch { return }
    const t = setTimeout(showTour, 500)
    return () => clearTimeout(t)
  }, [demo, showTour])
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      try { localStorage.setItem('minierp-last-email', email.trim()) } catch { /* yok say */ }
      await login(email, password, remember)
    } catch (err) {
      setError(errorMessage(err))
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      <form onSubmit={submit} className="space-y-3">
        {notice && <p className="rounded-[10px] bg-[var(--warning-bg)] px-3 py-2 text-center text-[12.5px] text-[var(--warning-text)]">{notice}</p>}
        {demo && (
          <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--accent)_25%,transparent)] bg-[var(--accent-soft)] px-3.5 py-3 text-[12.5px] leading-relaxed text-[var(--accent-text)]">
            <p className="font-semibold">Demo sürüm</p>
            <p className="mt-0.5 text-[var(--text-2)]">Örnek verilerle dolu, sunucu gerektirmez; veriler yalnızca bu bilgisayarda tutulur. Demo hesabının bilgileri aşağıda hazır.</p>
          </div>
        )}
        <Field label="E-posta"><Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={!email} /></Field>
        <Field label="Şifre"><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus={!!email} /></Field>
        <label className="flex items-center gap-2 text-[12.5px] text-[var(--text-2)]">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Bu bilgisayarda oturumu hatırla
        </label>
        <FormError message={error} />
        <Button type="submit" className="!h-10 w-full" disabled={busy || !email || !password}>{busy ? 'Giriş yapılıyor…' : demo ? 'Demoyu Başlat' : 'Giriş Yap'}</Button>
      </form>
      {!demo && <ServerSetting />}
    </AuthShell>
  )
}

export function SetupScreen() {
  const setup = useAuthStore((s) => s.setup)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const strength = [password.length >= 8, /\d/.test(password), /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(password), password.length >= 12].filter(Boolean).length

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== password2) { setError('Şifreler aynı değil.'); return }
    setBusy(true)
    setError(null)
    try {
      await setup(fullName, email, password)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell wide>
      <div className="mb-5 text-center">
        <p className="text-[15px] font-semibold">Hoş geldiniz</p>
        <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">İlk kurulum: şirketlerinizin sahibi olacak hesabı oluşturun. Diğer kullanıcıları daha sonra Ayarlar'dan ekleyebilirsiniz.</p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Ad soyad"><Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus /></Field>
        <Field label="E-posta"><Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Şifre"><Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Field label="Şifre (tekrar)"><Input type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} /></Field>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className={cx('h-1 flex-1 rounded-full', i < strength ? (strength >= 3 ? 'bg-[var(--success)]' : 'bg-[var(--warning-text)]') : 'bg-[var(--hover-strong)]')} />)}</div>
          <span className="text-[11px] text-[var(--text-muted)]">En az 8 karakter, harf ve rakam</span>
        </div>
        <FormError message={error} />
        <Button type="submit" className="!h-10 w-full" disabled={busy || !fullName || !email || !password}>{busy ? 'Kuruluyor…' : 'Hesabı Oluştur ve Başla'}</Button>
      </form>
      <ServerSetting />
    </AuthShell>
  )
}

/** Belirli süre işlem yapılmayınca uygulama kilitlenir; veriler arkada bulanık kalır. */
export function LockScreen() {
  const { user, unlock, logout } = useAuthStore()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { setTimeout(() => input.current?.focus(), 50) }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await unlock(password)
    } catch (err) {
      setError(errorMessage(err))
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="drag animate-fade fixed inset-0 z-[90] grid place-items-center bg-black/30 p-6 backdrop-blur-2xl">
      <form onSubmit={submit} className="animate-pop w-full max-w-xs text-center text-white">
        <div className="mx-auto w-fit rounded-full ring-4 ring-white/20"><Avatar name={user?.fullName ?? '?'} size={72} /></div>
        <p className="mt-3 text-[17px] font-semibold drop-shadow">{user?.fullName}</p>
        <p className="text-[12px] text-white/75">Uygulama kilitlendi</p>
        <div className="mt-5 flex items-center gap-2">
          <input ref={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Şifre"
            className="h-10 flex-1 rounded-full border border-white/25 bg-white/15 px-4 text-[14px] text-white outline-none placeholder:text-white/60 focus:bg-white/20" />
          <button type="submit" disabled={busy || !password} aria-label="Kilidi aç" className="grid size-10 place-items-center rounded-full bg-white/90 text-black disabled:opacity-40">
            <Icon name="chevronRight" size={18} strokeWidth={2.2} />
          </button>
        </div>
        {error && <p className="mt-3 text-[12.5px] text-[#ffb4ae]">{error}</p>}
        <button type="button" onClick={() => logout()} className="mt-6 text-[12px] text-white/75 underline-offset-2 hover:underline">Başka kullanıcıyla giriş yap</button>
      </form>
    </div>
  )
}

/** Hareketsizlik sayacı: fare/klavye/kaydırma yoksa N dakika sonra kilitler. */
export function useIdleLock(minutes: number) {
  const lock = useAuthStore((s) => s.lock)
  const status = useAuthStore((s) => s.status)
  useEffect(() => {
    if (status !== 'ready' || minutes <= 0) return
    let timer = window.setTimeout(lock, minutes * 60_000)
    const reset = () => { window.clearTimeout(timer); timer = window.setTimeout(lock, minutes * 60_000) }
    const events = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    return () => { window.clearTimeout(timer); events.forEach((e) => window.removeEventListener(e, reset)) }
  }, [minutes, status, lock])
}
