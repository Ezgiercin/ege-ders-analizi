// Ege Üniversitesi transkript ayrıştırıcı.
// İki biçimi de okur: e-Devlet (YÖK "Not Döküm Belgesi") ve Ege SSO çıktısı.
// Her şey tarayıcıda çalışır; dosya hiçbir sunucuya gönderilmez.

import * as pdfjsLib from 'pdfjs-dist';
import type { Ders } from './grades';
import { katsayidanHarf } from './grades';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export type Kaynak = 'edevlet' | 'sso';

export interface TranskriptSonuc {
  kaynak: Kaynak;
  ogrenci: { ad?: string; no?: string; program?: string };
  /** Belgenin kendi yazdığı genel ortalama — hesabımızı buna karşı doğruluyoruz. */
  beyanEdilenAgno: number | null;
  dersler: Ders[];
}

interface Parca {
  x: number;
  y: number;
  w: number;
  s: string;
  _y?: number;
}

interface Satir {
  y: number;
  cells: Parca[];
  text: string;
}

const sayi = (s: string | null | undefined): number | null => {
  if (s == null) return null;
  const t = String(s).trim().replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return parseFloat(t);
};

function parcalar(tc: any): Parca[] {
  return (tc.items as any[])
    .filter((it) => it.str && it.str.trim() !== '')
    .map((it) => ({ x: it.transform[4], y: it.transform[5], w: it.width || 0, s: it.str }));
}

function satirlar(items: Parca[], tol = 2.2): Satir[] {
  const sirali = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const out: Satir[] = [];
  for (const it of sirali) {
    const son = out[out.length - 1];
    if (son && Math.abs(son.y - it.y) <= tol) {
      son.cells.push(it);
      son.y = (son.y * (son.cells.length - 1) + it.y) / son.cells.length;
    } else {
      out.push({ y: it.y, cells: [it], text: '' });
    }
  }
  for (const r of out) {
    r.cells.sort((a, b) => a.x - b.x);
    r.text = r.cells.map((c) => c.s).join(' ').replace(/\s+/g, ' ').trim();
  }
  return out;
}

function metinBirlestir(parts: Parca[], bosluk = 1.2): string {
  let out = '';
  let oncekiSon: number | null = null;
  for (const c of parts) {
    if (oncekiSon != null && c.x - oncekiSon > bosluk) out += ' ';
    out += c.s;
    oncekiSon = c.x + (c.w || 0);
  }
  return out.replace(/\s+/g, ' ').trim();
}

function hucreBirlestir(cells: Parca[], bosluk = 1.6): Parca[] {
  const out: Parca[] = [];
  for (const c of cells) {
    const son = out[out.length - 1];
    if (son && c.x - (son.x + son.w) <= bosluk) {
      son.s += c.s;
      son.w = c.x + c.w - son.x;
    } else {
      out.push({ ...c });
    }
  }
  return out;
}

/**
 * SSO çıktısındaki "ÖRNEKTİR" filigranının harfleri metin katmanında başka
 * hücrelerin üstüne biniyor ve ders kodunu bozuyor. Bir parçanın yatay alanına
 * düşen tek harfleri atar.
 */
function filigraniEle(cells: Parca[], harfler: Set<string>): Parca[] {
  return cells.filter((c) => {
    const t = c.s.trim();
    if (t.length > 1 || !harfler.has(t)) return true;
    return !cells.some((o) => o !== c && o.s.trim().length > 2 && c.x > o.x && c.x < o.x + (o.w || 0));
  });
}

function enYakin(cells: Parca[], x: number, tol = 14): string | null {
  let best: Parca | null = null;
  let bestD = Infinity;
  for (const c of cells) {
    const d = Math.abs(c.x - x);
    if (d < bestD && d <= tol) {
      best = c;
      bestD = d;
    }
  }
  return best ? best.s.trim() : null;
}

export function bicimTespit(sayfaMetinleri: string[]): Kaynak | null {
  const duz = sayfaMetinleri.join('\n').replace(/\s+/g, '');
  if (/NOTDÖKÜMBELGES/i.test(duz)) return 'edevlet';
  if (/Başarıkatsayı|ÖğrenciBilgileri|Dersadı/i.test(duz)) return 'sso';
  return null;
}

// ---------------------------------------------------------------- e-Devlet

const DONEM_RE = /(\d{4})\s*-\s*(\d{4})\s+(Güz|Bahar|Yaz)\s+Dönemi/i;
const KOD_AD_RE = /^\*?\s*([0-9A-ZÇĞİÖŞÜ]{4,14})\s+(.+)$/;

function parseEdevlet(sayfalar: any[]): Omit<TranskriptSonuc, 'kaynak'> {
  const dersler: Ders[] = [];
  const ogrenci: TranskriptSonuc['ogrenci'] = {};
  let beyan: number | null = null;
  let sutun: Record<string, number> | null = null;
  let donem: { yil: string; ad: string } | null = null;

  for (const tc of sayfalar) {
    const rows = satirlar(parcalar(tc));
    for (const r of rows) {
      if (!ogrenci.ad && /^Adı\b/.test(r.text)) ogrenci.ad = r.cells[r.cells.length - 1].s.trim();
      if (!ogrenci.no && /^Öğrenci No\b/.test(r.text)) ogrenci.no = r.cells[r.cells.length - 1].s.trim();
      if (!ogrenci.program && /^Programı/.test(r.text)) {
        const sol = r.cells.filter((c) => c.x > 120 && c.x < 330);
        if (sol.length) ogrenci.program = metinBirlestir(sol);
      }
      if (beyan == null && /Genel Not Ortalaması/.test(r.text)) {
        const alti = rows[rows.indexOf(r) + 1];
        const aday = (alti ? alti.cells : []).concat(r.cells).map((c) => c.s.trim());
        for (const a of aday) {
          const v = sayi(a);
          if (v != null && v >= 0 && v <= 4) {
            beyan = v;
            break;
          }
        }
      }

      if (/Dersin Statüsü/.test(r.text) && /Açıklama/.test(r.text)) {
        sutun = {};
        for (const c of r.cells) {
          const s = c.s.trim();
          if (s === 'AKTS') sutun.akts = c.x;
          else if (s === 'Not') sutun.not = c.x;
          else if (s === 'Puan') sutun.puan = c.x;
          else if (s === 'Açıklama') sutun.aciklama = c.x;
          else if (/Dersin Statüsü/.test(s)) sutun.statu = c.x;
        }
      }
      if (sutun && sutun.uk == null) {
        for (const c of r.cells) {
          const s = c.s.trim();
          if (s === 'UK') sutun.uk = c.x;
        }
      }
      const d = r.text.match(DONEM_RE);
      if (d) donem = { yil: `${d[1]}-${d[2]}`, ad: d[3][0].toUpperCase() + d[3].slice(1).toLowerCase() };

      if (!sutun || !donem || sutun.not == null) continue;
      const ilk = r.cells[0];
      if (!ilk || ilk.x > 40) continue;
      const solSinir = (sutun.statu ?? 265) - 40;
      const solMetin = r.cells
        .filter((c) => c.x < solSinir)
        .map((c) => c.s.trim())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      const ka = solMetin.match(KOD_AD_RE);
      if (!ka) continue;
      const notu = enYakin(r.cells, sutun.not, 16);
      if (!notu) continue;
      const harf = /^[A-ZÇĞİÖŞÜ]{1,2}$/.test(notu) ? notu : null;
      const devamEdiyor = /^\*/.test(ilk.s.trim()) || notu === '-';
      if (!harf && !devamEdiyor) continue;

      dersler.push({
        kod: ka[1],
        ad: ka[2].trim(),
        yil: donem.yil,
        donem: donem.ad,
        statu: enYakin(r.cells, (sutun.statu ?? 265) + 23, 20),
        akts: sayi(enYakin(r.cells, (sutun.akts ?? 444) + 9, 16)),
        kredi: sayi(enYakin(r.cells, (sutun.uk ?? 422) + 4, 14)),
        harf,
        devamEdiyor,
        puan: sayi(enYakin(r.cells, (sutun.puan ?? 502) + 7, 18)),
        aciklama: enYakin(r.cells, (sutun.aciklama ?? 532) + 10, 30),
      });
    }
  }
  return { ogrenci, beyanEdilenAgno: beyan, dersler };
}

// --------------------------------------------------------------------- SSO

const SSO_SUTUN = {
  statu: 98, yil: 140, donem: 164, kod: 192, ad: 237,
  kredi: 297, katsayi: 412, puan: 435, basariPuani: 457, harf: 480, aciklama: 514,
};
const FILIGRAN = new Set(['Ö', 'R', 'N', 'E', 'K', 'T', 'İ', 'ÖR', 'EK', 'Tİ', 'ÖRNEKTİR']);
const SSO_KOD_RE = /^[0-9A-ZÇĞİÖŞÜ]{5,14}$/;
const SSO_BASLIK_RE = /Ders kodu|Ders adı|Başarı notu|Başarı puanı|Ortalama\s*etki|Tamamlanan|Alınan\s*kredi|Birikimli|Yarıyıl/i;

function parseSso(sayfalar: any[]): Omit<TranskriptSonuc, 'kaynak'> {
  const dersler: Ders[] = [];
  const ogrenci: TranskriptSonuc['ogrenci'] = {};
  let beyan: number | null = null;

  for (const tc of sayfalar) {
    let rows = satirlar(parcalar(tc), 1.8);
    for (const r of rows) r.cells = hucreBirlestir(filigraniEle(r.cells, FILIGRAN));

    for (let i = 0; i < rows.length - 1; i++) {
      const t = rows[i].text;
      if (/^Ad soyad\s*:?$/.test(t)) ogrenci.ad = rows[i + 1].text;
      if (/^Öğrenci no\s*:?$/.test(t)) ogrenci.no = rows[i + 1].text;
      if (/^Program\s*:?$/.test(t)) ogrenci.program = rows[i + 1].text;
      if (beyan == null && /^Genel Not Ortalaması\s*:?$/.test(t)) {
        for (let j = i + 1; j < Math.min(i + 6, rows.length); j++) {
          const v = sayi(rows[j].text);
          if (v != null && v <= 4) {
            beyan = v;
            break;
          }
        }
      }
    }

    rows = rows.filter((r) => !SSO_BASLIK_RE.test(r.text));

    const kodSatirlari: { r: Satir; kod: string }[] = [];
    for (const r of rows) {
      const kodHucre = r.cells.find(
        (c) => Math.abs(c.x - SSO_SUTUN.kod) <= 8 && SSO_KOD_RE.test(c.s.trim()) && /\d/.test(c.s)
      );
      if (kodHucre) kodSatirlari.push({ r, kod: kodHucre.s.trim() });
    }
    kodSatirlari.sort((a, b) => b.r.y - a.r.y);

    for (let i = 0; i < kodSatirlari.length; i++) {
      const { r, kod } = kodSatirlari[i];
      if (/^SCGRP/.test(kod)) continue;

      const ustKomsu = kodSatirlari[i - 1];
      const altKomsu = kodSatirlari[i + 1];
      const ust = ustKomsu ? (ustKomsu.r.y + r.y) / 2 : r.y + 22;
      const alt = altKomsu ? (altKomsu.r.y + r.y) / 2 : r.y - 22;
      const yakin = rows.filter((o) => o.y < ust && o.y > alt);

      const hepsi: Parca[] = [];
      for (const o of yakin) for (const c of o.cells) hepsi.push({ ...c, _y: o.y });

      const sutunda = (x: number, tol = 9) =>
        hepsi
          .filter((c) => Math.abs(c.x - x) <= tol && !FILIGRAN.has(c.s.trim()))
          .sort((a, b) => (b._y as number) - (a._y as number));

      const adParca = hepsi
        .filter((c) => c.x >= SSO_SUTUN.ad - 4 && c.x < SSO_SUTUN.kredi - 20 && !FILIGRAN.has(c.s.trim()))
        .sort((a, b) => (b._y as number) - (a._y as number) || a.x - b.x);
      const satirlaraGore = new Map<number, Parca[]>();
      for (const c of adParca) {
        const k = Math.round(c._y as number);
        if (!satirlaraGore.has(k)) satirlaraGore.set(k, []);
        (satirlaraGore.get(k) as Parca[]).push(c);
      }
      const ad = [...satirlaraGore.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, cs]) => metinBirlestir(cs.sort((a, b) => a.x - b.x)))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      const krediSayilar = yakin
        .flatMap((o) => o.cells.map((c) => ({ ...c, _y: o.y })))
        .filter((c) => Math.abs(c.x - SSO_SUTUN.kredi) <= 12)
        .sort((a, b) => (b._y as number) - (a._y as number))
        .flatMap((c) => c.s.match(/\d+(?:,\d+)?/g) || [])
        .map((t) => sayi(t))
        .filter((v): v is number => v != null);

      const ilkSayi = (arr: Parca[]): number | null => {
        for (const c of arr) {
          const v = sayi(c.s.trim());
          if (v != null) return v;
        }
        return null;
      };

      const katsayi = ilkSayi(sutunda(SSO_SUTUN.katsayi, 11));
      const harfHucre = sutunda(SSO_SUTUN.harf, 12).find((c) => /^[A-Z]{1,2}$/.test(c.s.trim()));
      const yilH = hepsi
        .filter((c) => Math.abs(c.x - SSO_SUTUN.yil) <= 8)
        .map((c) => c.s.trim())
        .filter((t) => /\d{4}/.test(t));
      const donemH = hepsi
        .filter((c) => Math.abs(c.x - SSO_SUTUN.donem) <= 10)
        .map((c) => c.s.trim());
      const aciklama = hepsi
        .filter((c) => Math.abs(c.x - SSO_SUTUN.aciklama) <= 14)
        .map((c) => c.s.trim());

      dersler.push({
        kod,
        ad,
        statu: hepsi.filter((c) => Math.abs(c.x - SSO_SUTUN.statu) <= 14).map((c) => c.s.trim())[0] || null,
        yil: yilH.join('').replace(/\s*-\s*/, '-') || null,
        donem: donemH.find((s) => /Güz|Bahar|Yaz|Muafiyet/i.test(s)) || null,
        kredi: krediSayilar[0] ?? null,
        akts: krediSayilar[1] ?? null,
        katsayi,
        harf: harfHucre ? harfHucre.s.trim() : katsayidanHarf(katsayi),
        puan: ilkSayi(sutunda(SSO_SUTUN.puan, 11)),
        basariPuani: ilkSayi(sutunda(SSO_SUTUN.basariPuani, 11)),
        aciklama: aciklama[0] || null,
      });
    }
  }

  const gorulen = new Set<string>();
  const tekil: Ders[] = [];
  for (const d of dersler) {
    const anahtar = [d.kod, d.yil, d.donem, d.puan].join('|');
    if (gorulen.has(anahtar)) continue;
    gorulen.add(anahtar);
    tekil.push(d);
  }
  return { ogrenci, beyanEdilenAgno: beyan, dersler: tekil };
}

// ------------------------------------------------------------------ giriş

export async function transkriptOku(file: File): Promise<TranskriptSonuc> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const sayfalar: any[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    sayfalar.push(await (await doc.getPage(i)).getTextContent());
  }
  const metinler = sayfalar.map((p) => (p.items as any[]).map((i) => i.str).join(' '));
  const kaynak = bicimTespit(metinler);
  if (!kaynak) {
    throw new Error(
      'Bu PDF bir Ege transkripti gibi görünmüyor. e-Devlet’ten aldığın "Öğrenci Belgesi / Not Döküm Belgesi" ya da Ege SSO’dan indirdiğin transkript olmalı.'
    );
  }
  const sonuc = kaynak === 'edevlet' ? parseEdevlet(sayfalar) : parseSso(sayfalar);
  if (!sonuc.dersler.length) {
    throw new Error('PDF okundu ama içinde ders satırı bulunamadı. Taranmış (fotoğraf) bir belge olabilir.');
  }
  return { kaynak, ...sonuc };
}
