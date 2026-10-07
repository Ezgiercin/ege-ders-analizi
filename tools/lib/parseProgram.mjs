import * as cheerio from 'cheerio';

const sayi = (t) => {
  const s = String(t ?? '').trim().replace(',', '.');
  if (!s || s === '-') return null;
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
};

const duz = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
// Basliklarda HTML varliklari kullaniliyor (M&#252;fredat gibi); cozmeden eslesmiyor.
const etiketsiz = (h) => duz(cheerio.load(`<div>${String(h)}</div>`)('div').text());

/**
 * Ders Plani altindaki mufredat basliklarini okur.
 * Sitede her mufredat "… için tıklayınız." diye biten bir baslikla aciliyor, ama
 * baslik metni serbest yazilmis ("2024 Yılı Müfredatı (X)", "2018 Ana Müfredat",
 * "2019 Yılı Müf.(X)", "2023-2024 Tarım İşletmeciliği doktora" ...). Bu yuzden
 * bicime degil o kaliba bakiyoruz ve basligi oldugu gibi mufredat adi yapiyoruz;
 * boylece farkli yillarin mufredatlari tek listede birlesmiyor.
 * Eski bicimdeki "Ana Müfredatı (Program)" basliklari da desteklenir.
 * "Silinecek …" bolumleri atlanir.
 */
export function mufredatBasligi(baslik) {
  const ham = duz(baslik);
  const tiklama = ham.match(/^(.*?)\s*için tıklayınız\.?\s*$/i);
  if (tiklama) {
    const ad = duz(tiklama[1]);
    if (!ad) return null;
    return { ad, atla: /^Silinecek\b/i.test(ad) };
  }
  // Program adi kendi icinde parantez tasiyabiliyor: "(Bilgisayar Mühendisliği (İngilizce))"
  const mf = ham.match(/M[üu]fredat[ıi]?\s*\((.+)\)\s*$/i);
  if (mf) return { ad: duz(mf[1]), atla: false };
  return null;
}

/**
 * ebp.ege.edu.tr program sayfasindan mufredati cikarir.
 *
 * Sayfanin HTML'i bozuk — tablolar kapatilmiyor, DOM'da hepsi birkac tabloya
 * karisiyor. Bu yuzden tablo sinirlarina guvenmiyoruz; belge sirasinda
 * ilerleyip su isaretleri takip ediyoruz:
 *   - "... Müfredatı (...)" baslig  -> hangi mufredat (ana program, yandal...)
 *   - colspan'li <th>                -> ya "N. Dönem" ya da secmeli grup adi
 *   - "Ders Kodu ... AKTS" <th> sirasi -> sutun duzeni
 *   - <td>'li satirlar               -> dersler
 */
export function parseProgram(html) {
  const dersler = [];

  let mufredat = null;
  let yariyil = null;
  let grup = null;
  let sutun = null;
  let atla = false; // "Silinecek" gibi kullanilmayan mufredatlar

  // Basliklar ve satirlar, belge sirasinda tek akista.
  const desen = /<h[1-5][^>]*>([\s\S]{0,300}?)<\/h[1-5]>|<tr[\s\S]*?<\/tr>/gi;
  let m;
  while ((m = desen.exec(html)) !== null) {
    if (m[1] !== undefined) {
      const baslik = etiketsiz(m[1]);
      const mb = mufredatBasligi(baslik);
      if (mb) {
        mufredat = mb.ad;
        atla = mb.atla;
        yariyil = null;
        grup = null;
        sutun = null;
      }
      continue;
    }

    const parca = cheerio.load(`<table>${m[0]}</table>`);
    const $tr = parca('tr').first();
    const thler = $tr.find('th');
    const tdler = $tr.find('td');

    if (thler.length) {
      const metinler = thler.map((_, th) => duz(parca(th).text())).get();

      // Tek hucreli genis baslik: donem ya da secmeli grup
      if (thler.length === 1 || (metinler.length === 1 && metinler[0])) {
        const t = metinler[0] || '';
        const d = t.match(/^(\d+)\.\s*D[öo]nem/i);
        if (d) {
          yariyil = parseInt(d[1], 10);
          grup = null;
        } else if (t) {
          grup = t.replace(/\s*$/, '');
          yariyil = null;
        }
        continue;
      }

      const yer = (ad) => metinler.findIndex((b) => b.toLowerCase() === ad.toLowerCase());
      if (yer('Ders Kodu') >= 0 && yer('AKTS') >= 0) {
        sutun = {
          kod: yer('Ders Kodu'),
          dil: yer('Dersin Sunulduğu Dil'),
          ad: yer('Ders Adı'),
          tur: yer('Ders Türü'),
          teori: yer('D'),
          uygulama: yer('U'),
          laboratuvar: yer('L'),
          akts: yer('AKTS'),
        };
      }
      continue;
    }

    if (!tdler.length || !sutun || atla) continue;

    const hucre = (i) => (i >= 0 && i < tdler.length ? duz(tdler.eq(i).text()) : '');
    const kod = hucre(sutun.kod);
    if (!kod || !/^[0-9A-ZÇĞİÖŞÜ]{4,16}$/.test(kod)) continue;

    dersler.push({
      kod,
      ad: hucre(sutun.ad),
      mufredat,
      yariyil,
      grup,
      tur: hucre(sutun.tur) || null,
      dil: hucre(sutun.dil) || null,
      teori: sayi(hucre(sutun.teori)),
      uygulama: sayi(hucre(sutun.uygulama)),
      laboratuvar: sayi(hucre(sutun.laboratuvar)),
      akts: sayi(hucre(sutun.akts)),
      detayYolu: tdler.eq(sutun.kod).find('a').attr('href') || null,
    });
  }

  // Ayni satir sayfada birden fazla kez gecebiliyor; ortalamaya/AKTS'ye bir kez girsin
  const gorulen = new Set();
  return dersler.filter((d) => {
    const k = [d.mufredat, d.yariyil, d.grup, d.kod].join('|');
    if (gorulen.has(k)) return false;
    gorulen.add(k);
    return true;
  });
}
