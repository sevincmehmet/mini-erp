// Sunucusuz demo: API uygulamanın içinde gelir (resources/api) ve bu bilgisayarda,
// yalnızca 127.0.0.1 üzerinden, tek dosyalık bir SQLite veritabanıyla çalışır.
// İlk açılışta örnek veri kendiliğinden oluşturulur; "Demo verilerini sıfırla" ile baştan kurulur.
const { app, ipcMain } = require('electron')
const { spawn } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const net = require('node:net')
const path = require('node:path')

/** @type {import('node:child_process').ChildProcess | null} */
let child = null
let apiUrl = null
let quitting = false

function apiDir() {
  // Paketli: resources/api · Geliştirmede denemek için: MINIERP_DEMO_API=<yayınlanmış klasör>
  return app.isPackaged ? path.join(process.resourcesPath, 'api') : process.env.MINIERP_DEMO_API
}

function isDemo() {
  const dir = apiDir()
  return Boolean(dir && fs.existsSync(dir))
}

const dataDir = () => path.join(app.getPath('userData'), 'demo')

/** Kuruluma özel JWT anahtarı (ilk açılışta üretilir). */
function jwtKey() {
  const file = path.join(dataDir(), 'anahtar.txt')
  try { return fs.readFileSync(file, 'utf8').trim() } catch { /* ilk açılış */ }
  const key = crypto.randomBytes(48).toString('base64')
  fs.writeFileSync(file, key, { mode: 0o600 })
  return key
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

async function waitHealthy(url, timeoutMs) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    if (!child || child.exitCode !== null) throw new Error('Demo sunucusu beklenmedik şekilde kapandı.')
    try {
      const res = await fetch(`${url}/health`)
      if (res.ok) return
    } catch { /* henüz açılmadı */ }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('Demo sunucusu zamanında açılmadı.')
}

/** API'yi başlatır ve hazır olunca adresini döndürür. */
async function start() {
  fs.mkdirSync(dataDir(), { recursive: true })
  const port = await freePort()
  const url = `http://127.0.0.1:${port}`
  const dir = apiDir()
  const exe = path.join(dir, process.platform === 'win32' ? 'MiniErp.Api.exe' : 'MiniErp.Api')
  const log = fs.createWriteStream(path.join(dataDir(), 'sunucu.log'), { flags: 'w' })

  child = spawn(exe, ['--urls', url], {
    cwd: dir,
    windowsHide: true,
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Production',
      ConnectionStrings__Default: `Data Source=${path.join(dataDir(), 'demo.db')}`,
      Database__Provider: 'Sqlite',
      Demo__Enabled: 'true',
      Jwt__Key: jwtKey(),
      Https__Redirect: 'false',
      DOTNET_CLI_TELEMETRY_OPTOUT: '1',
      // Günlük yalnızca uyarı ve hatalar (her sorguyu yazmasın)
      Logging__LogLevel__Default: 'Warning',
      'Logging__LogLevel__Microsoft.EntityFrameworkCore': 'Warning',
    },
  })
  child.stdout.pipe(log)
  child.stderr.pipe(log)
  child.on('exit', (code) => {
    if (!quitting) log.write(`\n[sunucu kapandı: ${code}]\n`)
  })

  await waitHealthy(url, 90_000)
  apiUrl = url
  return url
}

function stop() {
  quitting = true
  if (child && child.exitCode === null) child.kill()
  child = null
}

/** Demo verilerini siler ve örnek veriyle yeniden kurar. */
async function reset() {
  stop()
  await new Promise((r) => setTimeout(r, 600)) // Windows'ta dosya kilidinin bırakılması için
  for (const f of ['demo.db', 'demo.db-wal', 'demo.db-shm']) fs.rmSync(path.join(dataDir(), f), { force: true })
  quitting = false
  return start()
}

function registerDemoHandlers(getWindow) {
  // Preload açılırken senkron sorar: demo mu, API nerede?
  ipcMain.on('demo:info', (event) => { event.returnValue = { enabled: isDemo(), apiUrl } })
  ipcMain.handle('demo:reset', async () => {
    try {
      await reset()
      getWindow()?.webContents.reload()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
  app.on('before-quit', stop)
}

/** API açılana kadar gösterilen hafif ekran. */
const splashHtml = (dark) => `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8">
<style>html,body{height:100%;margin:0;font:14px -apple-system,'Segoe UI',system-ui,sans-serif;background:${dark ? '#0e0e10' : '#e8e8ed'};color:${dark ? '#f5f5f7' : '#1d1d1f'};-webkit-app-region:drag}
.c{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
.s{width:28px;height:28px;border-radius:50%;border:3px solid ${dark ? '#3a3a3c' : '#d1d1d6'};border-top-color:#0a84ff;animation:r .9s linear infinite}
@keyframes r{to{transform:rotate(360deg)}}p{margin:0;opacity:.65}</style></head>
<body><div class="c"><div class="s"></div><b>Mini-ERP Demo hazırlanıyor…</b><p>İlk açılışta örnek veriler oluşturulur, birkaç saniye sürebilir.</p></div></body></html>`)}`

module.exports = { isDemo, start, stop, registerDemoHandlers, splashHtml, dataDir }
