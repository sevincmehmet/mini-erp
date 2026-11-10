import type { CellValue, ColumnType } from '../../types/electron'
import { asDate, asInt, asNumber, asText, asTime } from './normalize'

export type ImportKind = 'employees' | 'transactions' | 'shift-assignments' | 'time-entries' | 'cari-documents'

export interface ImportField {
  key: string
  label: string
  required?: boolean
  /** Excel başlıklarını otomatik eşleştirmek için eş anlamlılar (sadeleştirilmiş). */
  synonyms: string[]
  help: string
  type?: ColumnType
  example: CellValue[]
}

export interface ImportKindDef {
  kind: ImportKind
  title: string
  description: string
  fields: ImportField[]
  /** Eşlenmiş hücreleri API satırına çevirir. `get` alan anahtarıyla hücreyi verir. */
  toRow: (get: (key: string) => CellValue, row: number) => Record<string, unknown>
  /** En az biri eşlenmeli alan grupları (ör. Ad+Soyad ya da Ad Soyad). */
  requiredAny?: string[][]
}

const splitName = (full: string | null) => {
  if (!full) return { first: null, last: null }
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return { first: parts[0], last: null }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
}

export const IMPORT_KINDS: Record<ImportKind, ImportKindDef> = {
  employees: {
    kind: 'employees',
    title: 'Personel',
    description: 'Her satır bir çalışan. Sicil no aynı olan çalışan güncellenir, yoksa yeni kayıt açılır.',
    requiredAny: [['firstName', 'fullName'], ['lastName', 'fullName']],
    fields: [
      { key: 'employeeNumber', label: 'Sicil No', synonyms: ['sicil', 'sicil no', 'personel no', 'sicil numarasi', 'no'], help: 'Şirket içinde benzersiz numara. Doluysa eşleştirme bununla yapılır.', example: ['S2-201', 'S2-202'] },
      { key: 'fullName', label: 'Ad Soyad', synonyms: ['ad soyad', 'adi soyadi', 'isim soyisim', 'personel', 'calisan', 'adsoyad', 'personel adi'], help: 'Ad ve soyad tek sütundaysa bunu kullanın (son kelime soyad sayılır).', example: [null, null] },
      { key: 'firstName', label: 'Ad', synonyms: ['ad', 'adi', 'isim'], help: 'Zorunlu (ya da Ad Soyad sütunu).', example: ['Deniz', 'Kaan'] },
      { key: 'lastName', label: 'Soyad', synonyms: ['soyad', 'soyadi', 'soyisim'], help: 'Zorunlu (ya da Ad Soyad sütunu).', example: ['Yıldırım', 'Er'] },
      { key: 'nationalId', label: 'TC Kimlik No', synonyms: ['tc', 'tc kimlik', 'tc kimlik no', 'tckn', 'kimlik no'], help: '11 haneli.', example: [null, null] },
      { key: 'position', label: 'Pozisyon', synonyms: ['pozisyon', 'gorev', 'unvan', 'departman', 'gorevi'], help: '', example: ['Muhasebe', 'Teknisyen'] },
      { key: 'phone', label: 'Telefon', synonyms: ['telefon', 'tel', 'gsm', 'cep', 'cep telefonu'], help: '', example: ['0532 111 22 33', null] },
      { key: 'hireDate', label: 'İşe Giriş', type: 'date', synonyms: ['ise giris', 'ise giris tarihi', 'giris tarihi', 'baslangic'], help: 'Boşsa bugünün tarihi kullanılır.', example: ['2026-01-05', '2026-03-01'] },
      { key: 'payType', label: 'Ücret Tipi', synonyms: ['ucret tipi', 'calisma sekli', 'ucret turu', 'tip'], help: '"Aylık" ya da "Saatlik". Boşsa Aylık.', example: ['Aylık', 'Saatlik'] },
      { key: 'baseSalary', label: 'Brüt Maaş', type: 'money', synonyms: ['brut maas', 'maas', 'brut', 'brut ucret', 'aylik ucret'], help: 'Aylık ücretlilerde zorunlu.', example: [52000, null] },
      { key: 'hourlyRate', label: 'Saat Ücreti', type: 'money', synonyms: ['saat ucreti', 'saatlik ucret', 'saatlik'], help: 'Saatlik ücretlilerde zorunlu.', example: [null, 215] },
    ],
    toRow: (get, row) => {
      const split = splitName(asText(get('fullName')))
      return {
        row,
        firstName: asText(get('firstName')) ?? split.first,
        lastName: asText(get('lastName')) ?? split.last,
        employeeNumber: asText(get('employeeNumber')),
        nationalId: asText(get('nationalId'))?.replace(/\D/g, '') || null,
        position: asText(get('position')),
        phone: asText(get('phone')),
        hireDate: asDate(get('hireDate')),
        payType: asText(get('payType')),
        baseSalary: asNumber(get('baseSalary')),
        hourlyRate: asNumber(get('hourlyRate')),
      }
    },
  },

  transactions: {
    kind: 'transactions',
    title: 'Gelir ve Gider',
    description: 'Her satır bir hareket. Tür sütunu yoksa negatif tutar gider, pozitif tutar gelir sayılır; ayrı "Gelir" ve "Gider" tutar sütunları da kullanılabilir. Belge no aynıysa kayıt güncellenir.',
    requiredAny: [['amount', 'incomeAmount', 'expenseAmount']],
    fields: [
      { key: 'date', label: 'Tarih', required: true, type: 'date', synonyms: ['tarih', 'islem tarihi', 'fatura tarihi', 'date'], help: '15.09.2026 gibi.', example: ['2026-10-01', '2026-10-03'] },
      { key: 'description', label: 'Açıklama', required: true, synonyms: ['aciklama', 'detay', 'islem', 'konu', 'aciklamasi'], help: '', example: ['Ofis kirası', 'Proje hakedişi'] },
      { key: 'type', label: 'Tür', synonyms: ['tur', 'tip', 'gelir gider', 'islem turu'], help: '"Gelir" ya da "Gider".', example: ['Gider', 'Gelir'] },
      { key: 'amount', label: 'Tutar', type: 'money', synonyms: ['tutar', 'miktar', 'toplam', 'tutar tl', 'bedel'], help: 'Tür boşsa işaretine bakılır (−1.500 = gider).', example: [65000, 180000] },
      { key: 'incomeAmount', label: 'Gelir Tutarı', type: 'money', synonyms: ['gelir', 'alacak', 'tahsilat', 'giris'], help: 'Gelir ve gider ayrı sütunlardaysa.', example: [null, null] },
      { key: 'expenseAmount', label: 'Gider Tutarı', type: 'money', synonyms: ['gider', 'borc', 'odeme', 'cikis', 'masraf'], help: 'Gelir ve gider ayrı sütunlardaysa.', example: [null, null] },
      { key: 'category', label: 'Kategori', synonyms: ['kategori', 'hesap', 'grup', 'masraf merkezi', 'kalem'], help: 'Yoksa otomatik oluşturulur.', example: ['Kira', 'Hizmet Geliri'] },
      { key: 'documentNo', label: 'Belge No', synonyms: ['belge no', 'fatura no', 'evrak no', 'fis no', 'belge'], help: 'Doluysa tekrar aktarımda kayıt güncellenir.', example: ['GD-1001', 'FT-2044'] },
    ],
    toRow: (get, row) => {
      const income = asNumber(get('incomeAmount'))
      const expense = asNumber(get('expenseAmount'))
      let amount = asNumber(get('amount'))
      let type = asText(get('type'))
      if (amount == null && income) { amount = Math.abs(income); type ??= 'Gelir' }
      if (amount == null && expense) { amount = Math.abs(expense); type ??= 'Gider' }
      return { row, date: asDate(get('date')), type, amount, description: asText(get('description')), category: asText(get('category')), documentNo: asText(get('documentNo')) }
    },
  },

  'shift-assignments': {
    kind: 'shift-assignments',
    title: 'Vardiya Planı',
    description: 'Liste biçimi: her satır bir çalışanın bir günkü vardiyası. Çizelge biçimi (satırlar çalışan, sütunlar gün) için üstten "Çizelge"yi seçin. Vardiya adının ilk harfleri yeter (S = Sabah).',
    fields: [
      { key: 'employee', label: 'Çalışan', required: true, synonyms: ['calisan', 'personel', 'ad soyad', 'sicil', 'sicil no', 'adi soyadi', 'isim'], help: 'Sicil no ya da ad soyad.', example: ['S7-001', 'Mehmet Kaya'] },
      { key: 'date', label: 'Tarih', required: true, type: 'date', synonyms: ['tarih', 'gun', 'date'], help: '', example: ['2026-10-12', '2026-10-12'] },
      { key: 'shift', label: 'Vardiya', required: true, synonyms: ['vardiya', 'vardiya adi', 'mesai', 'shift'], help: 'Tanımlı vardiya adı ya da kısaltması.', example: ['Sabah', 'Gece'] },
      { key: 'status', label: 'Durum', synonyms: ['durum', 'status'], help: 'Planlandı / Tamamlandı / Gelmedi / İzinli. Boşsa Planlandı.', example: [null, 'İzinli'] },
      { key: 'note', label: 'Not', synonyms: ['not', 'aciklama', 'notlar'], help: '', example: [null, null] },
    ],
    toRow: (get, row) => ({ row, employee: asText(get('employee')), date: asDate(get('date')), shift: asText(get('shift')), status: asText(get('status')), note: asText(get('note')) }),
  },

  'time-entries': {
    kind: 'time-entries',
    title: 'Mesai Kayıtları (Puantaj)',
    description: 'Her satır bir çalışma: çalışan, tarih, giriş ve çıkış saati. Çıkış girişten küçükse ertesi gün sayılır. Fazla mesai, o günkü vardiya planına göre otomatik hesaplanır.',
    fields: [
      { key: 'employee', label: 'Çalışan', required: true, synonyms: ['calisan', 'personel', 'ad soyad', 'sicil', 'sicil no', 'adi soyadi', 'isim'], help: 'Sicil no ya da ad soyad.', example: ['S7-001', 'S7-002'] },
      { key: 'date', label: 'Tarih', required: true, type: 'date', synonyms: ['tarih', 'gun', 'date'], help: '', example: ['2026-10-06', '2026-10-06'] },
      { key: 'clockIn', label: 'Giriş', required: true, synonyms: ['giris', 'giris saati', 'baslangic', 'mesai baslangic', 'in'], help: '08:00 gibi.', example: ['08:00', '22:00'] },
      { key: 'clockOut', label: 'Çıkış', required: true, synonyms: ['cikis', 'cikis saati', 'bitis', 'mesai bitis', 'out'], help: '17:30 gibi.', example: ['18:30', '06:15'] },
      { key: 'breakMinutes', label: 'Mola (dk)', type: 'number', synonyms: ['mola', 'mola dk', 'ara', 'yemek arasi', 'mola suresi'], help: 'Boşsa vardiya tanımındaki mola kullanılır.', example: [30, null] },
      { key: 'note', label: 'Not', synonyms: ['not', 'aciklama'], help: '', example: [null, 'Arıza müdahalesi'] },
    ],
    toRow: (get, row) => ({
      row, employee: asText(get('employee')), date: asDate(get('date')),
      clockIn: asTime(get('clockIn')), clockOut: asTime(get('clockOut')), breakMinutes: asInt(get('breakMinutes')), note: asText(get('note')),
    }),
  },

  'cari-documents': {
    kind: 'cari-documents',
    title: 'Cari Belgeler (Faturalar)',
    description: 'Her satır bir vadeli belge: satış faturası (alacak) ya da alış faturası (borç). Listede olmayan cariler otomatik açılır; belge no aynıysa kayıt güncellenir. Vade boşsa carinin varsayılan vadesi kullanılır.',
    fields: [
      { key: 'party', label: 'Cari', required: true, synonyms: ['cari', 'musteri', 'tedarikci', 'firma', 'unvan', 'cari adi', 'firma adi'], help: 'Müşteri ya da tedarikçi adı.', example: ['Ege Gıda', 'Kablo Toptan'] },
      { key: 'type', label: 'Tür', required: true, synonyms: ['tur', 'tip', 'alacak borc', 'fatura turu', 'belge turu'], help: '"Alacak" (satış) ya da "Borç" (alış).', example: ['Alacak', 'Borç'] },
      { key: 'documentNo', label: 'Belge No', synonyms: ['belge no', 'fatura no', 'evrak no', 'seri no'], help: 'Doluysa tekrar aktarımda güncellenir.', example: ['SF-2041', 'AF-118'] },
      { key: 'date', label: 'Belge Tarihi', required: true, type: 'date', synonyms: ['tarih', 'fatura tarihi', 'belge tarihi', 'islem tarihi'], help: '', example: ['2026-09-15', '2026-09-20'] },
      { key: 'dueDate', label: 'Vade Tarihi', type: 'date', synonyms: ['vade', 'vade tarihi', 'odeme tarihi', 'son odeme'], help: 'Boşsa varsayılan vade.', example: ['2026-10-15', '2026-11-04'] },
      { key: 'amount', label: 'Tutar', required: true, type: 'money', synonyms: ['tutar', 'toplam', 'fatura tutari', 'genel toplam', 'kdv dahil'], help: '', example: [84500, 23600] },
      { key: 'description', label: 'Açıklama', synonyms: ['aciklama', 'not', 'konu'], help: '', example: ['Kurulum hizmeti', 'Kablo alımı'] },
    ],
    toRow: (get, row) => ({
      row, party: asText(get('party')), type: asText(get('type')), documentNo: asText(get('documentNo')),
      date: asDate(get('date')), dueDate: asDate(get('dueDate')), amount: asNumber(get('amount')), description: asText(get('description')),
    }),
  },
}
