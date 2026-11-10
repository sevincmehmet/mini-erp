import { useEffect, useState } from 'react'
import { Button, cx } from '../../components/ui/Glass'
import { Icon } from '../../components/ui/Icons'
import { BodyPortal } from '../../components/ui/Navbar'
import type { BuiltinPage } from '../../stores/useNavStore'
import { TOUR } from './tourContent'

interface Props {
  open: boolean
  onClose: () => void
  /** Uygulama içindeyken verilir: "Bu ekranı aç" düğmesi görünür */
  onGo?: (page: BuiltinPage) => void
}

const isDemo = () => Boolean(window.api?.demo?.enabled)

/**
 * Uygulama tanıtımı: solda bölümler, sağda gerçek ekran görüntüsü ve kısa açıklama.
 * Giriş ekranındaki "?" düğmesinden ve uygulama içindeki yardım düğmesinden açılır.
 */
export function ProductTour({ open, onClose, onGo }: Props) {
  const [index, setIndex] = useState(0)
  const chapter = TOUR[index]
  const last = index === TOUR.length - 1

  useEffect(() => { if (open) setIndex(0) }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(TOUR.length - 1, i + 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <BodyPortal>
      <div className="no-drag animate-fade fixed inset-0 z-50 grid place-items-center bg-black/40 p-6 backdrop-blur-[6px]"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div role="dialog" aria-modal="true" aria-label="Uygulama tanıtımı"
          className="animate-pop flex h-[min(740px,92vh)] w-full max-w-[1180px] overflow-hidden rounded-[24px] border border-[var(--glass-border)] bg-[var(--modal-bg)] shadow-[var(--shadow-pop)] backdrop-blur-2xl">

          {/* Bölümler */}
          <nav className="flex w-[248px] shrink-0 flex-col border-r border-[var(--glass-border)] bg-[var(--hover)] p-3">
            <div className="flex items-center gap-2.5 px-2 pb-4 pt-2">
              <span className="grid size-9 place-items-center rounded-[11px] bg-[linear-gradient(145deg,#3a3a3c,#1d1d1f)] text-white"><Icon name="layout" size={18} /></span>
              <div className="leading-tight">
                <p className="text-[14px] font-semibold">Mini-ERP</p>
                <p className="text-[11.5px] text-[var(--text-muted)]">Uygulama tanıtımı</p>
              </div>
            </div>
            <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
              {TOUR.map((c, i) => (
                <li key={c.id}>
                  <button onClick={() => setIndex(i)} aria-current={i === index ? 'step' : undefined}
                    className={cx('flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] transition',
                      i === index ? 'bg-[var(--bg-elev)] font-medium text-[var(--text)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-[var(--text-2)] hover:bg-[var(--hover-strong)]')}>
                    <span className={cx('grid size-6 shrink-0 place-items-center rounded-[7px]', i === index ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)]')}>
                      <Icon name={c.icon} size={14} />
                    </span>
                    <span className="truncate">{c.label}</span>
                  </button>
                </li>
              ))}
            </ol>
            {isDemo() && (
              <div className="mt-3 rounded-[12px] bg-[var(--warning-bg)] px-3 py-2.5 text-[11.5px] leading-relaxed text-[var(--warning-text)]">
                <b>Demo sürüm.</b> Veriler örnektir ve yalnızca bu bilgisayarda tutulur. Gönül rahatlığıyla deneyin; Ayarlar → Demo'dan baştan kurabilirsiniz.
              </div>
            )}
          </nav>

          {/* İçerik */}
          <section className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-4 px-8 pt-7">
              <div key={chapter.id} className="animate-page min-w-0">
                <p className="text-[12px] font-medium text-[var(--accent-text)]">{index + 1} / {TOUR.length} · {chapter.label}</p>
                <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.02em]">{chapter.title}</h2>
                <p className="mt-2 max-w-[760px] text-[14px] leading-relaxed text-[var(--text-2)]">{chapter.lead}</p>
              </div>
              <button onClick={onClose} aria-label="Kapat" className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--hover-strong)] hover:text-[var(--text)]">
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 px-8 pt-4">
              {chapter.bullets.map((b) => (
                <span key={b} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[12.5px] text-[var(--accent-text)]">
                  <Icon name="check" size={13} /> {b}
                </span>
              ))}
            </div>

            {/* Ekran görüntüsü: uygulama penceresi çerçevesinde */}
            <div className="relative min-h-0 flex-1 px-8 pb-2 pt-5">
              <Screenshot key={chapter.id} src={chapter.image} alt={chapter.title} />
            </div>

            <footer className="flex items-center gap-3 border-t border-[var(--glass-border)] px-8 py-3.5">
              <div className="flex items-center gap-1.5" aria-hidden>
                {TOUR.map((c, i) => (
                  <span key={c.id} className={cx('h-1.5 rounded-full transition-all', i === index ? 'w-5 bg-[var(--accent)]' : 'w-1.5 bg-[var(--glass-border)]')} />
                ))}
              </div>
              <span className="ml-2 hidden text-[11.5px] text-[var(--text-faint)] lg:inline">← → tuşlarıyla gezinebilirsiniz</span>
              <div className="ml-auto flex items-center gap-2">
                {onGo && chapter.page && (
                  <Button variant="ghost" icon="chevronRight" onClick={() => { onGo(chapter.page!); onClose() }}>Bu ekranı aç</Button>
                )}
                <Button variant="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>Geri</Button>
                {last
                  ? <Button onClick={onClose}>{onGo ? 'Kullanmaya Başla' : 'Kapat'}</Button>
                  : <Button onClick={() => setIndex(index + 1)}>İleri</Button>}
              </div>
            </footer>
          </section>
        </div>
      </div>
    </BodyPortal>
  )
}

function Screenshot({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="animate-page flex h-full flex-col overflow-hidden rounded-[14px] border border-[var(--glass-border)] bg-[var(--base-bg)] shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b border-[var(--glass-border)] px-3" aria-hidden>
        <span className="size-2.5 rounded-full bg-[#ff5f57]" /><span className="size-2.5 rounded-full bg-[#febc2e]" /><span className="size-2.5 rounded-full bg-[#28c840]" />
      </div>
      {src && !failed
        ? <img src={`./tour/${src}`} alt={alt} onError={() => setFailed(true)} className="min-h-0 w-full flex-1 object-cover object-left-top" draggable={false} />
        : <div className="grid flex-1 place-items-center text-[var(--text-faint)]"><Icon name="layout" size={40} /></div>}
    </div>
  )
}
