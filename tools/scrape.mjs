#!/usr/bin/env node
/**
 * Ege Üniversitesi ders kataloğunu çeker.
 *
 *   npm run scrape              → tüm dereceler (önlisans, lisans, yüksek lisans, doktora)
 *   npm run scrape -- --derece=1  → sadece lisans
 *   npm run scrape -- --limit=5   → ilk 5 program (deneme için)
 *
 * Çıktı:
 *   public/data/programlar.json          program dizini
 *   public/data/program/<id>.json        her programın müfredatı
 *
 * Veri kaynağı ebp.ege.edu.tr (Bologna bilgi paketi). Siteyi yormamak için
 * eşzamanlı istek sayısı sınırlı ve aralarında bekleme var.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { agactanProgramlar } from './lib/agac.mjs';
import { parseProgram } from './lib/parseProgram.mjs';

const KOK = 'https://ebp.ege.edu.tr';
const CIKTI = path.resolve('public/data');
const DERECE_ADI = { 0: 'Önlisans', 1: 'Lisans', 2: 'Yüksek Lisans', 3: 'Doktora' };

const arg = (ad, varsayilan) => {
  const bulunan = process.argv.find((a) => a.startsWith(`--${ad}=`));
  return bulunan ? bulunan.split('=')[1] : varsayilan;
};

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

async function getir(url, deneme = 0) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'ege-ders-analizi/0.1 (+https://ege.uniforum.app)' },
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } catch (e) {
    if (deneme < 2) {
      await bekle(1500 * (deneme + 1));
      return getir(url, deneme + 1);
    }
    throw e;
  }
}

/** Sinirli eszamanlilikla islet, hatalar digerlerini durdurmasin. */
async function havuzda(ogeler, esZamanli, isle) {
  const sonuc = new Array(ogeler.length);
  let sira = 0;
  const isci = async () => {
    while (sira < ogeler.length) {
      const i = sira++;
      try {
        sonuc[i] = { ok: true, deger: await isle(ogeler[i], i) };
      } catch (e) {
        sonuc[i] = { ok: false, hata: String(e.message || e) };
      }
      await bekle(250);
    }
  };
  await Promise.all(Array.from({ length: esZamanli }, isci));
  return sonuc;
}

async function main() {
  const dereceler = arg('derece') ? [Number(arg('derece'))] : [0, 1, 2, 3];
  const limit = arg('limit') ? Number(arg('limit')) : Infinity;

  await fs.mkdir(path.join(CIKTI, 'program'), { recursive: true });

  let programlar = [];
  for (const d of dereceler) {
    process.stdout.write(`[katalog] ${DERECE_ADI[d]} programları listeleniyor… `);
    const ham = await getir(`${KOK}/DereceProgramlari/GetJson/${d}?lang=tr-TR`);
    const liste = agactanProgramlar(JSON.parse(ham), d);
    console.log(`${liste.length} program`);
    programlar.push(...liste);
  }

  if (limit !== Infinity) programlar = programlar.slice(0, limit);

  console.log(`[katalog] ${programlar.length} programın müfredatı çekiliyor…`);
  let bitti = 0;
  const sonuclar = await havuzda(programlar, 3, async (p) => {
    const html = await getir(KOK + p.yol);
    const dersler = parseProgram(html);
    await fs.writeFile(
      path.join(CIKTI, 'program', `${p.id}.json`),
      JSON.stringify({ ...p, dersler }, null, 1),
      'utf8'
    );
    bitti++;
    if (bitti % 10 === 0 || bitti === programlar.length) {
      process.stdout.write(`\r  ${bitti}/${programlar.length}`);
    }
    return dersler.length;
  });
  console.log('');

  const basarili = [];
  const hatalar = [];
  sonuclar.forEach((s, i) => {
    const p = programlar[i];
    if (s.ok) basarili.push({ ...p, dersSayisi: s.deger });
    else hatalar.push({ ad: p.ad, yol: p.yol, hata: s.hata });
  });

  await fs.writeFile(
    path.join(CIKTI, 'programlar.json'),
    JSON.stringify(
      {
        guncellenme: new Date().toISOString().slice(0, 10),
        kaynak: KOK,
        programlar: basarili.map(({ yol, ...k }) => k),
      },
      null,
      1
    ),
    'utf8'
  );

  const dersliOlmayan = basarili.filter((p) => !p.dersSayisi).length;
  console.log(`[katalog] bitti: ${basarili.length} program yazıldı, ${hatalar.length} hata`);
  if (dersliOlmayan) console.log(`[katalog] uyarı: ${dersliOlmayan} programda ders bulunamadı`);
  for (const h of hatalar.slice(0, 10)) console.log(`  hata: ${h.ad} — ${h.hata}`);
}

main().catch((e) => {
  console.error('[katalog] çöktü:', e);
  process.exit(1);
});
