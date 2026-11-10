import { toast } from '../stores/useToastStore'

/** Açık sayfayı PDF olarak kaydeder (Electron). Yazdırma stilleri kenar çubuğunu ve düğmeleri gizler. */
export async function exportPdf(title: string, landscape = false) {
  const bridge = window.api
  if (!bridge) return toast.error('PDF yalnızca masaüstü uygulamasında oluşturulabilir.')
  document.documentElement.dataset.printTitle = title
  const res = await bridge.pdf.exportPage({ title, landscape })
  if (!res.ok) toast.error(res.error)
  else if (!res.canceled) toast.success(`PDF kaydedildi: ${res.filePath}`)
}
