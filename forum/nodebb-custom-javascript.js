/*
  EGE Forum — ders analizi çerçevesi için yardımcı kod.

  NEREYE: Admin → Appearance → Custom Content → Custom JavaScript
  NEDEN:  NodeBB, widget HTML'inin içindeki <script> etiketlerini güvenlik
          gereği çalıştırmıyor. Bu yüzden çerçevenin yüksekliğini ayarlayan ve
          temayı eşitleyen kod buraya konuyor; burası her sayfada çalışıyor.

  Kod yalnızca /ders-analizi sayfasındaki çerçeve varken iş yapar,
  forumun geri kalanına dokunmaz.
*/
(function () {
  var ID = 'ege-ders-analizi-cerceve';

  function cerceve() {
    return document.getElementById(ID);
  }

  // Araç boyunu bildirdikçe çerçeveyi ona göre ayarla.
  window.addEventListener('message', function (e) {
    var v = e && e.data;
    if (!v || v.tip !== 'ege-ders-analizi:yukseklik') return;
    var c = cerceve();
    var y = Number(v.yukseklik);
    if (!c || !(y > 80) || y > 20000) return;
    var simdiki = c.getBoundingClientRect().height;
    // 2 pikselden kucuk farklari yok say; aksi halde her kucuk degisimde
    // cerceve titrer. Buyume engellenmez: engellenirse icerik sigmaz ve
    // cerceve icinde ikinci bir kaydirma cubugu cikar.
    if (Math.abs(y + 16 - simdiki) < 2) return;
    c.style.height = y + 16 + 'px';
  });

  // Forum koyu temadaysa aracı da koyu aç, iki tema çakışmasın.
  function temaEsitle() {
    var c = cerceve();
    if (!c) return;
    var kok = document.documentElement;
    var koyu =
      kok.getAttribute('data-bs-theme') === 'dark' ||
      kok.getAttribute('data-theme') === 'dark' ||
      document.body.classList.contains('dark');
    var adres = (c.getAttribute('src') || '').split('&tema=')[0];
    if (!adres) return;
    var yeni = adres + (koyu ? '&tema=koyu' : '');
    if (c.getAttribute('src') !== yeni) c.setAttribute('src', yeni);
  }

  // Sayfa ilk açılışta ve NodeBB sayfalar arası geçiş yaptığında çalışsın.
  function baslat() {
    temaEsitle();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', baslat);
  } else {
    baslat();
  }
  if (window.$ && window.$(window).on) {
    window.$(window).on('action:ajaxify.end', baslat);
  }

  // Tema düğmesi değiştirilirse takip et.
  new MutationObserver(temaEsitle).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-bs-theme', 'data-theme', 'class'],
  });
})();
