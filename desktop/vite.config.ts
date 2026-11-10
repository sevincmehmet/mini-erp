import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Production derlemesine sıkı bir Content-Security-Policy ekler.
 * Dev'de eklenmez; çünkü Vite'ın HMR'ı inline script kullanır.
 */
function cspPlugin(): Plugin {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    // Sunucu adresi uygulama içinden (Ayarlar → Sunucu) değiştirilebildiği için tek bir kökene bağlanmaz.
    // Asıl koruma script-src 'self': dışarıdan kod yüklenemez.
    "connect-src 'self' https: http:",
  ].join('; ')
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`),
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cspPlugin()],
  // Paketlenmiş uygulamada index.html file:// ile açıldığında varlık yolları göreli olmalı
  base: './',
  server: { port: 5173, strictPort: true },
})
