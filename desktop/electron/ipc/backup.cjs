const { ipcMain, dialog, shell } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const { MAX_PAYLOAD_BYTES, backupDir, safeName, timestamp, writeFileAtomic, assertPayload } = require('./shared.cjs')

const BACKUP_SCHEMA_VERSION = 1

/** Yedeği meta veri ile sarar; geri yüklerken sürüm kontrolü yapılabilir. */
function serialize(payload) {
  const doc = {
    meta: {
      app: 'MiniErp',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
    },
    data: payload,
  }
  const json = JSON.stringify(doc, null, 2)
  if (Buffer.byteLength(json, 'utf8') > MAX_PAYLOAD_BYTES) {
    throw new Error('Yedek boyutu sınırı aştı.')
  }
  return json
}

function defaultFileName(payload) {
  return `yedek-${safeName(payload.company.name)}-${timestamp()}.json`
}

/**
 * Tüm handler'lar { ok: true, ... } ya da { ok: false, error } döndürür.
 * Böylece renderer tarafında try/catch yerine sade bir sonuç kontrolü yeterli olur.
 */
function wrap(handler) {
  return async (event, ...args) => {
    try {
      return { ok: true, ...(await handler(event, ...args)) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

function registerBackupHandlers(getWindow) {
  ipcMain.handle('backup:save-json', wrap(async (_event, payload) => {
    assertPayload(payload)
    const win = getWindow()
    const options = {
      title: 'Yedeği Kaydet',
      defaultPath: path.join(backupDir(), defaultFileName(payload)),
      filters: [{ name: 'JSON Yedek', extensions: ['json'] }],
    }
    const { canceled, filePath } = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options)
    if (canceled || !filePath) return { canceled: true }

    await writeFileAtomic(filePath, serialize(payload))
    return { filePath }
  }))

  ipcMain.handle('backup:quick-save', wrap(async (_event, payload) => {
    assertPayload(payload)
    const filePath = path.join(backupDir(), defaultFileName(payload))
    await writeFileAtomic(filePath, serialize(payload))
    return { filePath }
  }))

  ipcMain.handle('backup:open-json', wrap(async () => {
    const win = getWindow()
    const options = {
      title: 'Yedek Aç',
      defaultPath: backupDir(),
      properties: ['openFile'],
      filters: [{ name: 'JSON Yedek', extensions: ['json'] }],
    }
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (canceled || filePaths.length === 0) return { canceled: true }

    const stat = await fs.stat(filePaths[0])
    if (stat.size > MAX_PAYLOAD_BYTES) throw new Error('Dosya çok büyük.')

    const doc = JSON.parse(await fs.readFile(filePaths[0], 'utf8'))
    if (doc?.meta?.app !== 'MiniErp') throw new Error('Bu dosya bir Mini-ERP yedeği değil.')
    if (doc.meta.schemaVersion > BACKUP_SCHEMA_VERSION) {
      throw new Error('Bu yedek daha yeni bir uygulama sürümüyle alınmış.')
    }
    return { filePath: filePaths[0], meta: doc.meta, data: doc.data }
  }))

  /** Bir şirketin klasördeki yedekleri (yeniden eskiye). */
  ipcMain.handle('backup:list', wrap(async (_event, companyName) => {
    await fs.mkdir(backupDir(), { recursive: true })
    const prefix = `yedek-${safeName(companyName)}-`
    const files = (await fs.readdir(backupDir())).filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    const items = await Promise.all(files.map(async (f) => {
      const st = await fs.stat(path.join(backupDir(), f))
      return { fileName: f, filePath: path.join(backupDir(), f), size: st.size, modifiedAt: st.mtime.toISOString() }
    }))
    return { items: items.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)) }
  }))

  /** Otomatik yedeklerde en yeni N dosyayı bırakıp eskileri siler. */
  ipcMain.handle('backup:prune', wrap(async (_event, payload) => {
    const keep = Math.max(3, Math.min(365, Number(payload?.keep) || 30))
    const prefix = `yedek-${safeName(payload?.companyName)}-`
    const files = (await fs.readdir(backupDir()).catch(() => [])).filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    const stats = await Promise.all(files.map(async (f) => ({ f, t: (await fs.stat(path.join(backupDir(), f))).mtimeMs })))
    const old = stats.sort((a, b) => b.t - a.t).slice(keep)
    for (const { f } of old) await fs.rm(path.join(backupDir(), f), { force: true })
    return { removed: old.length }
  }))

  /** Seçilen yedek dosyasını (listeden) okur. Yalnızca yedek klasöründeki dosyalar. */
  ipcMain.handle('backup:read', wrap(async (_event, filePath) => {
    const full = path.resolve(String(filePath))
    if (!full.startsWith(path.resolve(backupDir()) + path.sep)) throw new Error('Yalnızca yedek klasöründeki dosyalar açılabilir.')
    const doc = JSON.parse(await fs.readFile(full, 'utf8'))
    if (doc?.meta?.app !== 'MiniErp') throw new Error('Bu dosya bir Mini-ERP yedeği değil.')
    return { filePath: full, meta: doc.meta, data: doc.data }
  }))

  ipcMain.handle('backup:reveal-folder', wrap(async () => {
    await fs.mkdir(backupDir(), { recursive: true })
    const error = await shell.openPath(backupDir())
    if (error) throw new Error(error)
    return {}
  }))
}

module.exports = { registerBackupHandlers, wrap }
