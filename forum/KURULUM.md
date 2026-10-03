# Forum sayfasını kurma (önce yerelde)

Hesaplayıcı iki parçadan oluşuyor:

1. **Vite uygulaması** — hesabı yapan araç. Kendi adresinden yayınlanır.
2. **Forum sayfası** — forumun teması içinde açılan `/ders-analizi` sayfası.
   Açıklama metinleri bu sayfanın HTML'inde durur (arama motorları bunu okur),
   araç ise iframe olarak gömülüdür.

Bu yapı DEÜ Forum'un kullandığı yapıyla aynıdır.

## 1. Uygulamayı çalıştır

```bash
npm run dev
```

Adres: `http://localhost:5173/ders-analizi/`
Gömülü hâli: `http://localhost:5173/ders-analizi/?embed=1`

## 2. NodeBB'ye özel sayfa eklentisini kur

NodeBB klasöründe:

```bash
npm install nodebb-plugin-custom-pages
./nodebb build        # Windows: .\nodebb.bat build
./nodebb dev
```

Admin → Extend → Plugins → "Custom Pages" → Activate → yeniden başlat.

## 3. Sayfayı oluştur

Admin → Plugins → Custom Pages:

- Route: `ders-analizi`
- Name: `Ders Analizi`
- (varsa) Template: boş bırak

Kaydet, NodeBB'yi yeniden başlat.

## 4. İçeriği yerleştir

Admin → Extend → Widgets → üstteki açılır listeden `Ders Analizi` sayfasını seç →
sağdaki **HTML** widget'ını `content` bölgesine sürükle → içine
`ders-analizi-sayfasi.html` dosyasının içeriğini yapıştır.

`IFRAME_ADRESI` yerine yerel denemede şunu yaz:

```
http://localhost:5173/ders-analizi/
```

(Dosyada zaten sonuna `?embed=1` ekli.)

Save.

## 5. Menüye ekle

Admin → Settings → Navigation → yeni öğe:

- Route: `/ders-analizi`
- Text: `Ders Analizi`
- Icon: `fa-chart-line` (ya da beğendiğin bir ikon)

Save.

## 6. Bak

`http://localhost:4567/ders-analizi` — forumun sol menüsü ve başlığıyla birlikte
sayfa açılmalı, ortada hesaplayıcı çalışmalı.

## Canlıya alırken

Tek değişen şey `IFRAME_ADRESI`: uygulamanın sunucuda yayınlandığı gerçek adres yazılır.
Diğer adımlar birebir aynıdır.
