import type { CellValue } from '../../types/electron'

/**
 * Başlık satırını tahmin eder: ilk 15 satırda, en dolu satırın en az %60'ı kadar dolu olan İLK satır.
 * Böylece üstteki "PERSONEL LİSTESİ 2026" gibi tek hücrelik başlıklar atlanır,
 * başlığında gün numaraları (sayı) olan çizelgeler de doğru tanınır.
 */
export function guessHeaderRow(rows: CellValue[][]) {
  const counts = rows.slice(0, 15).map((r) => r.filter((c) => c != null && String(c).trim() !== '').length)
  const max = Math.max(0, ...counts)
  const idx = counts.findIndex((c) => c >= Math.max(2, max * 0.6))
  return (idx < 0 ? 0 : idx) + 1
}
