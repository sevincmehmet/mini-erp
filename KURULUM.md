# Mini-ERP — Kurulum ve Dağıtım

## 1. Geliştirme (bu bilgisayar)
```bash
docker start minierp-sql                      # SQL Server (port 14333)
cd backend && dotnet run --project src/MiniErp.Api --urls http://localhost:5080
cd desktop && npm run dev                     # Electron + Vite
```
Demo giriş: `yonetici@ornek.com` / `MiniErp2026!` · Örnek veriyi baştan üretmek: `dotnet run --project src/MiniErp.Api -- --seed`

Testler: `cd backend && dotnet test` (bordro, kıst gün, izin, şirket izolasyonu) · `cd desktop && npm test` (Excel ayrıştırma, sayfa motoru)

## 2. Sunucu (API + veritabanı)
Bir Linux sunucu (2 GB+ RAM) ve ona yönlendirilmiş bir alan adı gerekir.
```bash
cp .env.example .env        # API_DOMAIN, SQL_SA_PASSWORD, JWT_KEY doldurun (JWT_KEY: openssl rand -base64 48)
docker compose up -d        # SQL Server + API + Caddy (otomatik Let's Encrypt HTTPS)
curl https://ALAN-ADINIZ/health
```
- Veritabanı şeması API açılışında otomatik güncellenir (`Database__MigrateOnStartup`).
- SQL Server portu dışarı açılmaz; yalnızca 80/443 açıktır. Mümkünse güvenlik duvarında 443'ü yalnızca ofis IP'lerine açın ya da VPN kullanın.
- İlk açılışta uygulama "ilk kurulum" ekranını gösterir: burada oluşturulan kullanıcı tüm şirketlerin sahibi olur.
- Giriş, kurulum ve şifre değiştirme IP başına dakikada 10 denemeyle sınırlıdır.
- Sunucu tarafı yedek: `sqldata` hacmini düzenli yedekleyin. Uygulamadaki JSON yedekleri buna ek olarak her bilgisayarda tutulur (belge ekleri JSON yedeğe dahil değildir).

Masaüstü uygulamada **Ayarlar → Sunucu** ekranından `https://ALAN-ADINIZ` adresini girin.

## 3. Masaüstü paketleri
```bash
cd desktop
npm run dist:win     # Windows kurulum dosyası (NSIS) → release/
npm run dist:mac     # macOS dmg + zip → release/
npm run dist:dir     # imzasız, kurulumsuz test paketi
```
- Windows paketi en sağlıklı şekilde Windows'ta (veya CI'da) üretilir.
- **İmza yok:** Windows SmartScreen "tanınmayan yayıncı", macOS Gatekeeper "geliştirici doğrulanamadı" uyarısı verir. Dağıtımdan önce Windows için kod imzalama sertifikası, macOS için Apple Developer hesabı (imza + notarization) gerekir.
- **Otomatik güncelleme:** `package.json > build.publish.url` alanını gerçek güncelleme sunucusuyla değiştirin; `release/` içindeki `latest.yml` / `latest-mac.yml` ve kurulum dosyalarını oraya yükleyin.
- Uygulama ikonu için `desktop/build/icon.png` (1024×1024) ekleyin.

## 4. Sunucusuz demo paketi (tanıtım için)
Sunucu kurmadan gönderilebilen sürüm: API uygulamanın içine gömülür, kullanıcının bilgisayarında yalnızca `127.0.0.1` üzerinden çalışır ve verileri yerel bir SQLite dosyasında tutar. İlk açılışta örnek veriler kendiliğinden oluşturulur.
```bash
cd desktop
npm run dist:demo:win    # → release-demo/Mini-ERP-Demo-Kurulum-<sürüm>.exe (tek tık kurulum)
npm run dist:demo:mac    # → release-demo/Mini-ERP-Demo-<sürüm>-arm64.dmg
```
- .NET kurulu olması gerekmez; API kendi çalışma zamanıyla tek dosya olarak paketlenir (`backend/publish/<rid>`).
- Demo verileri: Windows'ta `%APPDATA%\minierp-demo\demo\` (`demo.db`, `sunucu.log`). Kaldırınca silinir.
- Ayarlar → Demo → "Demoyu Baştan Kur" verileri ilk hâline döndürür.
- Gönderirken `desktop/build/DEMO-KURULUM.txt` dosyasını da ekleyin (SmartScreen uyarısı ve giriş bilgileri).
- GitHub'dan Electron indirmesi takılırsa: Electron zip'ini elle indirip `-c.electronDist=<klasör>` ile verin.

## 5. Bordro parametreleri
Varsayılan oranlar ve 2026 asgari ücret/vergi dilimleri **tahminidir**. Her yıl başında **Ayarlar → Bordro Parametreleri** ekranından mali müşaviriniz ile doğrulayıp kaydedin. Teşvik, engellilik indirimi gibi özel durumlar hesaplanmaz; resmî bordro için "Muhasebeciye Aktar" çıktısını kullanın.
