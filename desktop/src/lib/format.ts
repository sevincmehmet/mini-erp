const tl0 = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
const tl2 = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 })
const num = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 })
const compact = new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 })

export const money = (v: number) => tl0.format(v)
export const moneyExact = (v: number) => tl2.format(v)
export const number = (v: number) => num.format(v)
export const compactMoney = (v: number) => `${compact.format(v)} ₺`

export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3))
export const WEEKDAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

/** Yerel tarihi YYYY-MM-DD olarak verir (toISOString UTC'ye kaydırır, kullanmıyoruz). */
export function isoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function shortDate(iso: string) {
  const d = parseDate(iso)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

export function addDays(d: Date, days: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

/** Haftanın pazartesisi. */
export function startOfWeek(d: Date) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = (r.getDay() + 6) % 7
  return addDays(r, -day)
}
