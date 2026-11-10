const { ipcMain, dialog } = require('electron')
const path = require('node:path')
const ExcelJS = require('exceljs')
const { backupDir, safeName, timestamp, writeFileAtomic, assertPayload } = require('./shared.cjs')
const { wrap } = require('./backup.cjs')

const MONEY = '#,##0.00 "₺"'
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D1D1F' } }
const MAX_IMPORT_BYTES = 25 * 1024 * 1024
const MAX_IMPORT_ROWS = 20000
const MAX_IMPORT_COLS = 80

// ---------------------------------------------------------------------------
// Ortak biçimlendirme
// ---------------------------------------------------------------------------

/** Başlık satırı, sütun biçimleri, otomatik genişlik, filtre ve dondurulmuş başlık. */
function styleSheet(sheet, columns, rowCount) {
  const header = sheet.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = HEADER_FILL
  header.alignment = { vertical: 'middle' }
  header.height = 22

  columns.forEach((c, i) => {
    const col = sheet.getColumn(i + 1)
    if (c.type === 'money') col.numFmt = MONEY
    if (c.type === 'number') col.numFmt = '#,##0.##'
    if (c.type === 'date') col.numFmt = 'dd.mm.yyyy'
    let max = String(c.header).length
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = cell.value instanceof Date ? 10 : String(cell.value ?? '').length
      if (len > max) max = len
    })
    col.width = Math.min(Math.max(max + 2, 10), 60)
  })

  if (rowCount > 0) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
  }
}

function addTotals(sheet, columns, rowCount) {
  const totals = columns.filter((c) => c.total)
  if (rowCount === 0 || totals.length === 0) return
  const totalRow = sheet.addRow([])
  totalRow.getCell(1).value = 'TOPLAM'
  for (const c of totals) {
    const idx = columns.indexOf(c) + 1
    const letter = sheet.getColumn(idx).letter
    totalRow.getCell(idx).value = { formula: `SUM(${letter}2:${letter}${rowCount + 1})` }
  }
  totalRow.font = { bold: true }
  totalRow.border = { top: { style: 'thin' } }
}

function toCell(value, type) {
  if (value == null || value === '') return null
  if (type === 'date') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? String(value) : d
  }
  if (type === 'money' || type === 'number') {
    const n = Number(value)
    return Number.isFinite(n) ? n : String(value)
  }
  return value
}

async function askSavePath(getWindow, title, fileName) {
  const win = getWindow()
  const options = {
    title,
    defaultPath: path.join(backupDir(), fileName),
    filters: [{ name: 'Excel Çalışma Kitabı', extensions: ['xlsx'] }],
  }
  const { canceled, filePath } = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
  return canceled || !filePath ? null : filePath
}

async function saveWorkbook(workbook, filePath) {
  const buffer = await workbook.xlsx.writeBuffer()
  await writeFileAtomic(filePath, Buffer.from(buffer))
}

// ---------------------------------------------------------------------------
// Tam rapor (yedekleme ekranı)
// ---------------------------------------------------------------------------

const REPORT_SHEETS = [
  {
    key: 'employees', title: 'Personel',
    columns: [
      { header: 'Sicil No', key: 'employeeNumber' },
      { header: 'Ad', key: 'firstName' },
      { header: 'Soyad', key: 'lastName' },
      { header: 'Pozisyon', key: 'position' },
      { header: 'İşe Giriş', key: 'hireDate', type: 'date' },
      { header: 'Ücret Tipi', key: 'payType' },
      { header: 'Brüt Maaş', key: 'baseSalary', type: 'money' },
      { header: 'Saat Ücreti', key: 'hourlyRate', type: 'money' },
    ],
  },
  {
    key: 'timeEntries', title: 'Puantaj',
    columns: [
      { header: 'Çalışan Id', key: 'employeeId' },
      { header: 'Giriş', key: 'clockIn' },
      { header: 'Çıkış', key: 'clockOut' },
      { header: 'Mola (dk)', key: 'breakMinutes', type: 'number' },
      { header: 'Çalışılan Saat', key: 'workedHours', type: 'number', total: true },
      { header: 'Fazla Mesai', key: 'overtimeHours', type: 'number', total: true },
    ],
  },
  {
    key: 'payrolls', title: 'Bordrolar',
    columns: [
      { header: 'Yıl', key: 'year' },
      { header: 'Ay', key: 'month' },
      { header: 'Normal Saat', key: 'regularHours', type: 'number' },
      { header: 'Fazla Mesai', key: 'overtimeHours', type: 'number' },
      { header: 'Brüt', key: 'grossPay', type: 'money', total: true },
      { header: 'Net', key: 'netPay', type: 'money', total: true },
      { header: 'Durum', key: 'status' },
    ],
  },
  {
    key: 'transactions', title: 'Gelir-Gider',
    columns: [
      { header: 'Tarih', key: 'date', type: 'date' },
      { header: 'Tür', key: 'type' },
      { header: 'Açıklama', key: 'description' },
      { header: 'Belge No', key: 'documentNo' },
      { header: 'Tutar', key: 'amount', type: 'money', total: true },
    ],
  },
]

// ---------------------------------------------------------------------------
// İçe aktarım: .xlsx / .csv dosyasını satırlara çevirir
// ---------------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0')

/**
 * Excel hücresini sade bir değere çevirir.
 * exceljs tarihleri UTC olarak verir; UTC bileşenleri Excel'de görünen duvar saatidir.
 * Yalnız saat içeren hücreler (ör. 08:30) 1899-12-30 tarihli gelir → "08:30".
 */
function cellValue(value) {
  if (value == null) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    const y = value.getUTCFullYear()
    const time = `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`
    if (y <= 1900) return time
    const date = `${y}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`
    return time === '00:00' ? date : `${date} ${time}`
  }
  if (typeof value === 'object') {
    if ('result' in value) return cellValue(value.result)          // formül → sonucu
    if ('richText' in value) return value.richText.map((t) => t.text).join('')
    if ('text' in value) return String(value.text)                 // köprü
    if ('error' in value) return null
    return String(value)
  }
  if (typeof value === 'string') return value.trim() === '' ? null : value.trim()
  return value
}

async function parseXlsx(bytes) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(bytes)
  return workbook.worksheets
    .filter((ws) => ws.state !== 'hidden' && ws.state !== 'veryHidden')
    .map((ws) => {
      const rows = []
      const last = Math.min(ws.rowCount, MAX_IMPORT_ROWS + 50)
      for (let r = 1; r <= last; r++) {
        const row = ws.getRow(r)
        const cells = []
        const width = Math.min(row.cellCount, MAX_IMPORT_COLS)
        for (let c = 1; c <= width; c++) cells.push(cellValue(row.getCell(c).value))
        while (cells.length && cells[cells.length - 1] == null) cells.pop()
        rows.push(cells)
      }
      return { name: ws.name, rows, truncated: ws.rowCount > last }
    })
}

/** Türkçe Excel CSV'leri genelde ";" ayraçlı ve Windows-1254 kodludur; ikisini de tanır. */
function decodeCsv(bytes) {
  const buf = Buffer.from(bytes)
  const utf8 = new TextDecoder('utf-8').decode(buf)
  const text = utf8.includes('�') ? new TextDecoder('windows-1254').decode(buf) : utf8
  return text.replace(/^﻿/, '')
}

function parseCsv(bytes) {
  const text = decodeCsv(bytes)
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = [';', '\t', ','].map((d) => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0]

  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
      if (rows.length > MAX_IMPORT_ROWS + 50) break
    } else field += ch
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }

  const cleaned = rows.map((r) => {
    const cells = r.slice(0, MAX_IMPORT_COLS).map((v) => (v.trim() === '' ? null : v.trim()))
    while (cells.length && cells[cells.length - 1] == null) cells.pop()
    return cells
  })
  return [{ name: 'CSV', rows: cleaned, truncated: rows.length > MAX_IMPORT_ROWS + 50 }]
}

// ---------------------------------------------------------------------------

function registerExcelHandlers(getWindow) {
  // Yedekleme ekranındaki tam rapor
  ipcMain.handle('excel:export', wrap(async (_event, payload) => {
    assertPayload(payload)
    const filePath = await askSavePath(getWindow, "Excel'e Aktar", `rapor-${safeName(payload.company.name)}-${timestamp()}.xlsx`)
    if (!filePath) return { canceled: true }

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Mini-ERP'
    workbook.created = new Date()
    for (const def of REPORT_SHEETS) {
      const rows = Array.isArray(payload[def.key]) ? payload[def.key] : []
      const sheet = workbook.addWorksheet(def.title, { views: [{ state: 'frozen', ySplit: 1 }] })
      sheet.addRow(def.columns.map((c) => c.header))
      for (const row of rows) sheet.addRow(def.columns.map((c) => toCell(row[c.key], c.type)))
      addTotals(sheet, def.columns, rows.length)
      styleSheet(sheet, def.columns, rows.length)
    }
    await saveWorkbook(workbook, filePath)
    return { filePath }
  }))

  // Ekrandaki tabloyu (görünen sütunlar, seçilen sırayla) Excel'e kaydeder
  ipcMain.handle('excel:export-table', wrap(async (_event, payload) => {
    if (!payload || !Array.isArray(payload.columns) || !Array.isArray(payload.rows)) throw new Error('Geçersiz tablo verisi.')
    const filePath = await askSavePath(getWindow, "Excel'e Aktar", `${safeName(payload.fileName)}-${timestamp()}.xlsx`)
    if (!filePath) return { canceled: true }

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Mini-ERP'
    const sheet = workbook.addWorksheet(String(payload.sheetName ?? 'Liste').slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] })
    sheet.addRow(payload.columns.map((c) => c.header))
    for (const row of payload.rows) sheet.addRow(row.map((v, i) => toCell(v, payload.columns[i]?.type)))
    addTotals(sheet, payload.columns, payload.rows.length)
    styleSheet(sheet, payload.columns, payload.rows.length)
    await saveWorkbook(workbook, filePath)
    return { filePath }
  }))

  // İçe aktarım için örnek şablon: başlıklar + örnek satırlar + açıklama sayfası
  ipcMain.handle('excel:template', wrap(async (_event, payload) => {
    if (!payload || !Array.isArray(payload.columns)) throw new Error('Geçersiz şablon.')
    const filePath = await askSavePath(getWindow, 'Şablonu Kaydet', `${safeName(payload.fileName)}-sablon.xlsx`)
    if (!filePath) return { canceled: true }

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Mini-ERP'
    const sheet = workbook.addWorksheet(String(payload.sheetName ?? 'Veri').slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] })
    sheet.addRow(payload.columns.map((c) => c.header))
    for (const ex of payload.examples ?? []) sheet.addRow(ex.map((v, i) => toCell(v, payload.columns[i]?.type)))
    styleSheet(sheet, payload.columns, 0)
    payload.columns.forEach((c, i) => {
      if (c.required) sheet.getRow(1).getCell(i + 1).value = `${c.header} *`
    })

    const help = workbook.addWorksheet('Açıklamalar')
    help.addRow(['Sütun', 'Zorunlu', 'Açıklama'])
    for (const c of payload.columns) help.addRow([c.header, c.required ? 'Evet' : '', c.help ?? ''])
    styleSheet(help, [{ header: 'Sütun' }, { header: 'Zorunlu' }, { header: 'Açıklama' }], 0)
    help.getColumn(3).width = 80

    await saveWorkbook(workbook, filePath)
    return { filePath }
  }))

  // Sürüklenen / seçilen dosyayı okur. Dosya diske yazılmaz, yalnızca bellekte işlenir.
  ipcMain.handle('excel:parse', wrap(async (_event, payload) => parseBytes(String(payload?.name ?? ''), payload?.bytes)))
}

/** .xlsx/.xlsm/.csv baytlarını sayfa/satır listesine çevirir (sürüklenen dosya ve izlenen dosya için ortak). */
async function parseBytes(name, bytes) {
  if (!(bytes instanceof ArrayBuffer || ArrayBuffer.isView(bytes))) throw new Error('Dosya okunamadı.')
  if (bytes.byteLength > MAX_IMPORT_BYTES) throw new Error('Dosya 25 MB sınırını aşıyor.')
  const ext = path.extname(name).toLowerCase()
  if (ext === '.xls') throw new Error("Eski .xls biçimi desteklenmiyor. Excel'de Dosya → Farklı Kaydet → \"Excel Çalışma Kitabı (.xlsx)\" seçip tekrar deneyin.")
  if (ext === '.csv' || ext === '.txt') return { sheets: parseCsv(bytes) }
  if (ext === '.xlsx' || ext === '.xlsm') {
    try {
      return { sheets: await parseXlsx(bytes) }
    } catch {
      throw new Error('Excel dosyası açılamadı. Dosya bozuk ya da parola korumalı olabilir.')
    }
  }
  throw new Error('Desteklenen biçimler: .xlsx, .xlsm, .csv')
}

module.exports = { registerExcelHandlers, parseBytes }
