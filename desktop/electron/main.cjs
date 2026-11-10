// Electron ana süreci (main process): pencereyi oluşturur, işletim sistemi
// kaynaklarına (dosya sistemi, diyaloglar) yalnızca bu süreç erişir.
const { app, BrowserWindow, shell, ipcMain, nativeTheme, dialog } = require('electron')
const demo = require('./demo.cjs')
const { registerSystemHandlers } = require('./ipc/system.cjs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { registerBackupHandlers } = require('./ipc/backup.cjs')
const { registerExcelHandlers } = require('./ipc/excel.cjs')

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const isDev = Boolean(DEV_SERVER_URL)

// Aynı anda iki pencere açılıp aynı yedek dosyasına yazmasın
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

/** @type {BrowserWindow | null} */
let mainWindow = null

/** Windows pencere düğmelerinin rengi tema ile uyumlu (alt katman rengi) */
function overlayFor(dark) {
  return { color: dark ? '#0e0e10' : '#e8e8ed', symbolColor: dark ? '#f5f5f7' : '#1d1d1f', height: 52 }
}

function loadApp() {
  if (!mainWindow) return
  if (isDev) mainWindow.loadURL(DEV_SERVER_URL)
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

function createWindow({ splash = false } = {}) {
  const isMac = process.platform === 'darwin'
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    // macOS: trafik ışıkları içerikte. Windows/Linux: başlık gizli, pencere düğmeleri üst çubuğun sağında (overlay)
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac
      ? { vibrancy: 'sidebar', visualEffectState: 'active', backgroundColor: '#00000000' }
      : { titleBarOverlay: overlayFor(nativeTheme.shouldUseDarkColors), backgroundColor: nativeTheme.shouldUseDarkColors ? '#0e0e10' : '#e8e8ed' }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,  // renderer ile preload ayrı JS dünyalarında
      nodeIntegration: false,  // renderer'da require/fs YOK
      sandbox: true,           // renderer işletim sistemi seviyesinde kum havuzunda
      webSecurity: true,
      spellcheck: false,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  if (splash) mainWindow.loadURL(demo.splashHtml(nativeTheme.shouldUseDarkColors))
  else loadApp()
  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' })

  // Uygulama içinde dış sitelere gidilmesini engelle; bağlantılar varsayılan tarayıcıda açılsın
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  // Pencereye dosya sürüklendiğinde Chromium dosyayı açmaya çalışır; yalnızca uygulamanın kendi sayfasına izin ver
  const appUrl = isDev ? DEV_SERVER_URL : pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).href
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(appUrl)) event.preventDefault()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.whenReady().then(() => {
  // Uygulamada seçilen tema yerel pencere malzemesine (vibrancy, menüler, diyaloglar) de uygulanır
  ipcMain.handle('app:set-theme', (_event, theme) => {
    if (!['system', 'light', 'dark'].includes(theme)) return
    nativeTheme.themeSource = theme
    if (process.platform !== 'darwin' && mainWindow) mainWindow.setTitleBarOverlay(overlayFor(nativeTheme.shouldUseDarkColors))
  })
  registerSystemHandlers(() => mainWindow)
  registerBackupHandlers(() => mainWindow)
  registerExcelHandlers(() => mainWindow)
  demo.registerDemoHandlers(() => mainWindow)

  if (demo.isDemo()) {
    // Sunucusuz demo: önce yerel API'yi başlat, hazır olunca uygulamayı yükle
    createWindow({ splash: true })
    demo.start().then(loadApp).catch((err) => {
      dialog.showErrorBox('Demo başlatılamadı', `${err.message}\n\nAyrıntılar: ${path.join(demo.dataDir(), 'sunucu.log')}`)
      app.quit()
    })
  } else {
    createWindow()
  }

  // Kurulu sürümde güncelleme kontrolü (yayın sunucusu package.json > build.publish ile ayarlanır)
  // Yalnızca kurulum paketinde (app-update.yml varsa); "--dir" test derlemesinde ve demoda atlanır
  if (!demo.isDemo() && app.isPackaged && require('node:fs').existsSync(path.join(process.resourcesPath, 'app-update.yml'))) {
    try {
      const { autoUpdater } = require('electron-updater')
      autoUpdater.logger = null
      autoUpdater.checkForUpdatesAndNotify().catch(() => {})
    } catch { /* güncelleme sunucusu tanımlı değil */ }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
