import type { CellValue } from '../../types/electron'
import { columnKey } from './datasetParse'
import { blankWidget, type ColType, type SourceRef, type TabularData, type Widget } from './types'

/**
 * Örnek sayfalar: her biri bir Excel şablonu (sütunlar + açıklamalar), gerçekçi örnek veri
 * ve o veriye bağlı hazır bileşenlerden oluşur. Sütun anahtarları, Excel yüklenirken üretilen
 * anahtarlarla aynıdır (columnKey); böylece şablona göre doldurulan Excel bileşenlere doğrudan bağlanır.
 */
export interface SampleColumn {
  header: string
  type: ColType
  required?: boolean
  help: string
}

export interface SamplePage {
  id: string
  title: string
  icon: string
  tag: string
  description: string
  columns: SampleColumn[]
  rows: () => CellValue[][]
  widgets: (source: SourceRef) => Widget[]
}

export const keyOf = (header: string) => columnKey(header, 0)

/** Sabit tohumlu rastgele sayı: örnek veri her açılışta aynı görünür. */
function rng(seed: number) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}
const pick = <T,>(r: () => number, list: T[]) => list[Math.floor(r() * list.length)]
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const round = (n: number, step = 1) => Math.round(n / step) * step
/** Bugünden geriye doğru, son N günün tarihleri */
const lastDays = (n: number) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return d })

const k = keyOf
const base = (source: SourceRef, dateHeader?: string) => ({ source, range: 'all' as const, filters: [], dateColumn: dateHeader ? k(dateHeader) : undefined })

export const SAMPLE_PAGES: SamplePage[] = [
  // ------------------------------------------------------------------ Enerji üretimi
  {
    id: 'energy', title: 'Enerji Üretim Takibi', icon: '⚡', tag: 'Enerji · Biyogaz / GES',
    description: 'Günlük üretim, satış geliri ve arıza süreleri; ünite bazında karşılaştırma ve aylık trend.',
    columns: [
      { header: 'Tarih', type: 'date', required: true, help: 'Üretim günü (gg.aa.yyyy).' },
      { header: 'Ünite', type: 'text', required: true, help: 'Motor, inverter ya da tesis adı (ör. Motor 1).' },
      { header: 'Üretim (kWh)', type: 'number', required: true, help: 'O gün üretilen elektrik.' },
      { header: 'Biyogaz (m³)', type: 'number', help: 'Biyogaz tesislerinde tüketilen gaz; GES için boş bırakılabilir.' },
      { header: 'Satış Tutarı (₺)', type: 'money', required: true, help: 'Üretimin satış karşılığı.' },
      { header: 'Arıza Süresi (saat)', type: 'number', help: 'Ünitenin çalışmadığı süre.' },
      { header: 'Vardiya Sorumlusu', type: 'text', help: 'Kayıttan sorumlu kişi.' },
    ],
    rows: () => {
      const r = rng(11)
      return lastDays(150).flatMap((d) => ['Motor 1', 'Motor 2', 'GES Sahası'].map((u) => {
        const fault = r() < 0.06 ? round(r() * 8, 0.5) : 0
        const kwh = round((u === 'GES Sahası' ? 5200 + 2600 * Math.sin((d.getMonth() - 2) / 2) : u === 'Motor 1' ? 20100 : 17600) * (1 - fault / 24) * (0.92 + r() * 0.12))
        const gas = u === 'GES Sahası' ? null : round(kwh / 2.05)
        return [iso(d), u, kwh, gas, round(kwh * 3.42, 0.01), fault, pick(r, ['Mehmet Kaya', 'Hasan Yıldız', 'Okan Güneş'])]
      }))
    },
    widgets: (s) => {
      const b = base(s, 'Tarih')
      return [
        blankWidget({ ...b, type: 'stat', title: 'Toplam Üretim', size: 3, measures: [{ agg: 'sum', column: k('Üretim (kWh)') }] }),
        blankWidget({ ...b, type: 'stat', title: 'Satış Geliri', size: 3, measures: [{ agg: 'sum', column: k('Satış Tutarı (₺)') }] }),
        blankWidget({ ...b, type: 'stat', title: 'Günlük Ortalama Üretim', size: 3, measures: [{ agg: 'avg', column: k('Üretim (kWh)') }] }),
        blankWidget({ ...b, type: 'stat', title: 'Toplam Arıza Süresi', size: 3, measures: [{ agg: 'sum', column: k('Arıza Süresi (saat)') }] }),
        blankWidget({ ...b, type: 'line', title: 'Aylık Üretim · Ünite Bazında', size: 8, x: k('Tarih'), bucket: 'month', splitBy: k('Ünite'), measures: [{ agg: 'sum', column: k('Üretim (kWh)') }], limit: 12 }),
        blankWidget({ ...b, type: 'donut', title: 'Gelirin Ünitelere Dağılımı', size: 4, x: k('Ünite'), measures: [{ agg: 'sum', column: k('Satış Tutarı (₺)') }], limit: 7 }),
        blankWidget({ ...b, type: 'hbar', title: 'Arıza Süresi · Ünite', size: 6, x: k('Ünite'), measures: [{ agg: 'sum', column: k('Arıza Süresi (saat)') }], limit: 10, showOther: false }),
        blankWidget({ ...b, type: 'table', tableMode: 'summary', title: 'Sorumlu Bazında Özet', size: 6, groupBy: k('Vardiya Sorumlusu'), measures: [{ agg: 'count', label: 'Kayıt' }, { agg: 'sum', column: k('Üretim (kWh)') }, { agg: 'sum', column: k('Arıza Süresi (saat)') }] }),
      ]
    },
  },
  // ------------------------------------------------------------------ Satış
  {
    id: 'sales', title: 'Satış Raporu', icon: '📈', tag: 'Satış · Ticaret',
    description: 'Müşteri, ürün ve bölge bazında satışlar; temsilci performansı ve aylık ciro trendi.',
    columns: [
      { header: 'Tarih', type: 'date', required: true, help: 'Satış / fatura tarihi.' },
      { header: 'Müşteri', type: 'text', required: true, help: 'Müşteri adı ya da ünvanı.' },
      { header: 'Ürün', type: 'text', required: true, help: 'Satılan ürün ya da hizmet.' },
      { header: 'Bölge', type: 'text', help: 'Satış bölgesi (ör. Marmara).' },
      { header: 'Adet', type: 'number', help: 'Satış miktarı.' },
      { header: 'Tutar (₺)', type: 'money', required: true, help: 'KDV hariç satış tutarı.' },
      { header: 'Satış Temsilcisi', type: 'text', help: 'Satışı yapan kişi.' },
    ],
    rows: () => {
      const r = rng(23)
      const products: [string, number][] = [['Kurulum Hizmeti', 42000], ['Bakım Sözleşmesi', 18000], ['Panel Paketi', 26500], ['İnverter', 15400], ['Danışmanlık', 9800]]
      const customers = ['Akdeniz Tarım', 'Ege Gıda', 'Marmara Lojistik', 'Anadolu Süt', 'Karadeniz Çay', 'Trakya Tekstil', 'Kapadokya Otel', 'İç Anadolu Un']
      const regions: Record<string, string> = { 'Akdeniz Tarım': 'Akdeniz', 'Ege Gıda': 'Ege', 'Marmara Lojistik': 'Marmara', 'Anadolu Süt': 'İç Anadolu', 'Karadeniz Çay': 'Karadeniz', 'Trakya Tekstil': 'Marmara', 'Kapadokya Otel': 'İç Anadolu', 'İç Anadolu Un': 'İç Anadolu' }
      return lastDays(180).filter(() => r() < 0.55).map((d) => {
        const [p, price] = pick(r, products)
        const c = pick(r, customers)
        const qty = 1 + Math.floor(r() * 4)
        return [iso(d), c, p, regions[c], qty, round(price * qty * (0.85 + r() * 0.3), 10), pick(r, ['Deniz Acar', 'Gökhan Tekin', 'Merve Kılıç'])]
      })
    },
    widgets: (s) => {
      const b = base(s, 'Tarih')
      return [
        blankWidget({ ...b, type: 'stat', title: 'Toplam Ciro', size: 3, measures: [{ agg: 'sum', column: k('Tutar (₺)') }] }),
        blankWidget({ ...b, type: 'stat', title: 'Satış Adedi', size: 3, measures: [{ agg: 'count' }] }),
        blankWidget({ ...b, type: 'stat', title: 'Ortalama Sepet', size: 3, measures: [{ agg: 'avg', column: k('Tutar (₺)') }] }),
        blankWidget({ ...b, type: 'stat', title: 'Aktif Müşteri', size: 3, measures: [{ agg: 'countDistinct', column: k('Müşteri') }] }),
        blankWidget({ ...b, type: 'bar', title: 'Aylık Ciro · Ürünlere Göre', size: 8, x: k('Tarih'), bucket: 'month', splitBy: k('Ürün'), stacked: true, measures: [{ agg: 'sum', column: k('Tutar (₺)') }], limit: 6 }),
        blankWidget({ ...b, type: 'donut', title: 'Bölge Dağılımı', size: 4, x: k('Bölge'), measures: [{ agg: 'sum', column: k('Tutar (₺)') }], limit: 7 }),
        blankWidget({ ...b, type: 'hbar', title: 'En Çok Alım Yapan Müşteriler', size: 6, x: k('Müşteri'), measures: [{ agg: 'sum', column: k('Tutar (₺)') }], limit: 8, showOther: false }),
        blankWidget({ ...b, type: 'table', tableMode: 'summary', title: 'Temsilci Performansı', size: 6, groupBy: k('Satış Temsilcisi'), measures: [{ agg: 'count', label: 'Satış' }, { agg: 'sum', column: k('Tutar (₺)') }, { agg: 'avg', column: k('Tutar (₺)') }] }),
      ]
    },
  },
  // ------------------------------------------------------------------ Stok
  {
    id: 'stock', title: 'Stok ve Depo Takibi', icon: '📦', tag: 'Depo · Lojistik',
    description: 'Depo ve kategori bazında stok değeri, kritik seviyenin altındaki ürünler ve en değerli kalemler.',
    columns: [
      { header: 'Ürün Kodu', type: 'text', required: true, help: 'Benzersiz stok kodu.' },
      { header: 'Ürün Adı', type: 'text', required: true, help: '' },
      { header: 'Kategori', type: 'text', help: 'Ürün grubu.' },
      { header: 'Depo', type: 'text', help: 'Bulunduğu depo.' },
      { header: 'Stok Adedi', type: 'number', required: true, help: 'Eldeki miktar.' },
      { header: 'Birim Maliyet (₺)', type: 'money', help: 'Bir birimin maliyeti.' },
      { header: 'Stok Değeri (₺)', type: 'money', help: 'Adet × birim maliyet (Excel formülü de olabilir).' },
      { header: 'Kritik Seviye', type: 'number', help: 'Bu adedin altına düşünce uyarı.' },
      { header: 'Son Hareket', type: 'date', help: 'Son giriş/çıkış tarihi.' },
    ],
    rows: () => {
      const r = rng(37)
      const cats: [string, string[]][] = [['Yedek Parça', ['Rulman 6205', 'Salmastra Seti', 'Pompa Çarkı', 'Gaz Filtresi']], ['Sarf', ['Streç Film', 'Koli 40x60', 'Etiket Rulosu', 'Palet']], ['Elektrik', ['Kablo 4x10', 'Sigorta 63A', 'Kontaktör', 'Panel Kilidi']], ['Kimyasal', ['Demir Klorür', 'Antiköpük', 'Yağ 15W40']]]
      return Array.from({ length: 64 }, (_, i) => {
        const [cat, names] = pick(r, cats)
        const qty = Math.floor(r() * 260)
        const cost = round(40 + r() * 1900, 0.5)
        const last = new Date(); last.setDate(last.getDate() - Math.floor(r() * 90))
        return [`STK-${String(1000 + i)}`, `${pick(r, names)}${i % 3 ? '' : ' (B)'}`, cat, pick(r, ['Merkez Depo', 'Tesis Deposu', 'Şantiye']), qty, cost, round(qty * cost, 0.01), 20 + Math.floor(r() * 40), iso(last)]
      })
    },
    widgets: (s) => {
      const b = base(s, 'Son Hareket')
      return [
        blankWidget({ ...b, type: 'stat', title: 'Toplam Stok Değeri', size: 4, measures: [{ agg: 'sum', column: k('Stok Değeri (₺)') }] }),
        blankWidget({ ...b, type: 'stat', title: 'Ürün Çeşidi', size: 4, measures: [{ agg: 'count' }] }),
        blankWidget({ ...b, type: 'stat', title: 'Kritik Seviyenin Altında', size: 4, measures: [{ agg: 'count' }], filters: [{ column: k('Stok Adedi'), op: 'lt', value: '30' }] }),
        blankWidget({ ...b, type: 'bar', title: 'Depo Bazında Stok Değeri', size: 6, x: k('Depo'), splitBy: k('Kategori'), stacked: true, measures: [{ agg: 'sum', column: k('Stok Değeri (₺)') }] }),
        blankWidget({ ...b, type: 'donut', title: 'Kategori Payı', size: 6, x: k('Kategori'), measures: [{ agg: 'sum', column: k('Stok Değeri (₺)') }], limit: 7 }),
        blankWidget({ ...b, type: 'list', title: 'En Değerli 8 Kalem', size: 5, labelColumn: k('Ürün Adı'), subColumn: k('Depo'), valueColumn: k('Stok Değeri (₺)'), limit: 8 }),
        blankWidget({ ...b, type: 'table', tableMode: 'rows', title: 'Azalan Stoklar', size: 7, filters: [{ column: k('Stok Adedi'), op: 'lt', value: '30' }],
          columns: [k('Ürün Kodu'), k('Ürün Adı'), k('Depo'), k('Stok Adedi'), k('Kritik Seviye')] }),
      ]
    },
  },
  // ------------------------------------------------------------------ Bütçe
  {
    id: 'budget', title: 'Bütçe ve Gerçekleşen', icon: '🎯', tag: 'Finans · Planlama',
    description: 'Departman ve kalem bazında bütçe ile gerçekleşenin karşılaştırması, aylık sapma.',
    columns: [
      { header: 'Ay', type: 'date', required: true, help: 'Ayın ilk günü (01.09.2026 gibi).' },
      { header: 'Departman', type: 'text', required: true, help: '' },
      { header: 'Kalem', type: 'text', required: true, help: 'Gider kalemi (ör. Bakım).' },
      { header: 'Bütçe (₺)', type: 'money', required: true, help: 'Planlanan tutar.' },
      { header: 'Gerçekleşen (₺)', type: 'money', required: true, help: 'Fiilen harcanan.' },
      { header: 'Sapma (₺)', type: 'money', help: 'Gerçekleşen − Bütçe (Excel formülü olabilir).' },
    ],
    rows: () => {
      const r = rng(53)
      const items: [string, string, number][] = [['Üretim', 'Hammadde', 520000], ['Üretim', 'Bakım', 140000], ['Üretim', 'Enerji', 60000], ['İdari', 'Kira', 90000], ['İdari', 'Ofis', 25000], ['Satış', 'Pazarlama', 45000], ['İK', 'Eğitim', 20000]]
      const now = new Date()
      return Array.from({ length: 9 }, (_, m) => new Date(now.getFullYear(), now.getMonth() - 8 + m, 1)).flatMap((d) =>
        items.map(([dep, item, budget]) => {
          const actual = round(budget * (0.82 + r() * 0.32), 10)
          return [iso(d), dep, item, budget, actual, actual - budget]
        }))
    },
    widgets: (s) => {
      const b = base(s, 'Ay')
      return [
        blankWidget({ ...b, type: 'stat', title: 'Toplam Bütçe', size: 4, measures: [{ agg: 'sum', column: k('Bütçe (₺)') }] }),
        blankWidget({ ...b, type: 'stat', title: 'Gerçekleşen', size: 4, measures: [{ agg: 'sum', column: k('Gerçekleşen (₺)') }] }),
        blankWidget({ ...b, type: 'stat', title: 'Toplam Sapma', size: 4, measures: [{ agg: 'sum', column: k('Sapma (₺)') }] }),
        blankWidget({ ...b, type: 'line', title: 'Aylık Bütçe ve Gerçekleşen', size: 8, x: k('Ay'), bucket: 'month', measures: [{ agg: 'sum', column: k('Bütçe (₺)'), label: 'Bütçe' }, { agg: 'sum', column: k('Gerçekleşen (₺)'), label: 'Gerçekleşen' }], limit: 12 }),
        blankWidget({ ...b, type: 'hbar', title: 'Kalem Bazında Sapma', size: 4, x: k('Kalem'), measures: [{ agg: 'sum', column: k('Sapma (₺)') }], limit: 10, showOther: false }),
        blankWidget({ ...b, type: 'table', tableMode: 'summary', title: 'Departman Özeti', size: 12, groupBy: k('Departman'), measures: [{ agg: 'sum', column: k('Bütçe (₺)') }, { agg: 'sum', column: k('Gerçekleşen (₺)') }, { agg: 'sum', column: k('Sapma (₺)') }] }),
      ]
    },
  },
  // ------------------------------------------------------------------ Filo
  {
    id: 'fleet', title: 'Araç ve Yakıt Takibi', icon: '🚚', tag: 'Filo · Saha',
    description: 'Araç bazında yakıt gideri, kilometre ve litre başına maliyet; aylık yakıt trendi.',
    columns: [
      { header: 'Tarih', type: 'date', required: true, help: 'Yakıt alım tarihi.' },
      { header: 'Plaka', type: 'text', required: true, help: '' },
      { header: 'Sürücü', type: 'text', help: '' },
      { header: 'Litre', type: 'number', required: true, help: 'Alınan yakıt miktarı.' },
      { header: 'Tutar (₺)', type: 'money', required: true, help: 'Ödenen tutar.' },
      { header: 'Kilometre', type: 'number', help: 'Alım anındaki kilometre.' },
      { header: 'İstasyon', type: 'text', help: '' },
    ],
    rows: () => {
      const r = rng(71)
      const cars = [['34 AB 1203', 'Ali Aydın'], ['06 KLM 77', 'Burak Öztürk'], ['35 TR 4410', 'Hüseyin Kurt'], ['16 YZ 902', 'İbrahim Polat']]
      const km: Record<string, number> = { '34 AB 1203': 84000, '06 KLM 77': 121000, '35 TR 4410': 45000, '16 YZ 902': 99000 }
      return lastDays(150).filter(() => r() < 0.5).map((d) => {
        const [plate, driver] = pick(r, cars)
        const lt = round(35 + r() * 45, 0.1)
        km[plate] += Math.floor(300 + r() * 500)
        return [iso(d), plate, driver, lt, round(lt * (43.5 + r() * 2.5), 0.01), km[plate], pick(r, ['Merkez', 'Otoyol', 'Tesis Yanı'])]
      })
    },
    widgets: (s) => {
      const b = base(s, 'Tarih')
      return [
        blankWidget({ ...b, type: 'stat', title: 'Toplam Yakıt Gideri', size: 4, measures: [{ agg: 'sum', column: k('Tutar (₺)') }] }),
        blankWidget({ ...b, type: 'stat', title: 'Toplam Litre', size: 4, measures: [{ agg: 'sum', column: k('Litre') }] }),
        blankWidget({ ...b, type: 'stat', title: 'Araç Sayısı', size: 4, measures: [{ agg: 'countDistinct', column: k('Plaka') }] }),
        blankWidget({ ...b, type: 'bar', title: 'Aylık Yakıt Gideri · Araç', size: 8, x: k('Tarih'), bucket: 'month', splitBy: k('Plaka'), stacked: true, measures: [{ agg: 'sum', column: k('Tutar (₺)') }], limit: 6 }),
        blankWidget({ ...b, type: 'donut', title: 'Araç Payı', size: 4, x: k('Plaka'), measures: [{ agg: 'sum', column: k('Tutar (₺)') }], limit: 7 }),
        blankWidget({ ...b, type: 'table', tableMode: 'summary', title: 'Sürücü Bazında', size: 12, groupBy: k('Sürücü'), measures: [{ agg: 'count', label: 'Alım' }, { agg: 'sum', column: k('Litre') }, { agg: 'sum', column: k('Tutar (₺)') }, { agg: 'max', column: k('Kilometre') }] }),
      ]
    },
  },
]

const cache = new Map<string, TabularData>()

/** Örneğin verisini bileşenlerin okuduğu tablo biçiminde verir (bellekte, sunucuya gitmez). */
export function sampleData(id: string): TabularData | undefined {
  if (cache.has(id)) return cache.get(id)
  const s = SAMPLE_PAGES.find((x) => x.id === id)
  if (!s) return undefined
  const data: TabularData = { columns: s.columns.map((c) => ({ key: keyOf(c.header), name: c.header, type: c.type })), rows: s.rows() }
  cache.set(id, data)
  return data
}
