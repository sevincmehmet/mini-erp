import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/ui/Icons'
import { BodyPortal } from '../../components/ui/Navbar'

/**
 * Sayfanın herhangi bir yerine dosya sürüklenince yakalar.
 * Yalnızca dosya sürüklemelerine tepki verir (sütun sürükleme gibi iç sürüklemeler etkilenmez).
 */
export function useFileDrop(onFile: (file: File) => void, enabled = true) {
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)
  const handler = useRef(onFile)
  handler.current = onFile

  useEffect(() => {
    if (!enabled) return
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth.current++; setDragging(true) }
    const over = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault() }
    const leave = (e: DragEvent) => { if (!hasFiles(e)) return; depth.current = Math.max(0, depth.current - 1); if (depth.current === 0) setDragging(false) }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current = 0
      setDragging(false)
      const file = e.dataTransfer?.files?.[0]
      if (file) handler.current(file)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [enabled])

  return dragging
}

export function DropOverlay({ show, title }: { show: boolean; title: string }) {
  if (!show) return null
  return (
    <BodyPortal>
    <div className="animate-fade pointer-events-none fixed inset-0 z-50 grid place-items-center p-8 backdrop-blur-[3px]" style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)' }}>
      <div className="animate-pop rounded-[28px] border-2 border-dashed border-[var(--accent)] bg-[var(--modal-bg)] px-14 py-10 text-center shadow-[var(--shadow-pop)]">
        <span className="mx-auto grid size-14 place-items-center rounded-[16px] bg-[var(--accent-soft)] text-[var(--accent-text)]"><Icon name="download" size={26} /></span>
        <p className="mt-3 text-[17px] font-semibold">Excel dosyasını bırakın</p>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">{title} olarak içe aktarılacak · .xlsx veya .csv</p>
      </div>
    </div>
    </BodyPortal>
  )
}
