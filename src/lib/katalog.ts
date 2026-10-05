// Ders katalogu verisine erisim.
// Veri `npm run scrape` ile uretilip public/data altina yazilir; tarayici
// yalnizca ihtiyac duydugu programin dosyasini indirir.

export interface ProgramOzet {
  /** Ayni sayfayi paylasan programlar ayni id'yi tasiyabiliyor (Biyoloji'nin
   *  agirlik secenekleri gibi); listelerde bu benzersiz anahtar kullanilir. */
  anahtar?: string;
  id: string;
  bolumId: string | null;
  yil: string | null;
  derece: number;
  fakulte: string | null;
  bolum: string | null;
  tur: string | null;
  ad: string;
  dersSayisi: number;
}

export interface KatalogDersi {
  kod: string;
  ad: string;
  mufredat: string | null;
  yariyil: number | null;
  grup: string | null;
  tur: string | null;
  dil: string | null;
  teori: number | null;
  uygulama: number | null;
  laboratuvar: number | null;
  akts: number | null;
}

export interface ProgramDetay extends ProgramOzet {
  dersler: KatalogDersi[];
}

export interface Dizin {
  guncellenme: string;
  kaynak: string;
  programlar: ProgramOzet[];
}

export const DERECE_ADI: Record<number, string> = {
  0: 'Önlisans',
  1: 'Lisans',
  2: 'Yüksek Lisans',
  3: 'Doktora',
};

const kok = import.meta.env.BASE_URL + 'data/';

let dizinSozu: Promise<Dizin> | null = null;

/** Program dizini bir kez indirilir, sonra bellekte tutulur. */
export function dizinYukle(): Promise<Dizin> {
  if (!dizinSozu) {
    dizinSozu = fetch(kok + 'programlar.json')
      .then((r) => {
        if (!r.ok) throw new Error('Ders kataloğu yüklenemedi.');
        return r.json();
      })
      .catch((e) => {
        dizinSozu = null;
        throw e;
      });
  }
  return dizinSozu;
}

const programBellegi = new Map<string, ProgramDetay>();

export async function programYukle(id: string): Promise<ProgramDetay> {
  const varOlan = programBellegi.get(id);
  if (varOlan) return varOlan;
  const r = await fetch(`${kok}program/${id}.json`);
  if (!r.ok) throw new Error('Program müfredatı yüklenemedi.');
  const veri = (await r.json()) as ProgramDetay;
  programBellegi.set(id, veri);
  return veri;
}

/** Programin ana mufredati: en cok ders tasiyan mufredat adi (yandal/cap disarida kalsin). */
export function anaMufredat(dersler: KatalogDersi[]): string | null {
  const sayim = new Map<string, number>();
  for (const d of dersler) {
    const k = d.mufredat ?? '';
    sayim.set(k, (sayim.get(k) ?? 0) + 1);
  }
  let enIyi: string | null = null;
  let enCok = -1;
  for (const [k, v] of sayim) {
    if (v > enCok) {
      enCok = v;
      enIyi = k || null;
    }
  }
  return enIyi;
}

export function fakulteler(programlar: ProgramOzet[], derece: number): string[] {
  const küme = new Set<string>();
  for (const p of programlar) {
    if (p.derece === derece && p.fakulte) küme.add(p.fakulte);
  }
  return [...küme].sort((a, b) => a.localeCompare(b, 'tr'));
}

export function programlariSuz(
  programlar: ProgramOzet[],
  derece: number,
  fakulte: string | null
): ProgramOzet[] {
  return programlar
    .filter((p) => p.derece === derece && (!fakulte || p.fakulte === fakulte))
    .map((p, i) => ({ ...p, anahtar: `${p.id}-${i}` }))
    .sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
}

/** Bir program sayfasinda birden fazla mufredat olabilir (agirlik secenekleri, yandal...). */
export function mufredatlar(dersler: KatalogDersi[]): { ad: string; dersSayisi: number }[] {
  const sayim = new Map<string, number>();
  for (const d of dersler) sayim.set(d.mufredat ?? '', (sayim.get(d.mufredat ?? '') ?? 0) + 1);
  return [...sayim.entries()]
    .map(([ad, dersSayisi]) => ({ ad, dersSayisi }))
    .sort((a, b) => b.dersSayisi - a.dersSayisi);
}
