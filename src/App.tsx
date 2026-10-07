import { useEffect, useMemo, useRef, useState } from 'react';
import { HARFLER, HARF_TABLOSU, basariliMi } from './lib/grades';
import { dizinYukle, mufredatlar, programYukle, type ProgramDetay, type ProgramOzet } from './lib/katalog';
import { programBul } from './lib/eslestir';
import {
  istatistik,
  planKur,
  transkriptNotlari,
  type PlanSatiri,
} from './lib/plan';
import { transkriptOku, type TranskriptSonuc } from './lib/transcript';
import ProgramSecici from './components/ProgramSecici';

const LOGO = 'https://ege.uniforum.app/assets/uploads/system/site-logo.png';
const FORUM = 'https://ege.uniforum.app/';

/** Forumun icine iframe ile gomuldugunde ?embed=1 ile acilir. */
const GOMULU = new URLSearchParams(window.location.search).get('embed') === '1';

const bicimAdi = (k: string) => (k === 'edevlet' ? 'e-Devlet' : 'Ege SSO');
const ondalik = (n: number, basamak = 2) =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: basamak, maximumFractionDigits: basamak });

export default function App() {
  const [sonuc, setSonuc] = useState<TranskriptSonuc | null>(null);
  const [programOzet, setProgramOzet] = useState<ProgramOzet | null>(null);
  const [program, setProgram] = useState<ProgramDetay | null>(null);
  const [mufredat, setMufredat] = useState<string | null>(null);
  const [notlar, setNotlar] = useState<Record<string, string>>({});
  const [elleEklenen, setElleEklenen] = useState<PlanSatiri[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [programHatasi, setProgramHatasi] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [dersEkleAcik, setDersEkleAcik] = useState(false);
  /** Transkriptten program bulunduğunda / bulunamadığında gösterilen not */
  const [programNotu, setProgramNotu] = useState<{ bulundu: boolean; metin: string } | null>(null);
  const girdiRef = useRef<HTMLInputElement>(null);

  // Gomulu modda iframe'in yuksekligini ust sayfaya bildiriyoruz.
  useEffect(() => {
    if (!GOMULU) return;
    let sonBildirilen = 0;
    const bildir = () => {
      // Alt paylar bazen olcunun disinda kaliyor; iki olcumun buyugunu aliyoruz.
      const h = Math.ceil(
        Math.max(document.body.getBoundingClientRect().height, document.body.scrollHeight)
      );
      if (h > 0 && Math.abs(h - sonBildirilen) > 4) {
        sonBildirilen = h;
        window.parent.postMessage({ tip: 'ege-ders-analizi:yukseklik', yukseklik: h }, '*');
      }
    };
    bildir();
    const gozlemci = new ResizeObserver(bildir);
    gozlemci.observe(document.body);
    window.addEventListener('load', bildir);
    const tekrar = window.setInterval(bildir, 400);
    const dur = window.setTimeout(() => window.clearInterval(tekrar), 4000);
    return () => {
      gozlemci.disconnect();
      window.removeEventListener('load', bildir);
      window.clearInterval(tekrar);
      window.clearTimeout(dur);
    };
  }, []);

  // Secilen programin mufredati
  useEffect(() => {
    if (!programOzet) {
      setProgram(null);
      return;
    }
    let iptal = false;
    setProgramHatasi(null);
    programYukle(programOzet.id)
      .then((p) => {
        if (iptal) return;
        setProgram(p);
        // Sayfada birden fazla mufredat olabilir; en genis olani varsayilan.
        const liste = mufredatlar(p.dersler);
        setMufredat(liste.length ? liste[0].ad || null : null);
      })
      .catch((e) => !iptal && setProgramHatasi(e.message));
    return () => {
      iptal = true;
    };
  }, [programOzet]);

  const temelNotlar = useMemo(
    () => (sonuc ? transkriptNotlari(sonuc.dersler) : {}),
    [sonuc]
  );

  const { bolumler, satirlar } = useMemo(
    () =>
      planKur({
        program,
        mufredat,
        transkriptDersleri: sonuc?.dersler ?? [],
        notlar,
        elleEklenen,
      }),
    [program, mufredat, sonuc, notlar, elleEklenen]
  );

  const ist = useMemo(() => istatistik(satirlar, program, mufredat), [satirlar, program, mufredat]);

  const temelIst = useMemo(() => {
    if (!sonuc) return null;
    const { satirlar: s } = planKur({
      program,
      mufredat,
      transkriptDersleri: sonuc.dersler,
      notlar: temelNotlar,
      elleEklenen: [],
    });
    return istatistik(s, program, mufredat);
  }, [sonuc, program, mufredat, temelNotlar]);

  const degistirilmis = useMemo(() => {
    if (elleEklenen.length) return true;
    const a = Object.keys(notlar);
    const b = Object.keys(temelNotlar);
    if (a.length !== b.length) return true;
    return a.some((k) => notlar[k] !== temelNotlar[k]);
  }, [notlar, temelNotlar, elleEklenen]);

  const dogrulama = useMemo(() => {
    if (!sonuc?.beyanEdilenAgno || degistirilmis) return null;
    const fark = Math.abs(sonuc.beyanEdilenAgno - ist.agno);
    return { tutuyor: fark < 0.005, beyan: sonuc.beyanEdilenAgno };
  }, [sonuc, ist, degistirilmis]);

  async function dosyaSec(file: File | undefined) {
    if (!file) return;
    setHata(null);
    setYukleniyor(true);
    try {
      const r = await transkriptOku(file);
      // Yeni PDF: önceki seçimler ve elle girilenler silinir, her şey belgeden gelir.
      setElleEklenen([]);
      setDersEkleAcik(false);
      setNotlar(transkriptNotlari(r.dersler));
      setSonuc(r);
      setProgramOzet(null);

      // Transkriptteki program/fakülte bilgisini katalogla eşleştir
      const dizin = await dizinYukle().catch(() => null);
      const bulunan = dizin
        ? await programBul(dizin.programlar, r.ogrenci, r.dersler.map((d) => d.kod))
        : null;
      setProgramOzet(bulunan);
      if (bulunan) {
        setProgramNotu({ bulundu: true, metin: `Programın transkriptten bulundu: ${bulunan.ad}` });
      } else if (r.ogrenci.program) {
        setProgramNotu({
          bulundu: false,
          metin: `Transkriptteki programı (“${r.ogrenci.program}”) katalogda eşleştiremedik. Müfredatı görmek istersen listeden seçebilirsin.`,
        });
      } else {
        setProgramNotu(null);
      }
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'PDF okunamadı.');
      setSonuc(null);
      setNotlar({});
      setProgramNotu(null);
    } finally {
      setYukleniyor(false);
    }
  }

  const notDegistir = (kod: string, harf: string) =>
    setNotlar((o) => {
      const yeni = { ...o };
      if (harf) yeni[kod] = harf;
      else delete yeni[kod];
      return yeni;
    });

  const sifirla = () => {
    setNotlar(temelNotlar);
    setElleEklenen([]);
  };

  const planVar = bolumler.length > 0;

  return (
    <div className={GOMULU ? '' : 'min-h-screen'}>
      {!GOMULU && (
        <header className="border-b" style={{ borderColor: 'var(--cizgi)', background: 'var(--yuzey)' }}>
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
            <a href={FORUM} className="flex items-center gap-3">
              <img src={LOGO} alt="EGE Forum" className="h-9 w-9 rounded object-contain" />
              <span className="font-semibold">EGE Forum</span>
            </a>
            <span className="ml-auto text-sm" style={{ color: 'var(--soluk)' }}>
              <a href={FORUM} className="hover:underline">
                Foruma dön
              </a>
            </span>
          </div>
        </header>
      )}

      <main className={GOMULU ? 'px-0 py-0' : 'mx-auto max-w-5xl px-4 py-8'}>
        {!GOMULU && (
          <>
            <h1 className="text-2xl font-bold sm:text-3xl">Ege Üniversitesi AGNO Hesaplama</h1>
            <p className="mt-2 max-w-2xl" style={{ color: 'var(--soluk)' }}>
              Transkriptini yükle ya da programını seçip notlarını elle gir; genel not ortalaman
              (AGNO) anında hesaplansın. Dosya tarayıcından çıkmaz, hiçbir sunucuya gönderilmez.
            </p>
          </>
        )}

        <section className={`kart p-5 ${GOMULU ? '' : 'mt-6'}`}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Transkriptini yükle</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--soluk)' }}>
                e-Devlet&rsquo;ten aldığın <strong>Not Döküm Belgesi</strong> ya da Ege SSO&rsquo;dan
                indirdiğin transkript. Notların otomatik gelsin.
              </p>
            </div>
            <input
              ref={girdiRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                dosyaSec(e.target.files?.[0]);
                // Aynı dosya yeniden seçilirse de okunsun
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => girdiRef.current?.click()}
              disabled={yukleniyor}
              className="rounded-lg bg-ege-700 px-5 py-2.5 font-medium text-white transition hover:bg-ege-900 disabled:opacity-60"
            >
              {yukleniyor ? 'Okunuyor…' : 'PDF seç'}
            </button>
          </div>
          {hata && (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
              {hata}
            </p>
          )}
        </section>

        <ProgramSecici
          secili={programOzet}
          onSec={(p) => {
            setProgramOzet(p);
            setProgramNotu(null);
          }}
        />

        {programNotu && (
          <p
            className={`mt-3 rounded-lg px-4 py-3 text-sm ${
              programNotu.bulundu
                ? 'bg-deniz-100 text-deniz-600 dark:bg-deniz-600/20 dark:text-deniz-100'
                : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
            }`}
          >
            {programNotu.metin}
            {programNotu.bulundu && ' Farklıysa yukarıdan değiştirebilirsin.'}
          </p>
        )}

        {programHatasi && (
          <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            {programHatasi} Bu programın müfredatı henüz çekilmemiş olabilir; başka bir program seçip
            deneyebilirsin.
          </p>
        )}

        {program && mufredatlar(program.dersler).length > 1 && (
          <section className="kart mt-4 flex flex-wrap items-end gap-4 p-5">
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Müfredat</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--soluk)' }}>
                Bu programda birden fazla müfredat var (ağırlık seçenekleri, yan dal gibi). Hangisine
                göre hesaplayalım?
              </p>
            </div>
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--cizgi)', background: 'var(--yuzey)', color: 'var(--metin)' }}
              value={mufredat ?? ''}
              onChange={(e) => setMufredat(e.target.value || null)}
            >
              {mufredatlar(program.dersler).map((m) => (
                <option key={m.ad} value={m.ad}>
                  {m.ad || 'Adsız müfredat'} ({m.dersSayisi} ders)
                </option>
              ))}
            </select>
          </section>
        )}

        {planVar && (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="kart p-5">
                <div className="text-sm" style={{ color: 'var(--soluk)' }}>
                  {sonuc && degistirilmis ? 'Senaryo AGNO' : 'AGNO'}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-ege-700">{ondalik(ist.agno)}</span>
                  {degistirilmis && temelIst && temelIst.agno > 0 && (
                    <span
                      className={`text-sm font-semibold ${
                        ist.agno > temelIst.agno + 0.0005
                          ? 'text-deniz-600'
                          : ist.agno < temelIst.agno - 0.0005
                            ? 'text-red-600 dark:text-red-300'
                            : ''
                      }`}
                    >
                      {ist.agno > temelIst.agno ? '▲' : ist.agno < temelIst.agno ? '▼' : ''}{' '}
                      {ondalik(Math.abs(ist.agno - temelIst.agno))}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm" style={{ color: 'var(--soluk)' }}>
                  {degistirilmis && temelIst && temelIst.agno > 0
                    ? `Gerçek AGNO'n ${ondalik(temelIst.agno)}`
                    : `${ondalik(ist.puanToplam, 2)} puan / ${ondalik(ist.aktsToplam, 0)} AKTS`}
                </div>
              </div>

              <div className="kart p-5">
                <div className="text-sm" style={{ color: 'var(--soluk)' }}>
                  Kazanılan AKTS
                </div>
                <div className="mt-1 text-4xl font-bold">
                  {ondalik(ist.kazanilanAkts, 0)}
                  {ist.mufredatAkts > 0 && (
                    <span className="text-xl font-normal" style={{ color: 'var(--soluk)' }}>
                      {' '}
                      / {ondalik(ist.mufredatAkts, 0)}
                    </span>
                  )}
                </div>
                {ist.mufredatAkts > 0 && (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--zemin)' }}>
                    <div
                      className="h-full rounded-full bg-deniz-600"
                      style={{
                        width: `${Math.min(100, (ist.kazanilanAkts / ist.mufredatAkts) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="kart p-5">
                <div className="text-sm" style={{ color: 'var(--soluk)' }}>
                  {program ? 'Kalan zorunlu ders' : 'Ortalamaya giren ders'}
                </div>
                <div className="mt-1 text-4xl font-bold">
                  {program ? ist.kalanDers : ist.notluDers}
                </div>
                <div className="mt-1 text-sm" style={{ color: 'var(--soluk)' }}>
                  {program ? `${ist.notluDers} dersin notu girili` : `${satirlar.length} kayıt okundu`}
                </div>
              </div>

              <div className="kart p-5">
                <div className="text-sm" style={{ color: 'var(--soluk)' }}>
                  {sonuc ? 'Belge kaynağı' : 'Program'}
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {sonuc ? bicimAdi(sonuc.kaynak) : programOzet ? programOzet.bolum : '—'}
                </div>
                {dogrulama && (
                  <div
                    className={`mt-2 inline-block rounded px-2 py-1 text-xs font-medium ${
                      dogrulama.tutuyor
                        ? 'bg-deniz-100 text-deniz-600'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
                    }`}
                  >
                    {dogrulama.tutuyor
                      ? `Belgedeki ${ondalik(dogrulama.beyan)} ile uyuşuyor`
                      : `Belgede ${ondalik(dogrulama.beyan)} yazıyor`}
                  </div>
                )}
              </div>
            </section>

            {dogrulama && !dogrulama.tutuyor && (
              <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                Hesapladığımız ortalama belgenin kendi yazdığı değerden farklı. Transkriptinde
                okuyamadığımız bir durum olabilir (muafiyet, yerine sayılan ders, yatay geçiş).
                Sonucu resmî kabul etme.
              </p>
            )}

            <section className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Ders planı</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDersEkleAcik((a) => !a)}
                    className="rounded-lg border px-3 py-1.5 text-sm"
                    style={{ borderColor: 'var(--cizgi)' }}
                  >
                    Ders ekle
                  </button>
                  {degistirilmis && (
                    <button
                      type="button"
                      onClick={sifirla}
                      className="rounded-lg border px-3 py-1.5 text-sm"
                      style={{ borderColor: 'var(--cizgi)' }}
                    >
                      {sonuc ? 'Gerçek notlara dön' : 'Temizle'}
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-sm" style={{ color: 'var(--soluk)' }}>
                Bir dersin harf notunu değiştir, AGNO anında yeniden hesaplansın.
              </p>

              {dersEkleAcik && (
                <DersEkle
                  onEkle={(s) => {
                    setElleEklenen((o) => [...o, s]);
                    if (s.harf) notDegistir(s.kod, s.harf);
                    setDersEkleAcik(false);
                  }}
                  onVazgec={() => setDersEkleAcik(false)}
                />
              )}

              {bolumler.map((b) => (
                <Bolum
                  key={b.baslik}
                  baslik={b.baslik}
                  altBaslik={b.altBaslik}
                  satirlar={b.satirlar}
                  onNot={notDegistir}
                  onSil={(anahtar) =>
                    setElleEklenen((o) => o.filter((s) => s.anahtar !== anahtar))
                  }
                />
              ))}
            </section>
          </>
        )}

        {!GOMULU && (
          <>
            <section className="kart mt-10 p-5">
              <h2 className="text-xl font-semibold">Ege Üniversitesi&rsquo;nde AGNO nasıl hesaplanır?</h2>
              <p className="mt-2" style={{ color: 'var(--soluk)' }}>
                Ege&rsquo;de genel not ortalamasının resmî adı <strong>AGNO</strong> (Ağırlıklı Genel
                Not Ortalaması); transkriptte <strong>GNO</strong> olarak da geçer. Bazı
                üniversitelerin kullandığı &ldquo;GANO&rdquo; terimi Ege&rsquo;de kullanılmaz.
              </p>
              <p className="mt-3">
                Her dersin harf notu katsayısı o dersin <strong>AKTS kredisiyle</strong> çarpılır,
                çıkan değerler toplanır ve alınan tüm derslerin AKTS toplamına bölünür. Yerel kredi
                değil, AKTS kullanılır. Ders tekrarında en son alınan harf notu geçerlidir.
              </p>

              <h3 className="mt-6 font-semibold">Harf notu karşılıkları</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full max-w-md text-sm">
                  <thead>
                    <tr style={{ color: 'var(--soluk)' }}>
                      <th className="py-2 text-left font-medium">Puan</th>
                      <th className="py-2 text-left font-medium">Harf</th>
                      <th className="py-2 text-right font-medium">Katsayı</th>
                      <th className="py-2 text-right font-medium">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HARF_TABLOSU.map((h) => (
                      <tr key={h.harf} className="border-t" style={{ borderColor: 'var(--cizgi)' }}>
                        <td className="py-2">{h.harf === 'FF' ? '—' : `${h.altPuan}–${h.ustPuan}`}</td>
                        <td className="py-2 font-medium">{h.harf}</td>
                        <td className="py-2 text-right">{ondalik(h.katsayi)}</td>
                        <td className="py-2 text-right">
                          {h.basarili ? (
                            <span className="text-deniz-600">Başarılı</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-300">
                              {h.harf === 'FF' ? 'Devamsız' : 'Başarısız'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm" style={{ color: 'var(--soluk)' }}>
                Ege&rsquo;de geçer not CC ve üstüdür. DC ve DD yönergede başarısız kabul edilir ve
                ders tekrarı gerekir. Mezuniyet için AGNO&rsquo;nun en az 2,00 olması gerekir.
              </p>
            </section>
          </>
        )}

        <p className={`text-center text-sm ${GOMULU ? 'mt-6' : 'mt-8'}`} style={{ color: 'var(--soluk)' }}>
          Yüklediğin PDF tarayıcında işlenir, hiçbir sunucuya yüklenmez. Sonuçlar bilgilendirme
          amaçlıdır; resmî ortalaman için öğrenci işlerine danış.
        </p>
      </main>
    </div>
  );
}

function Bolum({
  baslik,
  altBaslik,
  satirlar,
  onNot,
  onSil,
}: {
  baslik: string;
  altBaslik?: string;
  satirlar: PlanSatiri[];
  onNot: (kod: string, harf: string) => void;
  onSil: (anahtar: string) => void;
}) {
  const akts = satirlar.reduce((a, s) => a + (s.akts ?? 0), 0);
  const notlu = satirlar.filter((s) => s.harf).length;

  return (
    <div className="kart mt-4 overflow-hidden">
      <div
        className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3"
        style={{ background: 'var(--zemin)' }}
      >
        <div>
          <h3 className="font-semibold">{baslik}</h3>
          {altBaslik && (
            <p className="text-xs" style={{ color: 'var(--soluk)' }}>
              {altBaslik}
            </p>
          )}
        </div>
        <span className="text-sm" style={{ color: 'var(--soluk)' }}>
          {satirlar.length} ders · {akts} AKTS · {notlu} notlu
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: 'var(--soluk)' }}>
              <th className="px-5 py-2 text-left font-medium">Ders</th>
              <th className="px-3 py-2 text-left font-medium">Tür</th>
              <th className="px-3 py-2 text-right font-medium">AKTS</th>
              <th className="px-3 py-2 text-left font-medium">Not</th>
              <th className="px-5 py-2 text-right font-medium">Puan</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s) => (
              <tr key={s.anahtar} className="border-t" style={{ borderColor: 'var(--cizgi)' }}>
                <td className="px-5 py-2">
                  <div className="font-medium">{s.ad || s.kod}</div>
                  <div className="text-xs" style={{ color: 'var(--soluk)' }}>
                    {s.kod}
                  </div>
                </td>
                <td className="px-3 py-2">{s.tur ?? '—'}</td>
                <td className="px-3 py-2 text-right">{s.akts ?? '—'}</td>
                <td className="px-3 py-2">
                  {s.devamEdiyor ? (
                    <span style={{ color: 'var(--soluk)' }}>devam ediyor</span>
                  ) : (
                    <select
                      value={s.harf ?? ''}
                      onChange={(e) => onNot(s.kod, e.target.value)}
                      className={`rounded border px-2 py-1 ${
                        s.harf && !basariliMi(s.harf) ? 'text-red-600 dark:text-red-300' : ''
                      }`}
                      style={{ borderColor: 'var(--cizgi)', background: 'var(--yuzey)', color: 'inherit' }}
                    >
                      <option value="">almadım</option>
                      {HARFLER.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-5 py-2 text-right">
                  {s.harf && s.akts != null
                    ? ondalik((HARF_TABLOSU.find((h) => h.harf === s.harf)?.katsayi ?? 0) * s.akts)
                    : '—'}
                  {s.kaynak === 'elle' && (
                    <button
                      type="button"
                      onClick={() => onSil(s.anahtar)}
                      className="ml-3 text-xs text-red-600 hover:underline dark:text-red-300"
                    >
                      sil
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DersEkle({
  onEkle,
  onVazgec,
}: {
  onEkle: (s: PlanSatiri) => void;
  onVazgec: () => void;
}) {
  const [kod, setKod] = useState('');
  const [ad, setAd] = useState('');
  const [akts, setAkts] = useState('5');
  const [harf, setHarf] = useState('');

  const kutu = 'rounded-lg border px-3 py-2 text-sm';
  const kutuStil = { borderColor: 'var(--cizgi)', background: 'var(--yuzey)', color: 'var(--metin)' };

  return (
    <div className="kart mt-4 flex flex-wrap items-end gap-3 p-4">
      <label className="text-sm">
        <span className="mb-1 block" style={{ color: 'var(--soluk)' }}>
          Ders kodu
        </span>
        <input className={`${kutu} w-32`} style={kutuStil} value={kod} onChange={(e) => setKod(e.target.value)} />
      </label>
      <label className="min-w-40 flex-1 text-sm">
        <span className="mb-1 block" style={{ color: 'var(--soluk)' }}>
          Ders adı
        </span>
        <input className={`${kutu} w-full`} style={kutuStil} value={ad} onChange={(e) => setAd(e.target.value)} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block" style={{ color: 'var(--soluk)' }}>
          AKTS
        </span>
        <input
          className={`${kutu} w-20`}
          style={kutuStil}
          inputMode="numeric"
          value={akts}
          onChange={(e) => setAkts(e.target.value)}
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block" style={{ color: 'var(--soluk)' }}>
          Not
        </span>
        <select className={`${kutu} w-24`} style={kutuStil} value={harf} onChange={(e) => setHarf(e.target.value)}>
          <option value="">almadım</option>
          {HARFLER.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!kod.trim()}
        onClick={() =>
          onEkle({
            anahtar: `e-${kod.trim()}-${Date.now()}`,
            kod: kod.trim(),
            ad: ad.trim() || kod.trim(),
            akts: parseFloat(akts.replace(',', '.')) || null,
            yariyil: null,
            grup: null,
            tur: 'Eklenen',
            harf: harf || null,
            kaynak: 'elle',
          })
        }
        className="rounded-lg bg-ege-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Ekle
      </button>
      <button
        type="button"
        onClick={onVazgec}
        className="rounded-lg border px-4 py-2 text-sm"
        style={{ borderColor: 'var(--cizgi)' }}
      >
        Vazgeç
      </button>
    </div>
  );
}
