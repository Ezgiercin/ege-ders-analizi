# Ege Ders Analizi

Ege Üniversitesi öğrencileri için AGNO (Ağırlıklı Genel Not Ortalaması) hesaplama aracı.
EGE Forum (https://ege.uniforum.app) için yazıldı.

Transkript PDF'i **tamamen tarayıcıda** okunur; dosya hiçbir sunucuya gönderilmez.
Arka uç yoktur, çıktı statik dosyalardır.

## Desteklenen transkript biçimleri

| Biçim | Durum |
|---|---|
| e-Devlet — YÖK "Not Döküm Belgesi" | Önerilen. En düzenli biçim. |
| Ege SSO transkripti | Destekleniyor. Muafiyet/tekrar gibi özel durumlarda sapma olabilir. |

Her iki biçimde de hesaplanan ortalama, belgenin kendi yazdığı genel ortalama ile
karşılaştırılır; tutmazsa kullanıcıya uyarı gösterilir.

## Not sistemi

Kaynak: Ege Üniversitesi Ölçme ve Değerlendirme Esasları Yönergesi
(son değişiklik 07.03.2024, Senato Kararı 4/4).

- AGNO = toplam(harf katsayısı × AKTS) / toplam(AKTS) — ağırlık **AKTS**'dir, yerel kredi değil.
- Ders tekrarında **son** harf notu geçerlidir.
- Geçer not CC ve üstüdür; DC ve DD Ege'de başarısız sayılır.

## Geliştirme

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ klasörüne statik çıktı
```

## Yayına alma

`npm run build` sonrası `dist/` klasörünün içeriği, forumun sunucusunda
`/ders-analizi/` yolundan sunulur. `vite.config.ts` içindeki `base` ayarı bu yola göredir.

## Dosya düzeni

```
src/lib/grades.ts      Not sistemi, AGNO hesabı, hedef ortalama
src/lib/transcript.ts  PDF ayrıştırma (e-Devlet ve SSO)
src/App.tsx            Arayüz
```
