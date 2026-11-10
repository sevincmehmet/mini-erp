import { describe, expect, it } from 'vitest'
import { columnKey, detectType, normalizeCell } from './datasetParse'

describe('detectType', () => {
  it('tutar başlığı + sayılar → money', () => expect(detectType('Satış Tutarı', ['1.250,00', '980,50', 300])).toBe('money'))
  it('sicil numarası sayı olsa da metindir', () => expect(detectType('Sicil No', [1001, 1002, 1003])).toBe('text'))
  it('tarih metinleri → date', () => expect(detectType('Tarih', ['01.09.2026', '02.09.2026', '03.09.2026'])).toBe('date'))
  it('düz sayılar → number', () => expect(detectType('Adet', [3, 5, 8])).toBe('number'))
  it('karışık değerler → text', () => expect(detectType('Not', ['a', 1, 'b'])).toBe('text'))
})

it('columnKey kalıcı ve sade anahtar üretir', () => {
  expect(columnKey('Satış Tutarı (₺)', 0)).toBe('satis_tutari')
  expect(columnKey('   ', 2)).toBe('sutun_3')
})

it('normalizeCell tipe göre çevirir', () => {
  expect(normalizeCell('1.234,56', 'money')).toBe(1234.56)
  expect(normalizeCell('15.09.2026', 'date')).toBe('2026-09-15')
  expect(normalizeCell('  ', 'text')).toBeNull()
})
