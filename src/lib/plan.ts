// Mufredat + transkript + elle eklenen dersleri tek bir ders planina birlestirir.

import { HARF_KATSAYI, basariliMi, type Ders } from './grades';
import type { KatalogDersi, ProgramDetay } from './katalog';
import { anaMufredat } from './katalog';

export type Kaynak = 'mufredat' | 'transkript' | 'elle';

export interface PlanSatiri {
  anahtar: string;
  kod: string;
  ad: string;
  akts: number | null;
  yariyil: number | null;
  grup: string | null;
  tur: string | null;
  harf: string | null;
  kaynak: Kaynak;
  devamEdiyor?: boolean;
}

export interface PlanBolumu {
  baslik: string;
  altBaslik?: string;
  satirlar: PlanSatiri[];
}

export interface Istatistik {
  agno: number;
  puanToplam: number;
  aktsToplam: number;
  kazanilanAkts: number;
  /** Seçili müfredattaki derslerden kazanılan AKTS (ilerleme çubuğu için) */
  mufredatKazanilan: number;
  mufredatAkts: number;
  kalanDers: number;
  notluDers: number;
}

const puanli = (harf: string | null | undefined) =>
  harf != null && HARF_KATSAYI[harf] != null;

/** Transkriptten gelen notlari ders koduna gore haritalar (tekrarda son not gecerli). */
export function transkriptNotlari(dersler: Ders[]): Record<string, string> {
  const notlar: Record<string, string> = {};
  for (const d of dersler) {
    if (d.harf && puanli(d.harf)) notlar[d.kod] = d.harf;
  }
  return notlar;
}

/**
 * Program secilmisse mufredat iskelet, transkript notlari uzerine oturur.
 * Program secilmemisse yalnizca transkript (ve elle eklenenler) listelenir.
 */
export function planKur(opts: {
  program: ProgramDetay | null;
  mufredat?: string | null;
  transkriptDersleri: Ders[];
  notlar: Record<string, string>;
  elleEklenen: PlanSatiri[];
}): { bolumler: PlanBolumu[]; satirlar: PlanSatiri[] } {
  const { program, transkriptDersleri, notlar, elleEklenen } = opts;
  const bolumler: PlanBolumu[] = [];
  const tumSatirlar: PlanSatiri[] = [];
  const mufredattakiKodlar = new Set<string>();
  // Transkriptteki son kayıt: müfredat satırında AKTS'yi belgeden almak için
  // (katalogdaki AKTS ile öğrencinin aldığı yılın AKTS'si farklı olabilir).
  const transkripttenDers = new Map<string, Ders>();
  for (const d of transkriptDersleri) transkripttenDers.set(d.kod, d);

  if (program) {
    const ana = opts.mufredat !== undefined ? opts.mufredat : anaMufredat(program.dersler);
    const anaDersler = program.dersler.filter((d) => (d.mufredat ?? null) === ana);

    const donemliler = anaDersler.filter((d) => d.yariyil != null);
    const donemler = [...new Set(donemliler.map((d) => d.yariyil as number))].sort((a, b) => a - b);

    for (const y of donemler) {
      const satirlar = donemliler
        .filter((d) => d.yariyil === y)
        .map((d) => katalogdanSatir(d, notlar, transkripttenDers));
      satirlar.forEach((s) => mufredattakiKodlar.add(s.kod));
      bolumler.push({ baslik: `${y}. dönem`, satirlar });
      tumSatirlar.push(...satirlar);
    }

    const gruplar = [...new Set(anaDersler.filter((d) => d.grup).map((d) => d.grup as string))];
    for (const g of gruplar) {
      const satirlar = anaDersler.filter((d) => d.grup === g).map((d) => katalogdanSatir(d, notlar, transkripttenDers));
      satirlar.forEach((s) => mufredattakiKodlar.add(s.kod));
      bolumler.push({ baslik: g, altBaslik: 'Seçmeli ders havuzu', satirlar });
      tumSatirlar.push(...satirlar);
    }
  }

  // Transkriptte olup mufredatta olmayanlar (eski mufredat, yatay gecis, muafiyet...)
  const disarida = transkriptDersleri.filter((d) => !mufredattakiKodlar.has(d.kod));
  if (disarida.length) {
    const gorulen = new Set<string>();
    const satirlar: PlanSatiri[] = [];
    for (const d of disarida) {
      if (gorulen.has(d.kod)) continue;
      gorulen.add(d.kod);
      satirlar.push({
        anahtar: `t-${d.kod}`,
        kod: d.kod,
        ad: d.ad || d.kod,
        akts: d.akts,
        yariyil: null,
        grup: null,
        tur: d.statu === 'S' ? 'Seçmeli' : d.statu === 'Z' ? 'Zorunlu' : (d.statu ?? null),
        harf: notlar[d.kod] ?? d.harf ?? null,
        kaynak: 'transkript',
        devamEdiyor: d.devamEdiyor,
      });
    }
    bolumler.push({
      baslik: program ? 'Müfredat dışı dersler' : 'Transkriptteki dersler',
      altBaslik: program ? 'Transkriptinde olup seçtiğin müfredatta görünmeyenler' : undefined,
      satirlar,
    });
    tumSatirlar.push(...satirlar);
  }

  if (elleEklenen.length) {
    const satirlar = elleEklenen.map((s) => ({ ...s, harf: notlar[s.kod] ?? s.harf }));
    bolumler.push({ baslik: 'Eklediğin dersler', satirlar });
    tumSatirlar.push(...satirlar);
  }

  return { bolumler, satirlar: tumSatirlar };
}

function katalogdanSatir(
  d: KatalogDersi,
  notlar: Record<string, string>,
  transkript: Map<string, Ders>
): PlanSatiri {
  const t = transkript.get(d.kod);
  return {
    anahtar: `m-${d.kod}-${d.yariyil ?? 'g'}-${d.grup ?? ''}`,
    kod: d.kod,
    ad: d.ad,
    akts: t?.akts ?? d.akts,
    yariyil: d.yariyil,
    grup: d.grup,
    tur: d.tur,
    harf: notlar[d.kod] ?? null,
    kaynak: 'mufredat',
  };
}

/** Ayni ders birden fazla bolumde gorunebilir; ortalamaya bir kez girer. */
export function istatistik(
  satirlar: PlanSatiri[],
  program: ProgramDetay | null,
  mufredat?: string | null
): Istatistik {
  const tekil = new Map<string, PlanSatiri>();
  for (const s of satirlar) if (!tekil.has(s.kod)) tekil.set(s.kod, s);

  let puanToplam = 0;
  let aktsToplam = 0;
  let kazanilanAkts = 0;
  let notluDers = 0;

  for (const s of tekil.values()) {
    if (!s.akts || !puanli(s.harf)) continue;
    puanToplam += HARF_KATSAYI[s.harf as string] * s.akts;
    aktsToplam += s.akts;
    notluDers++;
    if (basariliMi(s.harf)) kazanilanAkts += s.akts;
  }

  let mufredatAkts = 0;
  let kalanDers = 0;
  let mufredatKazanilan = 0;
  if (program) {
    const ana = mufredat !== undefined ? mufredat : anaMufredat(program.dersler);
    const mufredatKodlari = new Set(
      program.dersler.filter((d) => (d.mufredat ?? null) === ana).map((d) => d.kod)
    );
    for (const s of tekil.values()) {
      if (s.akts && basariliMi(s.harf) && mufredatKodlari.has(s.kod)) mufredatKazanilan += s.akts;
    }
    for (const d of program.dersler) {
      if ((d.mufredat ?? null) !== ana || d.yariyil == null) continue;
      mufredatAkts += d.akts ?? 0;
      const s = tekil.get(d.kod);
      if (!s || !basariliMi(s.harf)) kalanDers++;
    }
  }

  return {
    agno: aktsToplam ? puanToplam / aktsToplam : 0,
    puanToplam,
    aktsToplam,
    kazanilanAkts,
    mufredatKazanilan,
    mufredatAkts,
    kalanDers,
    notluDers,
  };
}
