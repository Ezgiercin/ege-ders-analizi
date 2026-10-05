/**
 * ebp.ege.edu.tr'nin jsTree verisini duz program listesine cevirir.
 * Agac: fakulte -> bolum -> program (program dugumunde a_attr.href var).
 */
export function agactanProgramlar(dugumler, derece) {
  const cikti = [];

  const gez = (liste, yol) => {
    for (const d of liste || []) {
      const ad = (d.text || '').replace(/\s+/g, ' ').trim();
      const yeniYol = [...yol, ad];
      const href = d.a_attr && d.a_attr.href;

      if (!d.children || d.children.length === 0) {
        if (!href) continue;
        const m = href.match(/\/DereceProgramlari\/Detay\/(\d+)\/(\d+)\/(\d+)\/(\d+)/);
        cikti.push({
          id: m ? m[3] : href,
          bolumId: m ? m[2] : null,
          yil: m ? m[4] : null,
          derece,
          fakulte: yeniYol[0] || null,
          bolum: yeniYol[1] || null,
          // "Lisans (İngilizce)" gibi; bolum adiyla birlesince tam ad olur
          tur: yeniYol[2] || null,
          ad: [yeniYol[1], yeniYol[2]].filter(Boolean).join(' — '),
          yol: href,
        });
        continue;
      }
      gez(d.children, yeniYol);
    }
  };

  gez(dugumler, []);

  // Ayni program birden fazla dugumde gorunebiliyor
  const gorulen = new Set();
  return cikti.filter((p) => {
    if (gorulen.has(p.yol)) return false;
    gorulen.add(p.yol);
    return true;
  });
}
