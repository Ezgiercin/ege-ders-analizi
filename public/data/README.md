# Ders kataloğu verisi

Bu klasördeki dosyalar `npm run scrape` ile üretilir; elle düzenlenmez.

- `programlar.json` — tüm programların dizini (fakülte, bölüm, derece, ders sayısı)
- `program/<id>.json` — o programın müfredatı: dersler, dönemleri, AKTS'leri,
  zorunlu/seçmeli durumu ve seçmeli ders grupları

Kaynak: https://ebp.ege.edu.tr (Ege Üniversitesi Bologna bilgi paketi).
Müfredat yılda bir güncellendiği için scraper'ı dönem başlarında bir kez
çalıştırmak yeterli.
