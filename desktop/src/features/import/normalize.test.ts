import { describe, expect, it } from 'vitest'
import { asDate, asNumber, asTime, normText } from './normalize'

describe('asNumber — Türk Excel sayı biçimleri', () => {
  it.each([
    ['1.234,56 ₺', 1234.56],
    ['1,234.56', 1234.56],
    ['45.000', 45000],
    ['1234,5', 1234.5],
    ['1,234,567', 1234567],
    ['(2.500)', -2500],
    ['150-', -150],
    ['  12 TL ', 12],
    [42, 42],
  ])('%s → %s', (input, expected) => expect(asNumber(input)).toBe(expected))

  it('sayı olmayanlar boş döner', () => {
    expect(asNumber('abc')).toBeNull()
    expect(asNumber('')).toBeNull()
    expect(asNumber(null)).toBeNull()
  })
})

describe('asDate', () => {
  it.each([
    ['15.09.2026', '2026-09-15'],
    ['15/09/26', '2026-09-15'],
    ['2026-09-15T00:00:00', '2026-09-15'],
    ['15 Eylül 2026', '2026-09-15'],
    [46280, '2026-09-15'], // Excel seri numarası
  ])('%s → %s', (input, expected) => expect(asDate(input)).toBe(expected))

  it('geçersiz gün reddedilir', () => expect(asDate('31.02.2026')).toBeNull())
  it('yılsız başlık varsayılan yılı alır', () => expect(asDate('15.09', 2026)).toBe('2026-09-15'))
})

describe('asTime', () => {
  it.each([
    ['08.30', '08:30'],
    ['8:30', '08:30'],
    ['0830', '08:30'],
    [0.5, '12:00'],
    [8, '08:00'],
    ['24:00', '00:00'],
  ])('%s → %s', (input, expected) => expect(asTime(input)).toBe(expected))
})

it('normText Türkçe karakterleri sadeleştirir', () => expect(normText('  Satış Tutarı (₺) ')).toBe('satis tutari'))
