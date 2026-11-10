// Preload: renderer (React) ile ana süreç arasındaki TEK köprü.
// Ham ipcRenderer asla dışarı verilmez; yalnızca beyaz listedeki işlemler açılır.
const { contextBridge, ipcRenderer, webUtils } = require('electron')

// Demo bilgisi açılışta bir kez alınır (API adresi sayfa yüklenmeden önce hazırdır)
const demoInfo = ipcRenderer.sendSync('demo:info')

contextBridge.exposeInMainWorld('api', {
  /** Sunucusuz demo: yerel API adresi ve demo verilerini sıfırlama. */
  demo: {
    enabled: Boolean(demoInfo?.enabled),
    apiUrl: demoInfo?.apiUrl ?? null,
    reset: () => ipcRenderer.invoke('demo:reset'),
  },
  backup: {
    /** Kaydet diyaloğu ile JSON yedek yazar. */
    saveJson: (payload) => ipcRenderer.invoke('backup:save-json', payload),
    /** Diyalogsuz, Belgeler/MiniErp-Yedek klasörüne tek tık yedek. */
    quickSave: (payload) => ipcRenderer.invoke('backup:quick-save', payload),
    /** Bir yedek dosyasını seçtirip içeriğini döndürür. */
    openJson: () => ipcRenderer.invoke('backup:open-json'),
    /** Yedek klasörünü Finder/Explorer'da açar. */
    revealFolder: () => ipcRenderer.invoke('backup:reveal-folder'),
    /** Şirketin yedek dosyaları (yeniden eskiye). */
    list: (companyName) => ipcRenderer.invoke('backup:list', companyName),
    /** En yeni N yedeği bırakıp eskileri siler. */
    prune: (payload) => ipcRenderer.invoke('backup:prune', payload),
    /** Yedek klasöründeki bir dosyayı okur. */
    read: (filePath) => ipcRenderer.invoke('backup:read', filePath),
  },
  excel: {
    /** Tüm şirket verisini çok sayfalı biçimli .xlsx olarak kaydeder. */
    export: (payload) => ipcRenderer.invoke('excel:export', payload),
    /** Ekrandaki tabloyu (görünen sütunlarla) .xlsx olarak kaydeder. */
    exportTable: (payload) => ipcRenderer.invoke('excel:export-table', payload),
    /** İçe aktarım için örnek şablon dosyası kaydeder. */
    saveTemplate: (payload) => ipcRenderer.invoke('excel:template', payload),
    /** .xlsx/.csv içeriğini (bayt olarak) okuyup sayfa/satır listesine çevirir. */
    parse: (payload) => ipcRenderer.invoke('excel:parse', payload),
    /** İzlenen bir dosyanın güncel hâlini okur. */
    readWatched: (filePath) => ipcRenderer.invoke('excel:read-watched', filePath),
  },
  /** Sürüklenen/seçilen dosyanın diskteki yolu (izleme için). */
  pathForFile: (file) => { try { return webUtils.getPathForFile(file) || null } catch { return null } },
  watch: {
    set: (paths) => ipcRenderer.invoke('watch:set', paths),
    onChanged: (callback) => {
      const listener = (_e, p) => callback(p)
      ipcRenderer.on('watch:changed', listener)
      return () => ipcRenderer.removeListener('watch:changed', listener)
    },
  },
  secure: {
    get: () => ipcRenderer.invoke('secure:get'),
    set: (value) => ipcRenderer.invoke('secure:set', value),
    clear: () => ipcRenderer.invoke('secure:clear'),
  },
  pdf: {
    /** Açık sayfayı PDF olarak kaydeder. */
    exportPage: (payload) => ipcRenderer.invoke('pdf:export-page', payload),
  },
  /** Uygulama temasını yerel pencereye uygular: 'system' | 'light' | 'dark' */
  setTheme: (theme) => ipcRenderer.invoke('app:set-theme', theme),
  platform: process.platform,
})
