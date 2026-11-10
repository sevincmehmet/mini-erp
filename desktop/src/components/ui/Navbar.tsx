import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Üst gezinme çubuğu (navbar) uygulama kabuğunda durur; sayfalar başlıklarını ve düğmelerini
 * oraya "portal" ile yerleştirir. Böylece her sayfa kendi başlığını yönetir ama başlık hep aynı yerde görünür.
 */
export const NavbarSlotContext = createContext<HTMLElement | null>(null)

export function NavbarPortal({ children }: { children: ReactNode }) {
  const slot = useContext(NavbarSlotContext)
  return slot ? createPortal(children, slot) : null
}

/** Pencereler, bindirmeler: sayfa içindeki dönüşümlerden etkilenmesin diye doğrudan body'ye çizilir. */
export function BodyPortal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body)
}
