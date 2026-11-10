// Sistem işlemleri: güvenli oturum saklama, PDF dışa aktarım, Excel dosyası izleme.
const { app, ipcMain, dialog, safeStorage } = require('electron')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const { backupDir, safeName, timestamp, writeFileAtomic } = require('./shared.cjs')
const { wrap } = require('./backup.cjs')
const { parseBytes } = require('./excel.cjs')

const sessionFile = () => path.join(app.getPath('userData'), 'session.bin')

/** İzlenen Excel dosyaları: yalnızca bu listedeki yollar diskten okunabilir (rastgele dosya okunmasın). */
const watched = new Map() // path -> FSWatcher

function registerSystemHandlers(getWindow) {
  // ---------------------------------------------------------------- "Beni hatırla"
  // Oturum anahtarı işletim sisteminin anahtar zinciriyle (macOS Keychain, Windows DPAPI) şifrelenir.
  ipcMain.handle('secure:set', wrap(async (_e, value) => {
    if (typeof value !== 'string' || value.length > 20000) throw new Error('Geçersiz değer.')
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Bu sistemde güvenli saklama kullanılamıyor.')
    await writeFileAtomic(sessionFile(), safeStorage.encryptString(value))
    return {}
  }))
  ipcMain.handle('secure:get', wrap(async () => {
    try {
      const buf = await fsp.readFile(sessionFile())
      return { value: safeStorage.decryptString(buf) }
    } catch {
      return { value: null }
    }
  }))
  ipcMain.handle('secure:clear', wrap(async () => {
    await fsp.rm(sessionFile(), { force: true })
    return {}
  }))

  // ---------------------------------------------------------------- PDF
  /** Açık sayfayı PDF olarak kaydeder (yazdırma stilleri: kenar çubuğu ve düğmeler gizlenir). */
  ipcMain.handle('pdf:export-page', wrap(async (_e, payload) => {
    const win = getWindow()
    if (!win) throw new Error('Pencere bulunamadı.')
    const name = `${safeName(payload?.title ?? 'rapor')}-${timestamp()}.pdf`
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'PDF olarak kaydet', defaultPath: path.join(backupDir(), name), filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (canceled || !filePath) return { canceled: true }
    const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', landscape: !!payload?.landscape, margins: { marginType: 'custom', top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 } })
    await writeFileAtomic(filePath, pdf)
    return { filePath }
  }))

  // ---------------------------------------------------------------- Excel dosyası izleme
  ipcMain.handle('watch:set', wrap(async (_e, paths) => {
    const wanted = new Set((Array.isArray(paths) ? paths : []).filter((p) => typeof p === 'string' && /\.(xlsx|xlsm|csv)$/i.test(p)))
    for (const [p, w] of watched) if (!wanted.has(p)) { w.close(); watched.delete(p) }
    for (const p of wanted) {
      if (watched.has(p) || !fs.existsSync(p)) continue
      let timer = null
      // Excel kaydederken dosyayı birkaç kez yazar: 1,5 sn sakinleşmesini bekle
      const w = fs.watch(p, () => {
        clearTimeout(timer)
        timer = setTimeout(() => getWindow()?.webContents.send('watch:changed', p), 1500)
      })
      w.on('error', () => { w.close(); watched.delete(p) })
      watched.set(p, w)
    }
    return { watching: [...watched.keys()] }
  }))

  /** İzlenen dosyanın güncel hâlini okur (excel:parse ile aynı biçimde). */
  ipcMain.handle('excel:read-watched', wrap(async (_e, filePath) => {
    if (!watched.has(filePath)) throw new Error('Bu dosya izlenmiyor.')
    const bytes = await fsp.readFile(filePath)
    return parseBytes(path.basename(filePath), bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  }))
}

module.exports = { registerSystemHandlers }
