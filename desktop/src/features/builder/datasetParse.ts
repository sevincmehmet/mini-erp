import type { CellValue, ParsedSheet } from '../../types/electron'
import { asDate, asNumber, normText } from '../import/normalize'
import { guessHeaderRow } from '../import/sheet'
import type { ColType, DataColumn, TabularData } from './types'

export interface DraftColumn extends DataColumn {
  index: number
  include: boolean
  samples: string[]
}

const MONEY_HINT = /tutar|ucret|maas|fiyat|bedel|gelir|gider|ciro|satis|maliyet|odeme|tahsilat|bakiye|borc|alacak|kdv|\btl\b|\btry\b/

/** Excel başlığından kalıcı sütun anahtarı: "Satış Tutarı (₺)" → "satis_tutari". Yeniden yüklemede eşleşme bununla yapılır. */
export const columnKey = (header: string, i: number) => normText(header).replace(/\s+/g, '_').slice(0, 40) || `sutun_${i + 1}`

/** Değerlerin en az %85'i uyuyorsa tipi belirler. */
export function detectType(header: string, values: CellValue[]): ColType {
  const filled = values.filter((v) => v != null && String(v).trim() !== '').slice(0, 500)
  if (filled.length === 0) return 'text'
  const share = (fn: (v: CellValue) => boolean) => filled.filter(fn).length / filled.length
  const h = normText(header)

  const dateish = (v: CellValue) => (typeof v === 'string' ? asDate(v) != null : typeof v === 'number' && /tarih|date|gun/.test(h) && asDate(v) != null)
  if (share(dateish) >= 0.85) return 'date'

  if (share((v) => asNumber(v) != null) >= 0.85) {
    // Sicil, telefon, posta kodu gibi "sayı görünümlü metinler" sayı sayılmaz
    if (/\b(sicil|telefon|tel|gsm|kod|kodu|no|numara|numarasi|tc|tckn|vergi|iban|posta|yil)\b/.test(h)) return 'text'
    const hasCurrency = filled.some((v) => typeof v === 'string' && /₺|tl|try/i.test(v))
    return hasCurrency || MONEY_HINT.test(h) ? 'money' : 'number'
  }
  return 'text'
}

export function normalizeCell(v: CellValue, type: ColType): CellValue {
  if (v == null || (typeof v === 'string' && v.trim() === '')) return null
  if (type === 'number' || type === 'money') return asNumber(v)
  if (type === 'date') return asDate(v)
  return String(v).trim()
}

export function draftColumns(sheet: ParsedSheet, headerRow: number): DraftColumn[] {
  const headers = sheet.rows[headerRow - 1] ?? []
  const body = sheet.rows.slice(headerRow)
  const width = Math.max(headers.length, ...body.slice(0, 200).map((r) => r.length))
  const used = new Set<string>()
  return Array.from({ length: width }, (_, i) => {
    const name = headers[i] == null || String(headers[i]).trim() === '' ? `Sütun ${i + 1}` : String(headers[i]).trim()
    let key = columnKey(name, i)
    for (let n = 2; used.has(key); n++) key = `${columnKey(name, i)}_${n}`
    used.add(key)
    const values = body.map((r) => r[i] ?? null)
    const filled = values.filter((v) => v != null && String(v).trim() !== '')
    return { index: i, key, name, type: detectType(name, values), include: filled.length > 0, samples: filled.slice(0, 3).map(String) }
  })
}

const TOTAL_ROW = /^\s*(genel\s+|ara\s+)?(toplam|total|grand total|subtotal)\b/i

export function buildDataset(sheet: ParsedSheet, headerRow: number, columns: DraftColumn[]): TabularData {
  const included = columns.filter((c) => c.include)
  // Excel'in altındaki "TOPLAM / GENEL TOPLAM" satırları veri değildir; hangi sütunda yazdığına bakmadan atlanır
  const rows = sheet.rows.slice(headerRow)
    .filter((r) => r.some((v) => v != null && String(v).trim() !== ''))
    .filter((r) => !r.some((v) => typeof v === 'string' && TOTAL_ROW.test(v)))
    .map((r) => included.map((c) => normalizeCell(r[c.index] ?? null, c.type)))
  return { columns: included.map(({ key, name, type }) => ({ key, name, type })), rows }
}

export { guessHeaderRow }
