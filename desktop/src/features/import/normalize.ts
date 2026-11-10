import type { CellValue } from '../../types/electron'

/**
 * Excel hücrelerini API'nin beklediği tiplere çevirir.
 * Türkiye'de Excel dosyaları çok farklı biçimlerde gelir: "15.09.2026", "15/09/26", tarih seri numarası (46280),
 * "1.234,56 ₺", "(2.500)" (muhasebe negatifi), "08.30", "8:30", 0,354166 (saat kesri)...
 */

export const normText = (s: string) =>
  s.toLocaleLowerCase('tr').trim()
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ').trim()

export function asText(v: CellValue): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => {
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null
}

/** Excel tarih seri numarası → yerel tarih (1900 tarih sistemi). */
function fromSerial(serial: number) {
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  const d = new Date(ms)
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

export function asDate(v: CellValue, defaultYear?: number): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v > 20000 && v < 80000 ? fromSerial(v) : null
  const s = String(v).trim()

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return iso(+m[1], +m[2], +m[3])

  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/)
  if (m) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]
    return iso(y, +m[2], +m[1])
  }

  // Yılı olmayan "15.09" — çizelge başlıkları için
  m = s.match(/^(\d{1,2})[./](\d{1,2})$/)
  if (m && defaultYear) return iso(defaultYear, +m[2], +m[1])

  // "15 Eylül 2026", "15 Eyl"
  const months = ['oca', 'sub', 'mar', 'nis', 'may', 'haz', 'tem', 'agu', 'eyl', 'eki', 'kas', 'ara']
  m = normText(s).match(/^(\d{1,2}) ([a-z]+)(?: (\d{4}))?/)
  if (m) {
    const mi = months.findIndex((p) => m![2].startsWith(p))
    const y = m[3] ? +m[3] : defaultYear
    if (mi >= 0 && y) return iso(y, mi + 1, +m[1])
  }
  return null
}

export function asNumber(v: CellValue): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'boolean') return null
  let s = String(v).replace(/\s|₺|TL|TRY| /gi, '')
  let negative = false
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1) }
  if (s.endsWith('-')) { negative = true; s = s.slice(0, -1) }
  if (s === '') return null

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    // Hangisi sondaysa ondalık ayracıdır: "1.234,56" veya "1,234.56"
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (lastComma >= 0) {
    // Türkçede virgül ondalıktır ("1234,5"); birden fazla virgül varsa binlik ayracıdır ("1,234,567")
    s = (s.match(/,/g)?.length ?? 0) > 1 ? s.replace(/,/g, '') : s.replace(',', '.')
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '') // "45.000" → 45000 (Türkçe binlik)
  }
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return negative ? -Math.abs(n) : n
}

export function asTime(v: CellValue): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') {
    if (v >= 0 && v < 1) { // gün kesri: 0,5 = 12:00
      const mins = Math.round(v * 24 * 60)
      return `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`
    }
    if (v >= 0 && v <= 24 && Number.isInteger(v)) return `${pad(v)}:00`
    return null
  }
  const s = String(v).trim()
  let m = s.match(/(\d{1,2})[:.](\d{2})(?::\d{2})?\s*$/)
  if (m && +m[1] <= 24 && +m[2] < 60) return `${pad(+m[1] % 24)}:${m[2]}`
  m = s.match(/^(\d{2})(\d{2})$/) // "0830"
  if (m && +m[1] <= 24 && +m[2] < 60) return `${pad(+m[1] % 24)}:${m[2]}`
  m = s.match(/^(\d{1,2})$/)
  if (m && +m[1] <= 24) return `${pad(+m[1] % 24)}:00`
  return null
}

export function asInt(v: CellValue): number | null {
  const n = asNumber(v)
  return n == null ? null : Math.round(n)
}
