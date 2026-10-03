import { useEffect, useMemo, useRef, useState } from 'react';
import {
  HARFLER,
  HARF_TABLOSU,
  agnoHesapla,
  basariliMi,
  ortalamayaGirer,
  yillaraGore,
  type Ders,
} from './lib/grades';
import { transkriptOku, type TranskriptSonuc } from './lib/transcript';

const LOGO = 'https://ege.uniforum.app/assets/uploads/system/site-logo.png';
const FORUM = 'https://ege.uniforum.app/';

const bicimAdi = (k: string) => (k === 'edevlet' ? 'e-Devlet' : 'Ege SSO');
const ondalik = (n: number, basamak = 2) =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: basamak, maximumFractionDigits: basamak });

/** Forumun icine iframe ile gomuldugunde ?embed=1 ile acilir: kendi basligi ve
 *  acilama bolumleri gizlenir, bunlar forum sayfasinin HTML'inde duruyor. */
const GOMULU = new URLSearchParams(window.location.search).get('embed') === '1';

export default function App() {
  const [sonuc, setSonuc] = useState<TranskriptSonuc | null>(null);
  const [dersler, setDersler] = useState<Ders[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const girdiRef = useRef<HTMLInputElement>(null);

  // Gomulu modda iframe'in yuksekligini ust sayfaya bildiriyoruz ki ic kaydirma olmasin.
  useEffect(() => {
    if (!GOMULU) return;
    // Yuksekligi body'nin gercek icerik yuksekliginden olcuyoruz. documentElement
    // kullanilirsa cerceve buyudukce olcum de buyur ve dongu olusur.
    let sonBildirilen = 0;
    const bildir = () => {
      const h = Math.ceil(document.body.getBoundingClientRect().height);
      if (h > 0 && Math.abs(h - sonBildirilen) > 4) {
        sonBildirilen = h;
        window.parent.postMessage({ tip: 'ege-ders-analizi:yukseklik', yukseklik: h }, '*');
      }
    };
    bildir();
    const gozlemci = new ResizeObserver(bildir);
    gozlemci.observe(document.body);
    window.addEventListener('load', bildir);
    // Ust sayfanin dinleyicisi gec baglanmis olabilir; ilk saniyelerde tekrar bildir.
    const tekrar = window.setInterval(bildir, 400);
    const dur = window.setTimeout(() => window.clearInterval(tekrar), 4000);
    return () => {
      gozlemci.disconnect();
      window.removeEventListener('load', bildir);
      window.clearInterval(tekrar);
      window.clearTimeout(dur);
    };
  }, []);

  const ortalama = useMemo(() => agnoHesapla(dersler), [dersler]);
  const yillar = useMemo(() => yillaraGore(dersler), [dersler]);
  const degistirilmis = useMemo(
    () => (sonuc ? dersler.some((d, i) => d.elle || d.harf !== sonuc.dersler[i]?.harf) : false),
    [dersler, sonuc]
  );

  const dogrulama = useMemo(() => {
    if (!sonuc?.beyanEdilenAgno || degistirilmis) return null;
    const fark = Math.abs(sonuc.beyanEdilenAgno - ortalama.agno);
    return { tutuyor: fark < 0.005, beyan: sonuc.beyanEdilenAgno, fark };
  }, [sonuc, ortalama, degistirilmis]);

  async function dosyaSec(file: File | undefined) {
    if (!file) return;
    setHata(null);
    setYukleniyor(true);
    try {
      const r = await transkriptOku(file);
      setSonuc(r);
      setDersler(r.dersler.map((d) => ({ ...d })));
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'PDF okunamadı.');
      setSonuc(null);
      setDersler([]);
    } finally {
      setYukleniyor(false);
    }
  }

  function notDegistir(kod: string, yil: string | null, donem: string | null, harf: string) {
    setDersler((onceki) =>
      onceki.map((d) =>
        d.kod === kod && d.yil === yil && d.donem === donem ? { ...d, harf, katsayi: null } : d
      )
    );
  }

  function sifirla() {
    if (sonuc) setDersler(sonuc.dersler.map((d) => ({ ...d })));
  }

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
              Transkriptini yükle; genel not ortalaman (AGNO), yıl ortalamaların ve her dersin katkısı
              otomatik hesaplansın. Notları değiştirip senaryo deneyebilirsin. Dosya tarayıcından
              çıkmaz, hiçbir sunucuya gönderilmez.
            </p>
          </>
        )}

        <section className={`kart p-5 ${GOMULU ? '' : 'mt-6'}`}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Transkriptini yükle</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--soluk)' }}>
                e-Devlet&rsquo;ten aldığın <strong>Not Döküm Belgesi</strong> ya da Ege SSO&rsquo;dan
                indirdiğin transkript. İkisi de PDF olmalı.
              </p>
            </div>
            <input
              ref={girdiRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => dosyaSec(e.target.files?.[0])}
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

        {sonuc && (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="kart p-5">
                <div className="text-sm" style={{ color: 'var(--soluk)' }}>
                  {degistirilmis ? 'Senaryo AGNO' : 'AGNO'}
                </div>
                <div className="mt-1 text-4xl font-bold text-ege-700">{ondalik(ortalama.agno)}</div>
                <div className="mt-1 text-sm" style={{ color: 'var(--soluk)' }}>
                  {ondalik(ortalama.puanToplam, 2)} puan / {ondalik(ortalama.aktsToplam, 0)} AKTS
                </div>
              </div>
              <div className="kart p-5">
                <div className="text-sm" style={{ color: 'var(--soluk)' }}>
                  Ortalamaya giren ders
                </div>
                <div className="mt-1 text-4xl font-bold">{ortalama.dersSayisi}</div>
                <div className="mt-1 text-sm" style={{ color: 'var(--soluk)' }}>
                  toplam {dersler.length} kayıt okundu
                </div>
              </div>
              <div className="kart p-5">
                <div className="text-sm" style={{ color: 'var(--soluk)' }}>
                  Belge kaynağı
                </div>
                <div className="mt-1 text-xl font-semibold">{bicimAdi(sonuc.kaynak)}</div>
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
                      : `Belgede ${ondalik(dogrulama.beyan)} yazıyor — kontrol et`}
                  </div>
                )}
              </div>
            </section>

            {dogrulama && !dogrulama.tutuyor && (
              <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                Hesapladığımız ortalama belgenin kendi yazdığı değerden farklı. Transkriptinde
                okuyamadığımız bir durum olabilir (muafiyet, yerine sayılan ders, yatay geçiş).
                Sonucu resmî kabul etme ve mümkünse bize bildir.
              </p>
            )}

            <section className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Dersler ve senaryo</h2>
                {degistirilmis && (
                  <button
                    type="button"
                    onClick={sifirla}
                    className="rounded-lg border px-3 py-1.5 text-sm"
                    style={{ borderColor: 'var(--cizgi)' }}
                  >
                    Gerçek notlara dön
                  </button>
                )}
              </div>
              <p className="mt-1 text-sm" style={{ color: 'var(--soluk)' }}>
                Bir dersin harf notunu değiştir, AGNO anında yeniden hesaplansın.
              </p>

              {yillar.map(({ yil, dersler: ds, ortalama: yo }) => (
                <div key={yil} className="kart mt-4 overflow-hidden">
                  <div
                    className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3"
                    style={{ background: 'var(--zemin)' }}
                  >
                    <h3 className="font-semibold">{yil}</h3>
                    <span className="text-sm" style={{ color: 'var(--soluk)' }}>
                      {yo.aktsToplam ? (
                        <>
                          Yıl ortalaması <strong>{ondalik(yo.agno)}</strong> · {ondalik(yo.aktsToplam, 0)} AKTS
                        </>
                      ) : (
                        'Henüz notlandırılmamış'
                      )}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ color: 'var(--soluk)' }}>
                          <th className="px-5 py-2 text-left font-medium">Ders</th>
                          <th className="px-3 py-2 text-left font-medium">Dönem</th>
                          <th className="px-3 py-2 text-right font-medium">AKTS</th>
                          <th className="px-3 py-2 text-left font-medium">Not</th>
                          <th className="px-5 py-2 text-right font-medium">Puan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ds.map((d, i) => {
                          const girer = ortalamayaGirer(d);
                          return (
                            <tr key={`${d.kod}-${d.donem}-${i}`} className="border-t" style={{ borderColor: 'var(--cizgi)' }}>
                              <td className="px-5 py-2">
                                <div className="font-medium">{d.ad || d.kod}</div>
                                <div className="text-xs" style={{ color: 'var(--soluk)' }}>
                                  {d.kod}
                                  {d.aciklama ? ` · ${d.aciklama}` : ''}
                                </div>
                              </td>
                              <td className="px-3 py-2">{d.donem ?? '—'}</td>
                              <td className="px-3 py-2 text-right">{d.akts ?? '—'}</td>
                              <td className="px-3 py-2">
                                {d.devamEdiyor ? (
                                  <span style={{ color: 'var(--soluk)' }}>devam ediyor</span>
                                ) : (
                                  <select
                                    value={d.harf ?? ''}
                                    onChange={(e) => notDegistir(d.kod, d.yil, d.donem, e.target.value)}
                                    className={`rounded border px-2 py-1 ${
                                      d.harf && !basariliMi(d.harf) ? 'text-red-600 dark:text-red-300' : ''
                                    }`}
                                    style={{ borderColor: 'var(--cizgi)', background: 'var(--yuzey)' }}
                                  >
                                    <option value="">—</option>
                                    {HARFLER.map((h) => (
                                      <option key={h} value={h}>
                                        {h}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </td>
                              <td className="px-5 py-2 text-right">
                                {girer && d.akts != null && d.harf
                                  ? ondalik(
                                      (HARF_TABLOSU.find((h) => h.harf === d.harf)?.katsayi ?? 0) * d.akts
                                    )
                                  : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

        {!GOMULU && (
        <section className="kart mt-10 p-5">
          <h2 className="text-xl font-semibold">Ege Üniversitesi&rsquo;nde AGNO nasıl hesaplanır?</h2>
          <p className="mt-2" style={{ color: 'var(--soluk)' }}>
            Ege&rsquo;de genel not ortalamasının resmî adı <strong>AGNO</strong> (Ağırlıklı Genel Not
            Ortalaması); transkriptte <strong>GNO</strong> olarak da geçer. Bazı üniversitelerin
            kullandığı &ldquo;GANO&rdquo; terimi Ege&rsquo;de kullanılmaz, hesap aynı şeydir.
          </p>
          <p className="mt-3">
            Her dersin harf notu katsayısı o dersin <strong>AKTS kredisiyle</strong> çarpılır, çıkan
            değerler toplanır ve alınan tüm derslerin AKTS toplamına bölünür. Yerel kredi değil, AKTS
            kullanılır — Ölçme ve Değerlendirme Esasları Yönergesi bunu açıkça yazıyor. Ders tekrarında
            en son alınan harf notu geçerlidir.
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
                    <td className="py-2">
                      {h.harf === 'FF' ? '—' : `${h.altPuan}–${h.ustPuan}`}
                    </td>
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
            Ege&rsquo;de geçer not CC ve üstüdür. DC ve DD birçok üniversitede koşullu geçer sayılsa da
            Ege&rsquo;nin yönergesinde başarısız kabul edilir ve ders tekrarı gerekir. Mezuniyet için
            AGNO&rsquo;nun en az 2,00 olması gerekir.
          </p>
        </section>
        )}

        {!GOMULU && (
        <section className="kart mt-6 p-5">
          <h2 className="text-xl font-semibold">Transkriptimi nereden alırım?</h2>
          <p className="mt-2">
            <strong>e-Devlet:</strong> &ldquo;Yükseköğretim Mezun Belgesi / Öğrenci Belgesi&rdquo;
            hizmetlerinden not döküm belgesini PDF olarak indirebilirsin. Bu belgeyi öneriyoruz, en
            düzenli okuduğumuz biçim bu.
          </p>
          <p className="mt-2">
            <strong>Ege SSO:</strong> Öğrenci bilgi sistemine girip transkript ekranından
            &ldquo;İndir&rdquo; diyerek PDF alabilirsin. Bu biçimde muafiyet ve ders tekrarı gibi özel
            durumlar bazen tam okunamıyor; sonucun belgedeki değerle uyuşup uyuşmadığını üstteki rozet
            gösteriyor.
          </p>
        </section>
        )}

        <p className={`text-center text-sm ${GOMULU ? 'mt-6' : 'mt-8'}`} style={{ color: 'var(--soluk)' }}>
          Yüklediğin PDF tarayıcında işlenir, hiçbir sunucuya yüklenmez. Sonuçlar bilgilendirme
          amaçlıdır; resmî ortalaman için öğrenci işlerine danış.
        </p>
      </main>
    </div>
  );
}
