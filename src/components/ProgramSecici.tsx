import { useEffect, useMemo, useState } from 'react';
import {
  DERECE_ADI,
  dizinYukle,
  fakulteler,
  programlariSuz,
  type Dizin,
  type ProgramOzet,
} from '../lib/katalog';

interface Props {
  secili: ProgramOzet | null;
  onSec: (p: ProgramOzet | null) => void;
}

export default function ProgramSecici({ secili, onSec }: Props) {
  const [dizin, setDizin] = useState<Dizin | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [derece, setDerece] = useState(1);
  const [fakulte, setFakulte] = useState('');

  useEffect(() => {
    dizinYukle()
      .then(setDizin)
      .catch((e) => setHata(e.message));
  }, []);

  // Program dışarıdan seçildiğinde (ör. transkriptten bulunduğunda) düzey ve
  // fakülte kutularını da ona göre doldur.
  useEffect(() => {
    if (!secili) return;
    setDerece(secili.derece);
    setFakulte(secili.fakulte ?? '');
  }, [secili]);

  const fakulteListesi = useMemo(
    () => (dizin ? fakulteler(dizin.programlar, derece) : []),
    [dizin, derece]
  );
  const programListesi = useMemo(
    () => (dizin ? programlariSuz(dizin.programlar, derece, fakulte || null) : []),
    [dizin, derece, fakulte]
  );

  // Liste her filtrede yeniden anahtarlandığı için seçili programı kimliğinden bul
  const seciliAnahtar =
    (secili &&
      programListesi.find(
        (p) => p.id === secili.id && p.ad === secili.ad && p.fakulte === secili.fakulte
      )?.anahtar) ||
    '';

  const kutu = 'w-full rounded-lg border px-3 py-2 text-sm';
  const kutuStil = { borderColor: 'var(--cizgi)', background: 'var(--yuzey)', color: 'var(--metin)' };

  return (
    <section className="kart mt-6 p-5">
      <h2 className="font-semibold">Programını seç</h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--soluk)' }}>
        Transkriptin yoksa ya da ders planını görmek istersen buradan seç. Notları elle girip
        ortalamanı hesaplayabilirsin.
      </p>

      {hata && (
        <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {hata} Ders kataloğu henüz oluşturulmamış olabilir.
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block" style={{ color: 'var(--soluk)' }}>
            Öğrenim düzeyi
          </span>
          <select
            className={kutu}
            style={kutuStil}
            value={derece}
            onChange={(e) => {
              setDerece(Number(e.target.value));
              setFakulte('');
              onSec(null);
            }}
          >
            {[1, 0, 2, 3].map((d) => (
              <option key={d} value={d}>
                {DERECE_ADI[d]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block" style={{ color: 'var(--soluk)' }}>
            Fakülte / Yüksekokul
          </span>
          <select
            className={kutu}
            style={kutuStil}
            value={fakulte}
            disabled={!dizin}
            onChange={(e) => {
              setFakulte(e.target.value);
              onSec(null);
            }}
          >
            <option value="">Tümü</option>
            {fakulteListesi.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block" style={{ color: 'var(--soluk)' }}>
            Program
          </span>
          <select
            className={kutu}
            style={kutuStil}
            value={seciliAnahtar}
            disabled={!dizin}
            onChange={(e) => {
              const p = programListesi.find((x) => x.anahtar === e.target.value) ?? null;
              onSec(p);
            }}
          >
            <option value="">Program seç…</option>
            {programListesi.map((p) => (
              <option key={p.anahtar} value={p.anahtar}>
                {p.ad}
              </option>
            ))}
          </select>
        </label>
      </div>

      {dizin && (
        <p className="mt-3 text-xs" style={{ color: 'var(--soluk)' }}>
          Veri kaynağı: Ege Üniversitesi Bilgi Paketi, {dizin.guncellenme} tarihinde alındı. Güncel
          müfredatı gösterir; eski müfredatla okuyorsan ders planın farklı olabilir.
        </p>
      )}
    </section>
  );
}
