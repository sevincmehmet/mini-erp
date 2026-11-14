// Sunucusuz demo paketi: API (tek dosya, .NET gömülü) uygulamanın içine konur ve yerel SQLite ile çalışır.
// Kullanım: npm run dist:demo:win  (ya da dist:demo:mac)
const base = require('./package.json').build
const rid = process.env.DEMO_RID || 'win-x64'

module.exports = {
  ...base,
  appId: 'com.minierp.demo',
  productName: 'Mini-ERP Demo',
  // Ayrı ad: demo ile gerçek sürüm aynı bilgisayarda birbirinin verisine karışmaz
  extraMetadata: { name: 'minierp-demo' },
  directories: { ...base.directories, output: 'release-demo' },
  extraResources: [{ from: `../backend/publish/${rid}`, to: 'api', filter: ['**/*', '!*.pdb', '!appsettings.Development.json', '!web.config'] }],
  publish: null,
  win: { ...base.win, target: [{ target: 'nsis', arch: ['x64'] }], artifactName: 'Mini-ERP-Demo-Kurulum-${version}.${ext}' },
  nsis: {
    oneClick: true,            // tek tık kurulum, yönetici yetkisi istemez
    perMachine: false,
    runAfterFinish: true,
    createDesktopShortcut: true,
    shortcutName: 'Mini-ERP Demo',
    deleteAppDataOnUninstall: true,
  },
  // Apple Developer sertifikası yok: ad-hoc imza ('-'). İmzasız paket Apple Silicon'da indirildikten
  // sonra "hasarlı" diye açılmaz; ad-hoc imzayla Sistem Ayarları > Gizlilik ve Güvenlik > "Yine de Aç" yeterli.
  // Noter onayı (notarization) olmadığı için hardened runtime'a gerek yok.
  mac: { ...base.mac, target: ['dmg'], identity: '-', hardenedRuntime: false, artifactName: 'Mini-ERP-Demo-${version}-${arch}.${ext}' },
}
