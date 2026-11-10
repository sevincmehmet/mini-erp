import { useCallback, useEffect, useState } from 'react'

/**
 * 12 sütunlu bileşen ızgarasını kapsayıcının genişliğine uyarlar:
 * geniş alanda seçilen genişlik, orta genişlikte en az yarım satır, dar alanda tam satır.
 * `ref` bir geri çağırma (callback) ref'idir: ızgara veri geldikten sonra çizilse de ölçüm başlar.
 */
export function useGridSpan<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null)
  const [width, setWidth] = useState(1200)
  useEffect(() => {
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  const span = useCallback((size: number) => {
    if (width < 620) return 12
    if (width < 940) return size <= 6 ? 6 : 12
    return size
  }, [width])
  return { ref: setEl, span }
}
