/* ==========================================================================
   HARİTA: Hurda Gezegeni — rastgele (parçalı)
   W.M.D'nin prefab zinciri mantığıyla: elle üretilmiş arazi parçaları maç
   tohumuna göre seçilir, aynalanır ve yerleştirilir.

     1. Zemin zinciri: soldan sağa geniş/tepeli zemin parçaları. Alt kenarları
        suyun altında kalır; aralarında ya bindirme (birleşik arazi) ya da
        su boşluğu olur. Her parça biraz farklı derinliğe gömülür.
     2. Hava parçaları: yüzen adalar ve köprüler, boş gökyüzüne; başka
        araziye değmeyecek ve üstünde asker duracak boşluk kalacak şekilde.

   Çarpışma maskesi harita-parcalar-veri.js'teki RLE sayılarından kurulur
   (resimden okunmaz): aynı tohum her telefonda piksel piksel aynı haritayı
   verir. Gökyüzü, paralaks ve bataklık Hurda Gezegeni'nden gelir.
   Parçaları yenilemek: gasmerler-parca-uretimi/araclar/parca_derle.py
   ========================================================================== */
const HARITA_RASTGELE = (() => {
  const W = 1900, H = 800, SU = 760;
  const K = 1 / 0.599747;          // arazi tuvali ölçeği (Hurda Gezegeni ile aynı: patlama izleri aynı incelikte)
  const ALT = 24;                  // zemin parçasının alt kesiği su çizgisinin en az bu kadar altında
  const GOMUL = 80;                // zemin parçası en çok bu kadar daha derine gömülür (yükseklik çeşitliliği)
  const HAVA_PAY_X = 50, HAVA_PAY_UST = 80, HAVA_PAY_ALT = 60;   // hava parçasının çevresinde boş kalacak alan
  const HAVA_UST = 100;            // hava parçası tavanı
  const SURUM = 1;                 // parça resimleri değişince artır
  const PARCA = HARITA_PARCA_VERI.map(p => ({
    ...p, satir: p.rle.split(';').map(r => r ? r.split(',').map(s => parseInt(s, 16)) : []),
  }));
  const ZEMIN = PARCA.filter(p => p.tur === 'zemin'), HAVA = PARCA.filter(p => p.tur !== 'zemin');

  const img = {};
  let yukleniyor = null, hazir = false, plan = [];

  function yukle(klasor = 'assets/maps/hurda-parcalar/') {
    if (yukleniyor) return yukleniyor;
    yukleniyor = Promise.all(PARCA.map(p => new Promise((ok, hata) => {
      const i = new Image(); i.decoding = 'async';
      i.onload = () => { img[p.ad] = i; ok(); };
      i.onerror = () => { yukleniyor = null; hata(new Error('Harita parçası yüklenemedi: ' + p.ad)); };
      i.src = klasor + p.ad + '.webp?v=' + SURUM;
    }))).then(() => { hazir = true; });
    return yukleniyor;
  }

  function rastgele(a) {   // mulberry32 (oyunun rng'sinden ayrı: harita üretimi oyunun diğer rastgele sırasını bozmasın)
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  // Parçanın maskesini solid'e yazar (ekle) ya da değdiği yer var mı bakar (pay: çevresinde boş kalacak alan)
  function yaz(solid, o) {
    const p = o.p;
    for (let y = 0; y < p.h; y++) {
      const wy = o.y + y; if (wy < 0 || wy >= H) continue;
      const v = p.satir[y];
      for (let i = 0; i < v.length; i += 2) {
        let x0 = o.ayna ? p.w - v[i] - v[i + 1] : v[i];
        x0 += o.x; let x1 = x0 + v[i + 1];
        if (x0 < 0) x0 = 0; if (x1 > W) x1 = W;
        if (x1 > x0) solid.fill(1, wy * W + x0, wy * W + x1);
      }
    }
  }
  function bosMu(solid, x0, y0, x1, y1) {
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
    for (let y = y0; y < y1; y++) if (solid.subarray(y * W + x0, y * W + x1).includes(1)) return false;
    return true;
  }

  // Tohumdan haritayı kurar: solid doldurulur, plan çizim için saklanır
  function kur(solid, tohum) {
    const r = rastgele((tohum >>> 0) ^ 0x5bd1e995), sec = a => a[Math.floor(r() * a.length)];
    solid.fill(0); plan = [];
    // 1. Zemin zinciri
    let x = -60 - Math.floor(r() * 120), son = null, bosluk = 0;
    while (x < W + 20) {
      let p = sec(ZEMIN); if (p === son) p = sec(ZEMIN.filter(q => q !== son));
      const o = { p, x, y: SU + ALT + Math.floor(r() * GOMUL) - p.h, ayna: r() < 0.5 };
      plan.push(o); yaz(solid, o); son = p;
      // en az bir su boşluğu olsun; boşluk yürüyerek değil zıplama/ip/jetle geçilir
      const su = bosluk === 0 && x + p.w > W * 0.55 ? true : r() < 0.35;
      if (su) bosluk++;
      x += p.w + (su ? 70 + Math.floor(r() * 110) : -(50 + Math.floor(r() * 110)));
    }
    // 2. Hava parçaları
    const hedef = 3 + Math.floor(r() * 3);
    for (let n = 0, dene = 0; n < hedef && dene < 300; dene++) {
      const p = sec(HAVA), xx = 30 + Math.floor(r() * (W - 60 - p.w)), yy = HAVA_UST + Math.floor(r() * (SU - 200 - HAVA_UST - p.h));
      if (!bosMu(solid, xx - HAVA_PAY_X, yy - HAVA_PAY_UST, xx + p.w + HAVA_PAY_X, yy + p.h + HAVA_PAY_ALT)) continue;
      const o = { p, x: xx, y: yy, ayna: r() < 0.5 };
      plan.push(o); yaz(solid, o); n++;
    }
    return plan;
  }

  // Arazi tuvali (Hurda Gezegeni'yle aynı ölçek); döndürülen tctx'e dünya koordinatlarıyla çizilir
  function arazi() {
    const cv = document.createElement('canvas');
    cv.width = Math.round(W * K); cv.height = Math.round(H * K);
    const c = cv.getContext('2d');
    for (const o of plan) {
      const im = img[o.p.ad], w = o.p.w * K, h = o.p.h * K;
      c.save(); c.translate(o.x * K + (o.ayna ? w : 0), o.y * K); if (o.ayna) c.scale(-1, 1);
      c.drawImage(im, 0, 0, w, h); c.restore();
    }
    c.setTransform(K, 0, 0, K, 0, 0);
    return { terr: cv, tctx: c };
  }

  return { ad: 'Hurda Gezegeni (rastgele)', W, H, get hazir() { return hazir; }, get plan() { return plan; }, yukle, kur, arazi };
})();
