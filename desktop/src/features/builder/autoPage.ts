import { distinctCount, isNumeric, suggestBucket } from './engine'
import { categoryColumns } from './suggest'
import { blankWidget, type SourceRef, type TabularData, type Widget } from './types'

/**
 * Excel'den gelen veriye bakarak bir başlangıç sayfası kurar:
 * göstergeler (kayıt sayısı + sayısal sütunların toplamı), zaman grafiği, kategori dağılımı,
 * özet tablo ve tüm satırlar. Kullanıcı sonra istediği gibi düzenler.
 */
export function autoWidgets(data: TabularData, source: SourceRef, title: string): Widget[] {
  const numeric = data.columns.filter((c) => isNumeric(c.type))
  const date = data.columns.find((c) => c.type === 'date')
  const cats = categoryColumns(data)
  const main = numeric.find((c) => c.type === 'money') ?? numeric[0]
  const base = { source, range: 'all' as const, filters: [], dateColumn: date?.key }
  const widgets: Widget[] = []

  // Göstergeler: 4'lük satır
  const stats = [
    blankWidget({ ...base, type: 'stat', title: 'Kayıt Sayısı', size: 3, measures: [{ agg: 'count' }] }),
    ...numeric.slice(0, 3).map((c) => blankWidget({ ...base, type: 'stat', title: `Toplam ${c.name}`, size: 3, measures: [{ agg: 'sum', column: c.key }] })),
  ]
  if (stats.length < 4 && main) stats.push(blankWidget({ ...base, type: 'stat', title: `Ortalama ${main.name}`, size: 3, measures: [{ agg: 'avg', column: main.key }] }))
  if (stats.length < 4 && cats[0]) stats.push(blankWidget({ ...base, type: 'stat', title: `${cats[0].name} Sayısı`, size: 3, measures: [{ agg: 'countDistinct', column: cats[0].key }] }))
  stats.forEach((w) => (w.size = 12 / Math.min(4, stats.length)))
  widgets.push(...stats.slice(0, 4))

  const measure = main ? { agg: 'sum' as const, column: main.key } : { agg: 'count' as const }

  if (date) {
    widgets.push(blankWidget({ ...base, type: date && main ? 'line' : 'bar', title: `${main ? main.name : 'Kayıt'} · Zaman İçinde`, size: cats[0] ? 8 : 12, x: date.key, bucket: suggestBucket(data, date.key), measures: [measure], limit: 24 }))
  }
  if (cats[0]) {
    const few = distinctCount(data, cats[0].key) <= 7
    widgets.push(blankWidget({ ...base, type: few ? 'donut' : 'hbar', title: `${cats[0].name} Dağılımı`, size: date ? 4 : 6, x: cats[0].key, measures: [measure], limit: few ? 7 : 10 }))
  }
  if (cats[1] && main) {
    widgets.push(blankWidget({ ...base, type: 'bar', title: `${cats[1].name} Bazında ${main.name}`, size: 6, x: cats[1].key, measures: [measure], limit: 12 }))
  }
  if (cats[0] && numeric.length) {
    widgets.push(blankWidget({
      ...base, type: 'table', tableMode: 'summary', title: `${cats[0].name} Özeti`, size: cats[1] ? 6 : 12, groupBy: cats[0].key,
      measures: [{ agg: 'count' }, ...numeric.slice(0, 3).map((c) => ({ agg: 'sum' as const, column: c.key }))],
    }))
  }
  widgets.push(blankWidget({ ...base, type: 'table', tableMode: 'rows', title: `${title} · Tüm Kayıtlar`, size: 12, limit: 500 }))
  return widgets
}

/** Sistem verilerinden hazır sayfa şablonları. */
export const PAGE_TEMPLATES: { id: string; title: string; icon: string; description: string; widgets: () => Widget[] }[] = [
  {
    id: 'finance', title: 'Finans Özeti', icon: '💰', description: 'Gelir, gider, net; aylık trend; kategori dağılımı; en büyük giderler',
    widgets: () => {
      const s = { kind: 'system' as const, key: 'gelir-gider' as const }
      const b = { source: s, dateColumn: 'tarih', filters: [] }
      return [
        blankWidget({ ...b, type: 'stat', title: 'Gelir · Son 12 Ay', size: 4, range: 'last12', measures: [{ agg: 'sum', column: 'gelir' }] }),
        blankWidget({ ...b, type: 'stat', title: 'Gider · Son 12 Ay', size: 4, range: 'last12', measures: [{ agg: 'sum', column: 'gider' }] }),
        blankWidget({ ...b, type: 'stat', title: 'Net · Son 12 Ay', size: 4, range: 'last12', measures: [{ agg: 'sum', column: 'net' }] }),
        blankWidget({ ...b, type: 'line', title: 'Aylık Gelir ve Gider', size: 8, range: 'last12', x: 'tarih', bucket: 'month', measures: [{ agg: 'sum', column: 'gelir', label: 'Gelir' }, { agg: 'sum', column: 'gider', label: 'Gider' }], limit: 12 }),
        blankWidget({ ...b, type: 'donut', title: 'Gider Dağılımı', size: 4, range: 'last3', x: 'kategori', measures: [{ agg: 'sum', column: 'tutar' }], filters: [{ column: 'tur', op: 'eq', value: 'Gider' }], limit: 7 }),
        blankWidget({ ...b, type: 'hbar', title: 'Gelir Kalemleri', size: 6, range: 'last6', x: 'kategori', measures: [{ agg: 'sum', column: 'tutar' }], filters: [{ column: 'tur', op: 'eq', value: 'Gelir' }], limit: 8 }),
        blankWidget({ ...b, type: 'list', title: 'En Büyük 10 Gider', showOther: false, size: 6, range: 'last3', labelColumn: 'aciklama', subColumn: 'kategori', valueColumn: 'tutar', filters: [{ column: 'tur', op: 'eq', value: 'Gider' }], limit: 10 }),
      ]
    },
  },
  {
    id: 'workforce', title: 'Mesai ve Personel Analizi', icon: '⏱', description: 'Fazla mesai kimde, vardiya dağılımı, aylık çalışma saatleri, bordro maliyeti',
    widgets: () => {
      const p = { source: { kind: 'system' as const, key: 'puantaj' as const }, dateColumn: 'tarih', filters: [] }
      const pay = { source: { kind: 'system' as const, key: 'bordro' as const }, dateColumn: 'donem', filters: [] }
      return [
        blankWidget({ ...p, type: 'stat', title: 'Çalışılan Saat · Bu Ay', size: 4, range: 'thisMonth', measures: [{ agg: 'sum', column: 'calisilanSaat' }] }),
        blankWidget({ ...p, type: 'stat', title: 'Fazla Mesai · Bu Ay', size: 4, range: 'thisMonth', measures: [{ agg: 'sum', column: 'fazlaMesai' }] }),
        blankWidget({ ...pay, type: 'stat', title: 'Net Maaş Maliyeti · Son 6 Ay', size: 4, range: 'last6', measures: [{ agg: 'sum', column: 'net' }] }),
        blankWidget({ ...p, type: 'hbar', title: 'En Çok Fazla Mesai Yapanlar · Son 3 Ay', size: 6, range: 'last3', x: 'calisan', measures: [{ agg: 'sum', column: 'fazlaMesai' }], limit: 10, showOther: false }),
        blankWidget({ ...p, type: 'bar', title: 'Vardiyalara Göre Çalışma Saati', size: 6, range: 'last3', x: 'tarih', bucket: 'month', splitBy: 'vardiya', stacked: true, measures: [{ agg: 'sum', column: 'calisilanSaat' }], limit: 6 }),
        blankWidget({ ...pay, type: 'line', title: 'Aylık Brüt ve Net Bordro', size: 8, range: 'last12', x: 'donem', bucket: 'month', measures: [{ agg: 'sum', column: 'brut', label: 'Brüt' }, { agg: 'sum', column: 'net', label: 'Net' }], limit: 12 }),
        blankWidget({ ...pay, type: 'table', tableMode: 'summary', title: 'Pozisyona Göre Bordro · Son 3 Ay', size: 4, range: 'last3', groupBy: 'pozisyon', measures: [{ agg: 'countDistinct', column: 'calisan', label: 'Kişi' }, { agg: 'sum', column: 'net', label: 'Net' }] }),
      ]
    },
  },
]
