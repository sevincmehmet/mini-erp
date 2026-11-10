const { app } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

const MAX_PAYLOAD_BYTES = 50 * 1024 * 1024 // 50 MB üst sınır

function backupDir() {
  return path.join(app.getPath('documents'), 'MiniErp-Yedek')
}

/** Dosya adında kullanılamayacak karakterleri temizler (ör. "Solar 7 / A.Ş." → "Solar-7-A.S"). */
function safeName(value) {
  return String(value ?? 'sirket')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'sirket'
}

function timestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`
}

/**
 * Atomik yazım: önce geçici dosyaya yaz, sonra yeniden adlandır.
 * Yazma sırasında elektrik kesilse bile mevcut yedek bozulmaz.
 */
async function writeFileAtomic(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tmp = `${filePath}.${process.pid}.tmp`
  await fs.writeFile(tmp, data)
  await fs.rename(tmp, filePath)
}

/** Renderer'dan gelen veri asla körü körüne güvenilmez. */
function assertPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Geçersiz yedek verisi.')
  }
  if (!payload.company || typeof payload.company.name !== 'string') {
    throw new Error('Yedek verisinde şirket bilgisi eksik.')
  }
}

module.exports = { MAX_PAYLOAD_BYTES, backupDir, safeName, timestamp, writeFileAtomic, assertPayload }
