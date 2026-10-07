// Transkriptteki program/fakülte yazısını katalogdaki programla eşleştirir.
// Önce metin benzerliğine bakar; birden fazla aday kalırsa transkriptteki ders
// kodlarının hangi programın müfredatında daha çok geçtiğine göre seçer.

import { programYukle, type ProgramOzet } from './katalog';

export interface ProgramIpucu {
  program?: string;
  fakulte?: string;
}

function sade(s: string | null | undefined): string {
  return String(s ?? '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Program adında anlam taşımayan ekler
const DOLGU = new Set(['programi', 'program', 'pr', 'bolumu', 'bolum', 'anabilim', 'dali', 'abd',
  'lisans', 'onlisans', 'on', 'yuksek', 'doktora', 'tezli', 'tezsiz', 'ingilizce', 'io', 'ikinci', 'ogretim',
  'fakulte', 'fakultesi']);

function kelimeler(s: string): string[] {
  return sade(s).split(' ').filter((k) => k && !DOLGU.has(k));
}

function dereceTahmini(metin: string): number | null {
  const t = sade(metin);
  if (/\bdoktora\b/.test(t)) return 3;
  if (/\byuksek lisans\b/.test(t) || /\benstitu/.test(t)) return 2;
  if (/\bon ?lisans\b/.test(t) || /meslek yuksekokulu/.test(t)) return 0;
  return null;
}

function puanla(p: ProgramOzet, ipucu: ProgramIpucu): number {
  const progMetni = ipucu.program ?? '';
  const tumMetin = `${progMetni} ${ipucu.fakulte ?? ''}`;
  const T = new Set(kelimeler(progMetni));
  const B = kelimeler(p.bolum ?? '');
  if (!B.length || !T.size) return 0;

  const ortak = B.filter((k) => T.has(k)).length;
  // Bölüm adının ne kadarı transkriptte geçiyor ("Diş Hekimliği" / "Dişhekimliği" gibi
  // bitişik yazımlar için boşluksuz karşılaştırma da yapılır)
  const bitisik = (a: string[]) => a.join('');
  const kapsam = bitisik([...T]).includes(bitisik(B)) ? 1 : ortak / B.length;
  const fazla = bitisik([...T]) === bitisik(B) ? 0 : [...T].filter((k) => !B.includes(k)).length; // transkriptte olup bölüm adında olmayan
  if (kapsam < 0.6) return 0;

  let puan = kapsam * 10 - fazla * 1.5 + B.length * 0.2;

  // Fakülte uyumu
  if (ipucu.fakulte && p.fakulte) {
    const F = new Set(kelimeler(ipucu.fakulte));
    const pf = kelimeler(p.fakulte);
    const fo = pf.filter((k) => F.has(k)).length / (pf.length || 1);
    puan += fo * 4;
  }

  // Öğrenim düzeyi
  const d = dereceTahmini(tumMetin);
  puan += p.derece === (d ?? 1) ? 2 : -2;

  // Öğretim dili
  const ingMetin = /ingilizce/.test(sade(tumMetin));
  const ingProg = /ingilizce/.test(sade(`${p.tur ?? ''} ${p.bolum ?? ''}`));
  puan += ingMetin === ingProg ? 1.5 : -1.5;

  // İkinci öğretim
  const ioMetin = /ikinci ogretim|\bi o\b/.test(sade(tumMetin));
  const ioProg = /\bi o\b/.test(sade(p.fakulte));
  puan += ioMetin === ioProg ? 0.5 : -0.5;

  return puan;
}

/**
 * En uygun programı döndürür; emin olunamazsa null.
 * dersKodlari: transkriptteki ders kodları (adaylar arasında karar vermek için).
 */
export async function programBul(
  programlar: ProgramOzet[],
  ipucu: ProgramIpucu,
  dersKodlari: string[]
): Promise<ProgramOzet | null> {
  if (!ipucu.program) return null;
  const adaylar = programlar
    .map((p) => ({ p, puan: puanla(p, ipucu) }))
    .filter((a) => a.puan > 0)
    .sort((a, b) => b.puan - a.puan);
  if (!adaylar.length) return null;

  // Açık ara önde olan varsa onu al
  const yakinlar = adaylar.filter((a) => adaylar[0].puan - a.puan < 1.5).slice(0, 6);
  if (yakinlar.length === 1 || !dersKodlari.length) return yakinlar[0].p;

  // Başa baş adaylar: transkriptteki ders kodlarının müfredatla örtüşmesine bak
  const kodlar = new Set(dersKodlari);
  let enIyi = yakinlar[0];
  let enCok = -1;
  for (const a of yakinlar) {
    try {
      const detay = await programYukle(a.p.id);
      const ortak = new Set(detay.dersler.filter((d) => kodlar.has(d.kod)).map((d) => d.kod)).size;
      if (ortak > enCok) {
        enCok = ortak;
        enIyi = a;
      }
    } catch {
      /* müfredatı olmayan aday: atla */
    }
  }
  return enIyi.p;
}
