import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './Icons'
import { NavbarPortal } from './Navbar'
import { Tooltip } from './Tooltip'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/** Kart yüzeyi: yarı saydam zemin, ince kenar, yumuşak gölge. */
export function GlassCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx('rounded-[18px] border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-card)] backdrop-blur-xl', className)}
      {...props}
    />
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({ className, variant = 'primary', icon, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: IconName }) {
  return (
    <button
      className={cx(
        'inline-flex h-8 shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 text-[13px] font-medium transition duration-150',
        'disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.97]',
        variant === 'primary' && 'bg-[var(--accent)] text-white shadow-[0_1px_2px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.18)] hover:brightness-[1.06]',
        variant === 'secondary' && 'border border-[var(--glass-border)] bg-[var(--bg-elev)] text-[var(--text)] shadow-[0_1px_1.5px_rgba(0,0,0,0.05)] hover:bg-[var(--hover)]',
        variant === 'ghost' && 'text-[var(--text-2)] hover:bg-[var(--hover)] hover:text-[var(--text)]',
        variant === 'danger' && 'bg-[var(--danger)] text-white hover:brightness-110',
        className,
      )}
      {...props}
    >
      {icon && <Icon name={icon} size={15} className="-ml-0.5" />}
      {children}
    </button>
  )
}

export function IconButton({ icon, label, className, active, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; active?: boolean }) {
  return (
    <Tooltip content={label}>
    <button aria-label={label}
      className={cx('grid size-8 shrink-0 place-items-center rounded-[10px] text-[var(--text-muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-40',
        active && 'bg-[var(--accent-soft)] text-[var(--accent-text)]', className)}
      {...props}>
      <Icon name={icon} size={16} />
    </button>
    </Tooltip>
  )
}

/**
 * Sayfa başlığı: başlık, alt başlık ve düğmeler üst gezinme çubuğuna yerleşir.
 * `toolbar` (dönem seçici, filtreler, toplu işlemler) panelin üstünde yapışkan durur.
 */
export function PageHeader({ title, subtitle, actions, toolbar, icon }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; toolbar?: ReactNode; icon?: ReactNode }) {
  return (
    <>
      <NavbarPortal>
        <NavbarTitle title={title} subtitle={subtitle} icon={icon} />
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </NavbarPortal>
      {toolbar && <div className="page-toolbar sticky top-0 z-20 mb-4 flex flex-wrap items-center gap-2 py-3">{toolbar}</div>}
    </>
  )
}

export function NavbarTitle({ title, subtitle, icon }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      {icon && <div className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-[var(--accent-soft)] text-[var(--accent-text)]">{icon}</div>}
      <div className="min-w-0 leading-tight">
        <h1 className="truncate text-[15px] font-semibold tracking-[-0.01em]">{title}</h1>
        {subtitle && <p className="truncate text-[11.5px] text-[var(--text-muted)]">{subtitle}</p>}
      </div>
    </div>
  )
}

export type Tone = 'accent' | 'income' | 'expense' | 'good' | 'warning' | 'info' | 'neutral'

const TONE: Record<Tone, { bg: string; fg: string; line: string }> = {
  accent: { bg: 'var(--accent-soft)', fg: 'var(--accent-text)', line: 'var(--accent)' },
  income: { bg: 'color-mix(in srgb, var(--series-income) 14%, transparent)', fg: 'var(--series-income)', line: 'var(--series-income)' },
  expense: { bg: 'color-mix(in srgb, var(--series-expense) 14%, transparent)', fg: 'var(--series-expense)', line: 'var(--series-expense)' },
  good: { bg: 'var(--good-bg)', fg: 'var(--good-text)', line: 'var(--good-text)' },
  warning: { bg: 'var(--warning-bg)', fg: 'var(--warning-text)', line: 'var(--warning-text)' },
  info: { bg: 'var(--info-bg)', fg: 'var(--info-text)', line: 'var(--info-text)' },
  neutral: { bg: 'var(--hover-strong)', fg: 'var(--text-2)', line: 'var(--text-muted)' },
}

/** Mini trend çizgisi: eksen yok, yalnızca yön ve son nokta. */
export function Sparkline({ values, color, width = 96, height = 30 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 4) + 2, height - 3 - ((v - min) / span) * (height - 6)])
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <path d={`${d} L${lx},${height} L2,${height} Z`} fill={color} opacity={0.1} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={2.75} fill={color} stroke="var(--glass-solid)" strokeWidth={1.5} />
    </svg>
  )
}

interface StatTileProps {
  label: string
  value: string
  hint?: ReactNode
  icon?: IconName
  tone?: Tone
  trend?: number[]
  /** Önceki döneme göre değişim (oran). goodWhenUp: artış iyi mi (gelir) kötü mü (gider) */
  delta?: { ratio: number; goodWhenUp: boolean; label: string }
  onClick?: () => void
}

export function StatTile({ label, value, hint, icon, tone = 'neutral', trend, delta, onClick }: StatTileProps) {
  const t = TONE[tone]
  const up = (delta?.ratio ?? 0) >= 0
  const good = delta ? up === delta.goodWhenUp : true
  const body = (
    <GlassCard className={cx('flex h-full flex-col p-4', onClick && 'transition hover:-translate-y-px hover:shadow-[var(--shadow-pop)]')}>
      <div className="flex items-center gap-2.5">
        {icon && <span className="grid size-7 shrink-0 place-items-center rounded-[9px]" style={{ background: t.bg, color: t.fg }}><Icon name={icon} size={15} /></span>}
        <p className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--text-muted)]">{label}</p>
        {trend && <Sparkline values={trend} color={t.line} width={64} height={22} />}
        {onClick && !trend && <Icon name="chevronRight" size={14} className="text-[var(--text-faint)]" />}
      </div>
      <p className="mt-3 truncate text-[clamp(19px,2.1vw,25px)] font-semibold leading-none tracking-[-0.02em] tabular-nums" title={value}>{value}</p>
      {(hint || delta) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
          {delta && Number.isFinite(delta.ratio) && (
            <span className={cx('inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium tabular-nums',
              good ? 'bg-[var(--good-bg)] text-[var(--good-text)]' : 'bg-[var(--critical-bg)] text-[var(--critical-text)]')}>
              <Icon name={up ? 'trendUp' : 'trendDown'} size={12} strokeWidth={2} />
              %{Math.abs(delta.ratio * 100).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
            </span>
          )}
          {delta && <span>{delta.label}</span>}
          {hint && <span className="truncate">{hint}</span>}
        </div>
      )}
    </GlassCard>
  )
  return onClick ? <button className="h-full w-full text-left" onClick={onClick}>{body}</button> : body
}

/** macOS tarzı segment kontrol. */
export function Segmented<T extends string>({ value, options, onChange, size = 'md' }: { value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" className="inline-flex rounded-[10px] bg-[var(--hover-strong)] p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            'inline-flex items-center justify-center gap-1 rounded-[7px] transition duration-150',
            size === 'sm' ? 'h-6 px-2 text-[12px]' : 'h-7 px-3 text-[13px]',
            o.value === value ? 'bg-[var(--segment-active)] font-medium text-[var(--text)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const BADGE_TONES = {
  neutral: 'bg-[var(--hover-strong)] text-[var(--text-2)]',
  good: 'bg-[var(--good-bg)] text-[var(--good-text)]',
  warning: 'bg-[var(--warning-bg)] text-[var(--warning-text)]',
  critical: 'bg-[var(--critical-bg)] text-[var(--critical-text)]',
  info: 'bg-[var(--info-bg)] text-[var(--info-text)]',
} as const

export function Badge({ tone = 'neutral', dot, children }: { tone?: keyof typeof BADGE_TONES; dot?: boolean; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium', BADGE_TONES[tone])}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export function Pager({ label, onPrev, onNext, onToday }: { label: string; onPrev: () => void; onNext: () => void; onToday?: () => void }) {
  return (
    <div className="inline-flex items-center rounded-[10px] border border-[var(--glass-border)] bg-[var(--bg-elev)] p-0.5 shadow-[0_1px_1.5px_rgba(0,0,0,0.05)]">
      <button aria-label="Önceki" onClick={onPrev} className="grid size-7 place-items-center rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"><Icon name="chevronLeft" size={15} /></button>
      <span className="min-w-36 px-2 text-center text-[13px] font-medium tabular-nums">{label}</span>
      <button aria-label="Sonraki" onClick={onNext} className="grid size-7 place-items-center rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"><Icon name="chevronRight" size={15} /></button>
      {onToday && <><span className="mx-0.5 h-4 w-px bg-[var(--glass-border)]" /><button onClick={onToday} className="h-7 rounded-[8px] px-2.5 text-[12.5px] font-medium text-[var(--accent-text)] hover:bg-[var(--hover)]">Bugün</button></>}
    </div>
  )
}

/** Yükleniyor durumunda içerik iskeleti; hata ve boş durumlar için sade mesajlar. */
export function LoadState({ loading, error, empty, rows = 6 }: { loading?: boolean; error?: string; empty?: boolean; rows?: number }) {
  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <span className="grid size-10 place-items-center rounded-full bg-[var(--critical-bg)] text-[var(--critical-text)]"><Icon name="info" size={18} /></span>
        <p className="text-[13px] font-medium">Veri alınamadı</p>
        <p className="max-w-md text-[12px] text-[var(--text-muted)]">{error}</p>
      </div>
    )
  }
  if (loading) {
    return (
      <div className="space-y-3 p-3" aria-busy="true" aria-label="Yükleniyor">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton size-7 rounded-full" />
            <div className="skeleton h-3 flex-1" style={{ maxWidth: `${70 - (i % 3) * 12}%` }} />
            <div className="skeleton h-3 w-20" />
          </div>
        ))}
      </div>
    )
  }
  if (empty) return <p className="py-10 text-center text-sm text-[var(--text-muted)]">Kayıt yok.</p>
  return null
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block">
      <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-60 rounded-[10px] border border-[var(--glass-border)] bg-[var(--bg-elev)] pl-8 pr-3 text-[13px] shadow-[0_1px_1.5px_rgba(0,0,0,0.04)] outline-none transition placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:ring-[3px] focus:ring-[var(--accent-soft)]"
      />
    </label>
  )
}

/** Ada göre sabit renk alan baş harf avatarı. */
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/)
  const initials = `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toLocaleUpperCase('tr')
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const color = `var(--series-${(h % 8) + 1})`
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
      {initials}
    </span>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-[var(--glass-border)] bg-[var(--bg-elev)] px-1 font-sans text-[10.5px] font-medium text-[var(--text-muted)] shadow-[0_1px_0_var(--glass-border)]">{children}</kbd>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-1 flex items-center justify-between">
      <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">{children}</h2>
      {action}
    </div>
  )
}
