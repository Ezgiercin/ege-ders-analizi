// Ege Üniversitesi not sistemi.
// Kaynak: Ölçme ve Değerlendirme Esasları Yönergesi (son değişiklik 07.03.2024, Senato 4/4).
// AGNO = toplam(harf katsayısı x AKTS) / toplam(AKTS). Ağırlık AKTS'dir, yerel kredi değildir.

export type Harf = 'AA' | 'BA' | 'BB' | 'CB' | 'CC' | 'DC' | 'DD' | 'FD' | 'FF';

export interface HarfBilgi {
  harf: Harf;
  katsayi: number;
  altPuan: number;
  ustPuan: number;
  basarili: boolean;
}

export const HARF_TABLOSU: HarfBilgi[] = [
  { harf: 'AA', katsayi: 4.0, altPuan: 88, ustPuan: 100, basarili: true },
  { harf: 'BA', katsayi: 3.5, altPuan: 81, ustPuan: 87, basarili: true },
  { harf: 'BB', katsayi: 3.0, altPuan: 74, ustPuan: 80, basarili: true },
  { harf: 'CB', katsayi: 2.5, altPuan: 67, ustPuan: 73, basarili: true },
  { harf: 'CC', katsayi: 2.0, altPuan: 60, ustPuan: 66, basarili: true },
  { harf: 'DC', katsayi: 1.5, altPuan: 53, ustPuan: 59, basarili: false },
  { harf: 'DD', katsayi: 1.0, altPuan: 46, ustPuan: 52, basarili: false },
  { harf: 'FD', katsayi: 0.5, altPuan: 0, ustPuan: 45, basarili: false },
  { harf: 'FF', katsayi: 0.0, altPuan: 0, ustPuan: 45, basarili: false },
];

export const HARF_KATSAYI: Record<string, number> = Object.fromEntries(
  HARF_TABLOSU.map((h) => [h.harf, h.katsayi])
);

export const HARFLER: Harf[] = HARF_TABLOSU.map((h) => h.harf);

/** Ege'de geçer not CC ve üstüdür; DC ve DD başarısız sayılır, ders tekrarı gerekir. */
export function basariliMi(harf: string | null | undefined): boolean {
  return HARF_TABLOSU.some((h) => h.harf === harf && h.basarili);
}

export function katsayidanHarf(k: number | null | undefined): Harf | null {
  if (k == null || Number.isNaN(k)) return null;
  const bulunan = HARF_TABLOSU.find((h) => Math.abs(h.katsayi - k) < 1e-6);
  return bulunan ? bulunan.harf : null;
}

export interface Ders {
  kod: string;
  ad: string;
  yil: string | null;
  donem: string | null;
  statu?: string | null;
  kredi: number | null;
  akts: number | null;
  harf: string | null;
  katsayi?: number | null;
  puan?: number | null;
  basariPuani?: number | null;
  aciklama?: string | null;
  devamEdiyor?: boolean;
  /** Kullanıcının senaryo ekranında elle eklediği ders */
  elle?: boolean;
}

export interface Ortalama {
  agno: number;
  puanToplam: number;
  aktsToplam: number;
  dersSayisi: number;
}

function etkiliKatsayi(d: Ders): number | null {
  if (d.harf && HARF_KATSAYI[d.harf] != null) return HARF_KATSAYI[d.harf];
  if (d.katsayi != null) return d.katsayi;
  return null;
}

/** Ortalamaya giren dersler: AKTS'si ve geçerli bir notu olanlar. */
export function ortalamayaGirer(d: Ders): boolean {
  if (d.akts == null || d.akts <= 0) return false;
  if (d.devamEdiyor) return false;
  // A.D. (alınmayan ders), S.D.G. (seçmeli ders grubu başlığı), O.K.D. (ortalamaya katılmayan)
  if (d.aciklama && /^(A\.D\.|S\.D\.G\.|O\.K\.D\.|V\.D\.|K\.D\.)/i.test(d.aciklama.trim())) return false;
  return etkiliKatsayi(d) != null;
}

/**
 * Ders tekrarında yönerge gereği son harf notu geçerli (Mad. 23).
 * Transkriptteki sıra kronolojik olduğu için aynı kodun son kaydını tutuyoruz.
 */
export function tekrarlariEle(dersler: Ders[]): Ders[] {
  const sonKayit = new Map<string, Ders>();
  for (const d of dersler) sonKayit.set(d.kod, d);
  return dersler.filter((d) => sonKayit.get(d.kod) === d);
}

export function agnoHesapla(dersler: Ders[]): Ortalama {
  const liste = tekrarlariEle(dersler).filter(ortalamayaGirer);
  let puanToplam = 0;
  let aktsToplam = 0;
  for (const d of liste) {
    puanToplam += (etkiliKatsayi(d) as number) * (d.akts as number);
    aktsToplam += d.akts as number;
  }
  return {
    agno: aktsToplam ? puanToplam / aktsToplam : 0,
    puanToplam,
    aktsToplam,
    dersSayisi: liste.length,
  };
}

/** Yıl bazında dönem ortalaması (DNO). */
export function yillaraGore(dersler: Ders[]): { yil: string; dersler: Ders[]; ortalama: Ortalama }[] {
  const gruplar = new Map<string, Ders[]>();
  for (const d of dersler) {
    const k = d.yil || 'Belirsiz';
    if (!gruplar.has(k)) gruplar.set(k, []);
    (gruplar.get(k) as Ders[]).push(d);
  }
  return [...gruplar.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'tr'))
    .map(([yil, ds]) => ({ yil, dersler: ds, ortalama: agnoHesapla(ds) }));
}

/** Hedef AGNO için kalan derslerden gereken ortalama katsayı. */
export function hedefIcinGereken(
  mevcut: Ortalama,
  kalanAkts: number,
  hedefAgno: number
): number | null {
  if (kalanAkts <= 0) return null;
  const gereken = (hedefAgno * (mevcut.aktsToplam + kalanAkts) - mevcut.puanToplam) / kalanAkts;
  return gereken;
}
