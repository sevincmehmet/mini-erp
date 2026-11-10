import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from './Glass'

type Side = 'top' | 'right' | 'bottom' | 'left'

interface TooltipProps {
  content: ReactNode
  /** Kısayol ipucu, ör. "⌘K" */
  shortcut?: string
  side?: Side
  /** Kapalıysa yalnızca çocuğu çizer (ör. kenar çubuğu açıkken etiket zaten görünüyorsa). */
  disabled?: boolean
  /** Sarmalayıcı blok mu satır içi mi */
  block?: boolean
  className?: string
  children: ReactNode
}

// macOS gibi: bir ipucu az önce kapandıysa komşusuna geçerken beklemeden aç
let lastHiddenAt = 0
const OPEN_DELAY = 380
const WARM_WINDOW = 450
const GAP = 8

/**
 * Üzerine gelince / klavyeyle odaklanınca açılan ipucu.
 * body'ye çizilir (sayfa içi dönüşüm ve taşma kırpmalarından etkilenmez), pencereden taşarsa karşı yöne döner.
 */
export function Tooltip({ content, shortcut, side = 'top', disabled, block, className, children }: TooltipProps) {
  const id = useId()
  const anchor = useRef<HTMLSpanElement>(null)
  const tip = useRef<HTMLDivElement>(null)
  const timer = useRef<number>(undefined)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number; side: Side } | null>(null)

  const show = () => {
    if (disabled) return
    window.clearTimeout(timer.current)
    const warm = Date.now() - lastHiddenAt < WARM_WINDOW
    timer.current = window.setTimeout(() => setOpen(true), warm ? 0 : OPEN_DELAY)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    if (open) lastHiddenAt = Date.now()
    setOpen(false)
    setPos(null)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])
  useEffect(() => { if (disabled) hide() }, [disabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // Konum: önce istenen yön, sığmazsa tersi; kenarlardan 8px içeride tut
  useLayoutEffect(() => {
    if (!open || !anchor.current || !tip.current) return
    const a = anchor.current.getBoundingClientRect()
    const t = tip.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const fits = (s: Side) =>
      s === 'top' ? a.top - t.height - GAP > 0 : s === 'bottom' ? a.bottom + t.height + GAP < vh
      : s === 'right' ? a.right + t.width + GAP < vw : a.left - t.width - GAP > 0
    const opposite: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }
    const s = fits(side) ? side : opposite[side]
    let x = s === 'right' ? a.right + GAP : s === 'left' ? a.left - GAP - t.width : a.left + a.width / 2 - t.width / 2
    let y = s === 'bottom' ? a.bottom + GAP : s === 'top' ? a.top - GAP - t.height : a.top + a.height / 2 - t.height / 2
    x = Math.max(8, Math.min(vw - t.width - 8, x))
    y = Math.max(8, Math.min(vh - t.height - 8, y))
    setPos({ x, y, side: s })
  }, [open, side, content])

  // Kaydırma ya da pencere değişince kapat (konum bayatlamasın)
  useEffect(() => {
    if (!open) return
    const close = () => hide()
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <span ref={anchor} aria-describedby={open ? id : undefined}
        className={cx(block ? 'block' : 'inline-flex', className)}
        onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} onMouseDown={hide}>
        {children}
      </span>
      {open && !disabled && createPortal(
        <div ref={tip} id={id} role="tooltip"
          className="tooltip pointer-events-none fixed z-[100] flex max-w-64 items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[12px] font-medium leading-snug shadow-[0_6px_20px_rgba(0,0,0,0.18)]"
          data-side={pos?.side ?? side}
          style={{ left: pos?.x ?? -9999, top: pos?.y ?? -9999, opacity: pos ? 1 : 0 }}>
          <span>{content}</span>
          {shortcut && <span className="rounded-[4px] bg-white/15 px-1 text-[10.5px] font-semibold tracking-wide opacity-80">{shortcut}</span>}
        </div>,
        document.body,
      )}
    </>
  )
}
