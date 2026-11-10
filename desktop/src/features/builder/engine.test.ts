import { describe, expect, it } from 'vitest'
import { aggregate, applyWidgetFilters, bucketOf, resolveRange } from './engine'
import type { TabularData } from './types'

const data: TabularData = {
  columns: [
    { key: 'tarih', name: 'Tarih', type: 'date' },
    { key: 'sube', name: 'Şube', type: 'text' },
    { key: 'tutar', name: 'Tutar', type: 'money' },
  ],
  rows: [
    ['2026-08-30', 'Merkez', 100],
    ['2026-09-02', 'Merkez', 250],
    ['2026-09-15', 'İzmir', 400],
    ['2026-10-01', 'İzmir', null],
  ],
}

describe('aggregate', () => {
  const v = [1, 2, 3, null, '4']
  it.each([['sum', 10], ['avg', 2.5], ['min', 1], ['max', 4], ['count', 5]] as const)('%s', (agg, expected) =>
    expect(aggregate(v, agg)).toBe(expected))
  it('countDistinct boşları saymaz', () => expect(aggregate(['a', 'a', 'b', null, ''], 'countDistinct')).toBe(2))
})

describe('resolveRange', () => {
  const today = new Date(2026, 9, 9) // 9 Ekim 2026
  it('bu ay', () => expect(resolveRange('thisMonth', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' }))
  it('geçen ay', () => expect(resolveRange('lastMonth', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' }))
  it('son 3 ay', () => expect(resolveRange('last3', today)).toEqual({ from: '2026-08-01', to: '2026-10-31' }))
  it('ocakta geçen ay önceki yıla düşer', () =>
    expect(resolveRange('lastMonth', new Date(2026, 0, 5))).toEqual({ from: '2025-12-01', to: '2025-12-31' }))
})

describe('applyWidgetFilters', () => {
  it('metin eşitliği büyük/küçük harf ve Türkçe İ duyarsız', () => {
    const r = applyWidgetFilters(data, { filters: [{ column: 'sube', op: 'eq', value: 'izmir' }], range: 'all' }, true)
    expect(r.rows).toHaveLength(2)
  })
  it('sayısal karşılaştırma', () => {
    const r = applyWidgetFilters(data, { filters: [{ column: 'tutar', op: 'gte', value: '250' }], range: 'all' }, true)
    expect(r.rows.map((x) => x[2])).toEqual([250, 400])
  })
  it('değeri boş filtre yok sayılır', () => {
    const r = applyWidgetFilters(data, { filters: [{ column: 'sube', op: 'eq', value: '' }], range: 'all' }, true)
    expect(r.rows).toHaveLength(4)
  })
})

describe('bucketOf', () => {
  it('hafta pazartesiye yuvarlanır', () => expect(bucketOf('2026-09-03', 'week')?.key).toBe('2026-08-31'))
  it('ay', () => expect(bucketOf('2026-09-15', 'month')?.key).toBe('2026-09'))
  it('çeyrek', () => expect(bucketOf('2026-09-15', 'quarter')?.key).toBe('2026-Q3'))
  it('tarih olmayan değer', () => expect(bucketOf('abc', 'month')).toBeNull())
})
