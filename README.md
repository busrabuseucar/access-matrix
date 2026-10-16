# AccessMatrix

Rol, kayıt sahipliği ve organizasyon sınırlarını **gerçek HTTP yanıtlarıyla** gösteren TypeScript yetkilendirme laboratuvarı. Backend her istekte karar verir; arayüzde düğme gizlemek izin kontrolü sayılmaz.

**Geliştiren:** Büşra Buse Uçar · Kişisel yetkilendirme laboratuvarı.

**Demo:** [AccessMatrix'i aç](https://access-matrix-buse.sleek-brush-8818.chatgpt.site) — ilk yayın yalnızca proje sahibine açıktır; herkese açık erişim ayrıca etkinleştirilir.

## Demo sınırı

Bu proje **gerçek bir giriş sistemi değildir**. Her ziyaretçi Ada, Ece, Deniz veya Mert adlı sentetik kimlikleri seçebilir; yönetici kimliği de herkese açıktır. Amaç gerçek kişiyi doğrulamak değil, sunucu tarafındaki yetki kararlarını gözlemlemektir. Kimlik seçme endpoint'i bir üretim sisteminin kimlik doğrulama mekanizması olarak kullanılamaz.

Tüm kayıtlar ve organizasyonlar kurmacadır. Katalog, eğitim için kimlikleri ve kayıt metaverilerini açıklar. Kaynak kodu da örnek kayıtları içerir. API'deki içerik kısıtlaması gerçek veriyi gizlediği iddiası taşımayan bir davranış gösterimidir.

## Kurulum

Node.js 24+ ve Python 3 gerekir. Depoyu klonlayıp:

```bash
git clone https://github.com/busrabuseucar/access-matrix.git
cd access-matrix
```

```bash
npm ci
npm run check
npm run build
npm test
node scripts/check-assets.mjs
npm start
```

Yerel adres: `http://127.0.0.1:8080`. Sunucu sadece bu arayüzde dinler. Yerel başlatıcı her çalıştırmada rastgele bir imza anahtarı üretir; bu nedenle yeniden başlatma önceki demo oturumlarını geçersiz kılar. İsteğe bağlı `DEMO_SESSION_SECRET`, ortamdan en az 43 karakter olarak verilebilir. Paylaşılan yayında 32 rastgele bayttan üretilmiş anahtar, sunucunun gizli ortam değişkeni olarak ayarlanmalıdır; dosyaya veya Git'e konmaz. Eksik anahtarda oturum ve korunan API'ler `503` döner.

## 60 saniyelik demo

1. Oturum yokken bir kaydı oku: **401**.
2. **Ada / Okuyucu** seç; yayınlanmış rehberi oku: **200**. Aynı kaydı dışa aktarmayı dene: **403**.
3. Sahte **X-Role: admin** başlığını etkinleştir ve isteği tekrar gönder: hâlâ **403**.
4. **Ece / Editör** seç; kendi taslağını oku veya dışa aktar: **200**. Deniz'in taslağını oku: **403**.
5. **Deniz / Yönetici** seç; Nova organizasyonunun kaydını oku: **404**. Yönetici de organizasyon sınırını aşamaz.
6. Deniz ile organizasyon raporunu al: yalnızca Atlas'ın **3 kaydı**, **1 yayını**, **2 taslağı** sayılır.

Hızlı senaryo düğmeleri kimliği değiştirip gerçek API isteği gönderir. Beklenen kod düğmede, gelen gerçek durum kodu yanıtta gösterilir. Dışa aktarma izinliyse JSON dosyası indirilebilir. Sonuç ekranı son isteği gösterir; kalıcı denetim günlüğü değildir.

## İzin matrisi

Aşağıdaki kurallar **aynı organizasyon** içindir. Önce geçerli demo oturumu aranır. Kayıt başka organizasyondaysa veya yoksa aynı `404` kararı verilir.

| Rol | Yayınlanmış kayıt okuma | Taslak okuma | Dışa aktarma | Organizasyon raporu |
| --- | --- | --- | --- | --- |
| Anonim | 401 | 401 | 401 | 401 |
| Okuyucu | İzinli | Reddedilir | Reddedilir | Reddedilir |
| Editör | İzinli | Yalnızca kendisinin | Yalnızca kendisinin | Reddedilir |
| Yönetici | İzinli | Organizasyonundaki tümü | Organizasyonundaki tümü | İzinli |

Bu bir rol bazlı erişim kontrolü (RBAC) örneğidir; kayıt sahipliği ve organizasyon nitelikleriyle ek kısıtlar uygulanır. Tanımsız rol ve işlemler varsayılan olarak reddedilir.

## API

| Yöntem ve yol | İşlev |
| --- | --- |
| `GET /api/catalog` | Herkese açık sentetik kimlik ve kayıt metaverileri; gövde içermez. |
| `GET /api/session` | Geçerli demo kimliğini veya `null` döndürür; token döndürmez. |
| `POST /api/session` | Yalnızca `actorId` kabul eder; imzalı demo oturumu verir. |
| `DELETE /api/session` | Tarayıcı çerezini temizler. |
| `GET /api/documents/:id` | Yetki kontrolünden sonra kaydı okur. |
| `GET /api/documents/:id/export` | Ek dışa aktarma izniyle JSON yanıtı verir. |
| `GET /api/admin/report` | Yalnızca yöneticinin kendi organizasyonunu özetler. |

`POST`/`DELETE` oturum işlemleri aynı `Origin` gerektirir; `Sec-Fetch-Site: cross-site` reddedilir. JSON gövde üst sınırı 1 KiB'dir. Rol ve organizasyon alanları içeren oturum istekleri reddedilir. İstemcinin `X-Role`, kullanıcı/organizasyon başlıkları ve sorgu parametreleri yetki sağlamaz.

Korunan işlem yanıtları `actor`, `action`, `decision` ve rastgele `requestId` içerir. Kayıt içeriği ancak `decision.allowed=true` ise `data` alanına eklenir. `404` yanıtı, bulunmayan kayıt ile başka organizasyondaki kaydı aynı kararla temsil eder. Bilinmeyen yollar ve desteklenmeyen yöntemler reddedilir.

## Demo oturumları

- Sunucu, yalnızca seçilen demo kimliğinin ID'sini, sürümü, zamanları ve rastgele nonce bilgisini HMAC-SHA-256 ile imzalar. Bu uygulamaya özel bir token biçimidir; JWT uygulaması değildir.
- Rol ve organizasyon, her istekte sunucunun sabit kimlik kataloğundan çözülür. Değiştirilmiş imza, bozuk kodlama, bilinmeyen kimlik, geçersiz ömür ve süresi dolmuş token kabul edilmez.
- Token 30 dakika geçerlidir. Çerez `HttpOnly`, `SameSite=Strict`, `Path=/` kullanır; HTTPS üzerinde `Secure` eklenir. İstemci JavaScript kodu token'ı okumaz.
- Kimlik seçimi tarayıcıdaki tüm sekmeleri etkiler. Sonuç paneli, gerçek yanıtın kimliğini göstererek hangi kimlikle değerlendirme yapıldığını açıklar.
- Merkezi iptal listesi yoktur. Çıkış çerezi temizler; daha önce kopyalanmış token, 30 dakikalık ömür dolana veya anahtar değiştirilene kadar doğrulanabilir.

## Mimari ve saklama

Çalışma zamanında üçüncü taraf JavaScript bağımlılığı yoktur. Cloudflare uyumlu Worker `fetch(Request, env)` arayüzü kullanılır. Node.js yerel adaptörü aynı derlenmiş Worker kodunu çağırır. Arayüz TypeScript'ten derlenir; HTML, CSS ve istemci kodu derleme sırasında Worker'a gömülür.

Veritabanı, kalıcı kayıt güncelleme, gerçek kullanıcı şifresi, harici kimlik sağlayıcısı, kalıcı işlem günlüğü veya merkezi hız sınırı yoktur. Gerçek kimlik verisi girişi veya dosya yükleme yüzeyi de yoktur. Kullanıcıya yalnızca kurmaca kayıtlar sunulur. Yanıtlar `Cache-Control: no-store` taşır. Bu yapı üretim için hazır bir IAM sistemi olarak sunulmaz.

```text
src/server/policy.ts   Rol, sahiplik ve organizasyon kuralları
src/server/session.ts  Demo token imzası ve doğrulama
src/server/index.ts    API ve gömülü statik dosyalar
src/client/app.ts      Kimlik seçimi, istekler ve yanıt gösterimi
scripts/server.mjs    Yerel Node.js HTTP adaptörü
tests/                İzin matrisi, oturum ve gerçek API testleri
```

## Doğrulama

**36 Node testi:** 12 politika, 7 oturum ve 17 API/çalışma zamanı testi. API testleri dört kimlik × dört kayıt × okuma/dışa aktarma olmak üzere 32 karar birleşimini açık beklentilerle doğrular. Sahte rol başlıkları, organizasyon sınırı, imza bozma, tekrarlı çerez, çıkış Origin kontrolü ve ret yanıtlarında veri bulunmaması denetlenir.

**1 Python testi** kaynak ZIP'inin özel yerel dosyaları ve sembolik bağlantıları dışladığını kontrol eder. **4 Chromium senaryosu** (iki akış × masaüstü/Pixel 7 emülasyonu) gerçek yerel HTTP sunucusu ve imzalı çerezlerle çalışır; API taklidi kullanılmaz. 401/403/404 kararları, organizasyon raporu, izin verilen JSON indirme, HttpOnly/SameSite, sayfa yenileme ve çıkış sonrası erişim kontrol edilir. Fiziksel cihaz veya canlı yayın testi değildir.

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
npx playwright install chromium
npm run test:browser
```

TypeScript 5.9.3 ve Playwright 1.58.2 geliştirme bağımlılıkları sabitlenmiştir. CI; tür kontrolü, derleme, Node/Python testleri, gömülü kaynak yolları ve Chromium testlerini çalıştırır. [GitHub CI sonuçları](https://github.com/busrabuseucar/access-matrix/actions/workflows/ci.yml).

Kaynak ZIP yalnızca tanımlı kök dosyaları ve kaynak dizinlerindeki izinli uzantıları içerir. Ortam dosyaları, özel JSON/veritabanları, sembolik bağlantılar ve test çıktıları dışlanır. Sites kimliği yerine boş, taşınabilir manifest eklenir. Bu kural kaynak içine yazılan sırları tespit etmez. GitHub sürümü mevcut özel Sites yayınının kaynaklarından hazırlanmıştır; Sites yayını ve erişim ayarları ayrıca güncellenmemiştir.

## Teknik dayanaklar

- [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) — her istekte yetki kontrolü ve varsayılan ret.
- [OWASP: Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) — gerçek kişiyi doğrulamanın yetkilendirmeden farkı.
- [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) — çerez özellikleri.

MIT lisansı.
