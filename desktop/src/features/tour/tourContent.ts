import type { IconName } from '../../components/ui/Icons'
import type { BuiltinPage } from '../../stores/useNavStore'

export interface TourChapter {
  id: string
  icon: IconName
  /** Sol listedeki kısa ad */
  label: string
  title: string
  lead: string
  bullets: string[]
  /** public/tour altındaki ekran görüntüsü */
  image?: string
  /** "Bu ekranı aç" ile gidilecek sayfa */
  page?: BuiltinPage
}

export const TOUR: TourChapter[] = [
  {
    id: 'welcome', icon: 'sparkles', label: 'Hoş geldiniz',
    title: 'Şirketlerinizin tamamı tek ekranda',
    lead: 'Mini-ERP; personel, vardiya, puantaj, bordro, gelir-gider ve cari takibini birden fazla şirket için tek uygulamada toplar. Excel ile çalışmayı bırakmanız gerekmez: dosyalarınızı sürükleyip bırakarak içeri alır, her şeyi tek tıkla Excel\'e geri verirsiniz.',
    bullets: ['Birden çok şirket, tek tıkla geçiş', 'Excel içe ve dışa aktarım', 'Türkiye mevzuatına göre bordro', 'Verileriniz sizde: yerel yedek'],
    image: 'dashboard.jpg', page: 'dashboard',
  },
  {
    id: 'dashboard', icon: 'dashboard', label: 'Genel Bakış',
    title: 'Günün özeti, ilk bakışta',
    lead: 'Bu ayın geliri, gideri, net kârı ve aktif personel sayısı; son 6 ayın gelir-gider grafiği ve en büyük gider kalemleri. Kartların yerini ve görünürlüğünü kendinize göre düzenleyebilirsiniz.',
    bullets: ['Önceki aya göre değişim', 'Sürükle-bırak ile düzen', 'PDF olarak rapor alma'],
    image: 'dashboard.jpg', page: 'dashboard',
  },
  {
    id: 'consolidated', icon: 'buildings', label: 'Tüm Şirketler',
    title: 'Konsolide görünüm',
    lead: 'Tüm şirketlerinizin gelir, gider, kâr, açık alacak ve bekleyen bordrolarını yan yana görün. Bir şirket kartına tıklayınca doğrudan o şirkete geçersiniz.',
    bullets: ['Şirket karşılaştırma grafikleri', 'Toplam açık alacak ve vadesi geçenler', 'Tek tıkla şirkete geçiş'],
    image: 'consolidated.jpg', page: 'consolidated',
  },
  {
    id: 'hr', icon: 'shifts', label: 'Personel ve Vardiya',
    title: 'Personel, vardiya planı ve puantaj',
    lead: 'Personel kartları, haftalık vardiya planı ve gerçekleşen mesai kayıtları. Gece vardiyaları, fazla mesai ve molalar otomatik hesaplanır; puantaj doğrudan bordroya akar.',
    bullets: ['Haftalık vardiya takvimi', 'Fazla mesai hesabı', 'Excel\'deki vardiya çizelgesini olduğu gibi içeri alma'],
    image: 'shifts.jpg', page: 'shifts',
  },
  {
    id: 'payroll', icon: 'payroll', label: 'Bordro',
    title: 'Mevzuata göre bordro',
    lead: 'Puantajdan brüt ücret, SGK ve işsizlik primleri, kümülatif gelir vergisi, asgari ücret istisnası, damga vergisi ve işveren maliyeti hesaplanır. Onaylanan bordro ödendiğinde gider olarak kendiliğinden işlenir.',
    bullets: ['Kıst gün ve fazla mesai', 'Yıllık parametreler ekrandan düzenlenir', 'Muhasebeciye Excel çıktısı'],
    image: 'payroll.jpg', page: 'payroll',
  },
  {
    id: 'leaves', icon: 'beach', label: 'İzinler',
    title: 'İzin talepleri ve bakiyeler',
    lead: 'Kıdeme göre yıllık izin hakkı (14 / 20 / 26 gün) otomatik hesaplanır. Onaylanan izin vardiya planına işlenir; kalan izin günleri her zaman güncel görünür.',
    bullets: ['Yıllık, mazeret, raporlu, ücretsiz izin', 'Onay / ret akışı', 'Vardiya planıyla entegre'],
    image: 'leaves.jpg', page: 'leaves',
  },
  {
    id: 'finance', icon: 'handshake', label: 'Gelir-Gider ve Cari',
    title: 'Para nereden geliyor, nereye gidiyor?',
    lead: 'Gelir-gider kayıtları kategorilere ayrılır; fatura ve fişler kayda eklenir. Cari ekranında müşteri alacakları ve tedarikçi borçları vadeleriyle izlenir; tahsilat ve ödemeler gelir-gidere kendiliğinden işlenir.',
    bullets: ['Vadesi geçen / yaklaşan uyarıları', 'Kısmi tahsilat ve ödeme', 'Cari hesap ekstresi'],
    image: 'cari.jpg', page: 'cari',
  },
  {
    id: 'excel', icon: 'excel', label: 'Excel ile Çalışma',
    title: 'Excel dosyalarınız boşa gitmiyor',
    lead: 'Mevcut Excel dosyanızı pencereye sürükleyin: sütunlar otomatik eşleşir, Türkçe tarih ve tutar biçimleri tanınır, içeri almadan önce önizleme görürsünüz. Her tablo tek tıkla biçimli Excel olarak dışa aktarılır.',
    bullets: ['Sürükle-bırak içe aktarım', 'Hazır Excel şablonları', 'Dosyayı izle: Excel\'de kaydettikçe güncellenir'],
    image: 'import.jpg', page: 'finance',
  },
  {
    id: 'builder', icon: 'layout', label: 'Kendi Sayfalarınız',
    title: 'Kendi raporlarınızı kendiniz tasarlayın',
    lead: 'Tablolar, grafikler, özet kartları ve listelerden oluşan sayfalar oluşturun; bunları uygulama verilerine ya da yüklediğiniz Excel dosyalarına bağlayın. Örnek sayfalar galerisinden hazır bir şablonla da başlayabilirsiniz.',
    bullets: ['Çizgi, sütun, halka grafikler', 'Filtre ve tarih aralığı', 'Excel\'den otomatik sayfa'],
    image: 'gallery.jpg', page: 'gallery',
  },
  {
    id: 'safety', icon: 'shield', label: 'Güvenlik ve Yedek',
    title: 'Verileriniz güvende, kontrol sizde',
    lead: 'Her şirket için günlük otomatik yedek, tek tıkla geri yükleme ve çöp kutusu. Kullanıcılar şirket bazında Sahip, Yönetici ya da İzleyici rolü alır; kim neyi ne zaman değiştirdi Değişiklik Kaydı\'nda görünür. Uygulama boşta kalınca kilitlenir.',
    bullets: ['Otomatik yerel yedek ve geri yükleme', 'Rol bazlı yetki', 'Değişiklik kaydı ve çöp kutusu', 'Bildirim merkezi'],
    image: 'backup.jpg', page: 'backup',
  },
]
