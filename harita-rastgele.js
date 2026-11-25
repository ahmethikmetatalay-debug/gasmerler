/* ==========================================================================
   HARİTA: Hurda Gezegeni — rastgele (parçalı, bağlantılı)
   W.M.D'nin prefab zinciri mantığı: rastgele olan "hangi parça", nereye
   geleceğini bağlantı kuralı belirler.

   Her parçanın üst ve alt yüzey profili maskeden çıkarılır (sütun başına
   ilk/son katı satır). Zincir soldan sağa kurulur; her adımda bir bağlantı
   türü seçilir:
     birleş   sonraki zemin, iki yüzey arada çukur kalmadan buluşacak kadar
              bindirilir (W.M.D Placement noktası gibi)
     köprü    önceki karanın kenarındaki düz çıkıntıdan başlar; karşı kara,
              köprünün öbür ucu kendi yüzeyine aynı yükseklikte oturacak
              şekilde aranır; altında su boşluğu kalır
     basamak  iki kara arasındaki suyun üstüne, iki yandan da zıplayıp ya da
              halatla ulaşılacak yükseklikte yüzen ada
     su       düz su boşluğu
   Sonra yüksek tepelerin yanına, tepeden ulaşılabilir uzaklıkta en çok iki
   yüzen ada. Ek yerleri (W.M.D Dressing noktası gibi) toprak + hurda
   yığınıyla örtülür; dekor yalnız görüntüdür, çarpışmaya katılmaz.

   Çarpışma maskesi harita-parcalar-veri.js'teki RLE'den kurulur ve bütün
   hesap tam sayıdır: aynı tohum her telefonda piksel piksel aynı haritayı
   verir. Gökyüzü, paralaks, bataklık Hurda Gezegeni'nden gelir.
   Parçaları yenilemek: gasmerler-parca-uretimi/araclar/parca_derle.py
   ========================================================================== */
const HARITA_RASTGELE = (() => {
  const W = 1900, H = 800, SU = 760, YOK = 99999;
  const K = 1 / 0.599747;          // arazi tuvali ölçeği (Hurda Gezegeni ile aynı)
  const ALT = 24, GOMUL = 80;      // zemin alt kesiği su çizgisinin ALT..ALT+GOMUL px altında
  const CUKUR = 10;                // birleşimde yüzeyde izin verilen en derin çukur
  const UC = 36;                   // köprü ucu karanın üstüne bu kadar biner
  const KENAR = 55;                // arazi iki yanda dünyanın en az bu kadar içinde biter: en uzak görünümde iki kenarda su
  const SURUM = 3;
  // Aynı parça farklı boylarda kullanılır (W.M.D prefab m_Scale gibi). Ölçekleme tam sayıyla: her telefonda aynı maske
  const OLCEKLER = { zemin: [100, 118, 136], ada: [100, 120], kiris: [100, 115] };
  const profil = (p, satir) => {
    const ust = new Int16Array(p.w).fill(-1), alt = new Int16Array(p.w).fill(-1);
    satir.forEach((v, y) => { for (let i = 0; i < v.length; i += 2) for (let x = v[i]; x < v[i] + v[i + 1]; x++) { if (ust[x] < 0) ust[x] = y; alt[x] = y; } });
    return { ust, alt };
  };
  const PARCA = [];
  for (const d of HARITA_PARCA_VERI) {
    const taban = d.rle.split(';').map(r => r ? r.split(',').map(s => parseInt(s, 16)) : []);
    for (const s of OLCEKLER[d.tur]) {
      const w = Math.floor(d.w * s / 100), h = Math.floor(d.h * s / 100), satir = [];
      for (let y = 0; y < h; y++) {
        const v = taban[Math.floor(y * 100 / s)], o = [];
        for (let i = 0; i < v.length; i += 2) { const a = Math.floor(v[i] * s / 100), b = Math.min(w, Math.floor((v[i] + v[i + 1]) * s / 100)); if (b > a) o.push(a, b - a); }
        satir.push(o);
      }
      const p = { ad: d.ad, tur: d.tur, olcek: s, w, h, satir };
      Object.assign(p, profil(p, satir)); PARCA.push(p);
    }
  }
  const ADLAR = [...new Set(PARCA.map(p => p.ad))];
  const ZEMIN = PARCA.filter(p => p.tur === 'zemin'), ADA = PARCA.filter(p => p.tur === 'ada'), KIRIS = PARCA.filter(p => p.tur === 'kiris');

  const img = {};
  let yukleniyor = null, hazir = false, plan = [], ekler = [], tohumSon = 0;

  function yukle(klasor = 'assets/maps/hurda-parcalar/') {
    if (yukleniyor) return yukleniyor;
    yukleniyor = Promise.all(ADLAR.map(ad => new Promise((ok, hata) => {
      const i = new Image(); i.decoding = 'async';
      i.onload = () => { img[ad] = i; ok(); };
      i.onerror = () => { yukleniyor = null; hata(new Error('Harita parçası yüklenemedi: ' + ad)); };
      i.src = klasor + ad + '.webp?v=' + SURUM;
    }))).then(() => { hazir = true; });
    return yukleniyor;
  }

  function rastgele(a) {   // mulberry32 (oyunun rng'sinden ayrı)
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  // Yerleşmiş parça o = { p, x, y, ayna }: dünya sütununda üst/alt yüzey (yoksa YOK / -1)
  const sutun = (o, wx) => { const c = wx - o.x; if (c < 0 || c >= o.p.w) return -1; return o.ayna ? o.p.w - 1 - c : c; };
  const ustW = (o, wx) => { const c = sutun(o, wx); return c < 0 || o.p.ust[c] < 0 ? YOK : o.y + o.p.ust[c]; };
  const altW = (o, wx) => { const c = sutun(o, wx); return c < 0 || o.p.alt[c] < 0 ? -1 : o.y + o.p.alt[c]; };
  // Parçanın verilen satırdaki en sol / en sağ katı sütunu (üst profil dışbükey kabulüyle)
  function kenar(o, yy, sag) {
    if (sag) { for (let wx = o.x + o.p.w - 1; wx >= o.x; wx--) if (ustW(o, wx) <= yy && altW(o, wx) >= yy) return wx; }
    else for (let wx = o.x; wx < o.x + o.p.w; wx++) if (ustW(o, wx) <= yy && altW(o, wx) >= yy) return wx;
    return null;
  }
  const zemin = (p, x, gomul, ayna) => ({ p, x, y: SU + ALT + gomul - p.h, ayna });

  function yaz(solid, o, deger = 1) {
    const p = o.p;
    for (let y = 0; y < p.h; y++) {
      const wy = o.y + y; if (wy < 0 || wy >= H) continue;
      const v = p.satir[y];
      for (let i = 0; i < v.length; i += 2) {
        let x0 = (o.ayna ? p.w - v[i] - v[i + 1] : v[i]) + o.x, x1 = x0 + v[i + 1];
        if (x0 < 0) x0 = 0; if (x1 > W) x1 = W;
        if (x1 > x0) solid.fill(deger, wy * W + x0, wy * W + x1);
      }
    }
  }
  function bosMu(solid, x0, y0, x1, y1) {
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
    for (let y = y0; y < y1; y++) if (solid.subarray(y * W + x0, y * W + x1).includes(1)) return false;
    return true;
  }
  // Ada için boşluk: maskesinin çevresinde pay kadar başka katı yok
  function adaSigar(solid, o, payX, payUst, payAlt) {
    if (o.x < KENAR || o.x + o.p.w > W - KENAR || o.y < 70 || o.y + o.p.h > SU - 40) return false;
    return bosMu(solid, o.x - payX, o.y - payUst, o.x + o.p.w + payX, o.y + o.p.h + payAlt);
  }

  function kur(solid, tohum) {
    tohumSon = tohum >>> 0;
    const r = rastgele(tohumSon ^ 0x5bd1e995), sec = a => a[Math.floor(r() * a.length)];
    const karistir = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    solid.fill(0); plan = []; ekler = [];
    const kara = [], koy = o => { plan.push(o); yaz(solid, o); if (o.p.tur === 'zemin') kara.push(o); };
    const son = () => kara[kara.length - 1];
    const sagUc = o => kenar(o, SU - 6, true), solUc = o => kenar(o, SU - 6, false);
    const digerZemin = p => ZEMIN.filter(q => q.ad !== p.ad);   // aynı çizim art arda gelmesin
    // parçanın suyun altı dahil en sol / en sağ sütunu; zincir önce 0'dan SINIR'a kurulur, sonra ortalanır
    const tamSol = o => { for (let wx = o.x; wx < o.x + o.p.w; wx++) if (ustW(o, wx) < YOK) return wx; return o.x; };
    const tamSag = o => { for (let wx = o.x + o.p.w - 1; wx >= o.x; wx--) if (ustW(o, wx) < YOK) return wx; return o.x; };
    const SINIR = W - 2 * KENAR;

    // --- bağlantı türleri (başarısızsa false; hiçbir şey yerleştirmez)
    function birles() {
      const a = son(), aSag = a.x + a.p.w;
      const aday = [];
      for (const q of digerZemin(a.p)) for (const ayna of [false, true]) for (let g = 0; g <= GOMUL; g += 10) {
        const ust = Math.min(a.p.w, q.w) * 0.5;
        for (let ov = 60; ov <= ust; ov += 6) {
          const o = zemin(q, sagUc(a) + 1 - ov, g, ayna);
          if (o.x <= a.x + 80 || tamSag(o) > SINIR) continue;
          const b0 = Math.max(o.x, a.x), b1 = Math.min(aSag, o.x + o.p.w) - 1;
          // birleşim bölgesindeki ortak yüzey; uçlardan derine inen çukur olmasın
          const U = wx => Math.min(ustW(a, wx), ustW(o, wx));
          let ilk = -1; for (let wx = b0; wx <= b1; wx++) if (U(wx) < YOK) { ilk = wx; break; }
          let sonx = -1; for (let wx = b1; wx >= b0; wx--) if (U(wx) < YOK) { sonx = wx; break; }
          if (ilk < 0) continue;
          const sinir = Math.max(U(ilk), U(sonx)) + CUKUR;
          let enDip = 0, dipX = ilk, iyi = true;
          for (let wx = ilk; wx <= sonx; wx++) { const u = U(wx); if (u > sinir) { iyi = false; break; } if (u > enDip) { enDip = u; dipX = wx; } }
          if (iyi && enDip < SU - 40) aday.push({ o, dipX, dipY: enDip });
        }
      }
      if (!aday.length) return false;
      const s = sec(aday);
      koy(s.o); ekler.push({ tur: 'ek', o: s.o, once: a, y: s.dipY });
      return true;
    }

    function kopru() {
      const a = son(), R = sagUc(a);
      const capalar = [];
      for (let xl = R - 30; xl >= R - 280 && xl > a.x + 40; xl -= 3) {
        const ya = ustW(a, xl);
        if (ya >= SU - 90 || Math.abs(ustW(a, xl - 10) - ya) > 6 || Math.abs(ustW(a, xl + 6) - ya) > 6) continue;
        if (!(ustW(a, xl + 45) > ya + 15)) continue;   // çıkıntının ucu: hemen sağı aşağı iniyor
        capalar.push({ xl, ya });
      }
      for (const { xl, ya } of karistir(capalar).slice(0, 12)) for (const b of karistir(KIRIS)) for (const bAyna of karistir([false, true])) {
        const bo = { p: b, x: xl - UC, y: 0, ayna: bAyna };
        bo.y = ya - (ustW(bo, xl) === YOK ? 0 : ustW(bo, xl)) + 3;
        if (bo.x + b.w > W + 200 || bo.y + b.h > SU - 40) continue;   // sarkan kablolar suya değmesin
        let temiz = true;   // köprünün altı: sol kara köprüye değmesin (uçtaki bindirme hariç)
        for (let wx = xl + 20; wx < bo.x + b.w; wx++) if (ustW(a, wx) < altW(bo, wx) - 12) { temiz = false; break; }
        if (!temiz) continue;
        const xr = bo.x + b.w - UC, aday = [];
        for (const q of ZEMIN) for (const ayna of [false, true]) for (let g = 0; g <= GOMUL; g += 8) for (let qx = xr - q.w + 40; qx <= xr - 30; qx += 2) {
          const o = zemin(q, qx, g, ayna), yr = ustW(o, xr);
          if (tamSag(o) > SINIR) continue;
          if (yr < ya - 4 || yr > ya + 6) continue;   // köprü ucu karşı yüzeye aynı hizada oturur
          if (Math.abs(ustW(o, xr + 8) - yr) > 6 || Math.abs(ustW(o, xr - 6) - yr) > 6) continue;
          const sl = solUc(o); if (sl === null || sl - R < 90) continue;   // altında su boşluğu
          let ok = true;
          for (let wx = o.x; wx <= xr - 20; wx++) if (ustW(o, wx) < altW(bo, wx) - 12) { ok = false; break; }
          if (ok) aday.push(o);
        }
        if (!aday.length) continue;
        const o = sec(aday);
        koy(o); koy(bo);   // köprü iki karadan sonra çizilir: uçları yüzeylerin üstüne oturur
        ekler.push({ tur: 'kopru', x: xl, y: ya }, { tur: 'kopru', x: xr, y: ya });
        return true;
      }
      return false;
    }

    function suBoslugu(enAz, enCok, koyma) {   // sığan parça yoksa null
      const a = son(), ayna = r() < 0.5, g = Math.floor(r() * GOMUL), bosluk = enAz + Math.floor(r() * (enCok - enAz));
      for (const q of karistir(digerZemin(a.p))) {
        const o = zemin(q, 0, g, ayna);
        o.x = sagUc(a) + bosluk - (solUc(o) ?? 0);
        if (tamSag(o) > SINIR) continue;
        if (!koyma) koy(o);
        return o;
      }
      return null;
    }

    function basamak() {
      const a = son();
      const o = suBoslugu(190, 300, true); if (!o) return false;
      const R = sagUc(a), L = solUc(o);
      yaz(solid, o);   // geçici: ada boşluğu hesabı için
      // iki yanın kenara yakın yüzeyi: ada bunlardan en çok biraz aşağıda, en çok 110 px yukarıda
      let ya = YOK, yb = YOK;
      for (let wx = R - 80; wx <= R; wx++) ya = Math.min(ya, ustW(a, wx));
      for (let wx = L; wx <= L + 80; wx++) yb = Math.min(yb, ustW(o, wx));
      const yuksek = Math.min(ya, yb), aday = [];
      for (const q of ADA) for (const ayna of [false, true]) for (let ix = R - 40; ix + q.w <= L + 40; ix += 4) for (let iy = yuksek - 110; iy <= yuksek + 40; iy += 6) {
        const io = { p: q, x: ix, y: iy, ayna };
        if (adaSigar(solid, io, 22, 70, 30)) aday.push(io);
      }
      yaz(solid, o, 0);   // karşı kara boşlukla ayrık: silmek başka parçaya dokunmaz
      if (!aday.length) return false;   // ada sığmadı: zincir başka bağlantı dener
      koy(o); koy(sec(aday));
      return true;
    }

    // --- zincir
    const ilk = zemin(sec(ZEMIN), 0, Math.floor(r() * GOMUL), r() < 0.5);
    ilk.x = -(tamSol(ilk) - ilk.x); koy(ilk);
    let kopruVar = false, boslukVar = false;
    for (let adim = 0; tamSag(son()) < SINIR - 120 && adim < 12; adim++) {
      const z = r(), kalan = W - sagUc(son());
      let tur = z < 0.4 ? 'birles' : z < 0.75 ? 'kopru' : z < 0.88 ? 'basamak' : 'su';
      if (!kopruVar && W - kalan > 450 && kalan > 300) tur = 'kopru';   // her haritada bir köprü denensin
      let ok = false;
      if (tur === 'kopru') { ok = kopru(); if (ok) kopruVar = boslukVar = true; }
      if (!ok && tur === 'basamak') { ok = basamak(); if (ok) boslukVar = true; }
      const zorla = !boslukVar && W - kalan > 450;   // her haritada en az bir geçit: köprü olmazsa ada basamağı ya da su
      if (!ok && zorla) { ok = basamak(); if (ok) boslukVar = true; }
      if (!ok && tur !== 'su' && !zorla) ok = birles();
      if (!ok && tur === 'su') ok = !!suBoslugu(80, 160);
      if (!ok) ok = birles();
      if (!ok) ok = !!suBoslugu(80, 160);
      if (!ok) break;   // sığan parça kalmadı
      boslukVar = kara.some((o, i) => i > 0 && solUc(o) > sagUc(kara[i - 1]));   // iki kara arasında su var mı
    }
    // --- zinciri ortala: iki yanda en az KENAR su; solid sıfırdan yeniden yazılır (kırpılmış su altı kalmasın)
    let L = YOK, R = -YOK;
    for (const o of plan) { L = Math.min(L, tamSol(o)); R = Math.max(R, tamSag(o)); }
    const bos = W - (R - L + 1), oynak = Math.max(0, Math.floor(bos / 2) - KENAR);
    const dx = Math.floor(bos / 2) + Math.floor(r() * (2 * oynak + 1)) - oynak - L;
    for (const o of plan) o.x += dx;
    for (const e of ekler) if (e.tur === 'kopru') e.x += dx;
    solid.fill(0); for (const o of plan) yaz(solid, o);

    // --- yüksek tepelerin yanına ulaşılabilir yüzen adalar (en çok 2)
    const T = wx => { let t = YOK; for (const o of kara) t = Math.min(t, ustW(o, wx)); return t; };
    const tepeler = [];
    for (let wx = 60; wx < W - 60; wx += 10) { const t = T(wx); if (t < SU - 250 && t <= T(wx - 40) && t <= T(wx + 40)) tepeler.push({ x: wx, y: t }); }
    const adaHedef = 1 + Math.floor(r() * 3);
    for (const tp of karistir(tepeler)) {
      if (plan.filter(o => o.p.tur === 'ada').length >= adaHedef) break;
      const q = sec(ADA), yon = r() < 0.5 ? -1 : 1, aday = [];
      for (let d = 120; d <= 260; d += 8) for (let dy = 40; dy <= 150; dy += 8) {
        const ix = yon > 0 ? tp.x + d : tp.x - d - q.w, io = { p: q, x: ix, y: tp.y - dy, ayna: r() < 0.5 };
        if (adaSigar(solid, io, 40, 80, 50)) aday.push(io);
      }
      if (aday.length) koy(sec(aday));
    }
    return plan;
  }

  // ---- Çizim: parçalar plan sırasıyla, sonra ek yeri dekorları (yalnız araziye boyanır: source-atop)
  function dekor(c) {
    const H2 = HARITA_HURDA_PNG.hurda, r = rastgele(tohumSon ^ 0x2545f491);
    const TOPRAK = ['#4e443b', '#5b5148', '#463d35'];
    const yigin = (x, y, boy) => {
      c.save(); c.globalCompositeOperation = 'source-atop';
      c.fillStyle = TOPRAK[Math.floor(r() * 3)];
      c.beginPath(); c.ellipse(x, y, 15 * boy + r() * 8, 11 * boy + r() * 6, (r() - 0.5) * 0.8, 0, Math.PI * 2); c.fill();
      c.lineJoin = 'round';
      for (let k = 0, n = r() < 0.4 ? 1 : 0; k < n; k++) {
        c.save(); c.translate(x + (r() - 0.5) * 18 * boy, y + (r() - 0.5) * 10 * boy); c.rotate((r() - 0.5) * 1.4);
        c.scale(1.7 * boy, 1.7 * boy); if (r() < 0.5) c.scale(-1, 1);
        c.strokeStyle = HARITA_HURDA_PNG.cizgi; c.lineWidth = 1.3;
        H2[Math.floor(r() * H2.length)](c, r()); c.restore();
      }
      c.restore();
    };
    for (const e of ekler) {
      if (e.tur === 'kopru') { yigin(e.x, e.y + 16, 0.9); continue; }
      // birleşim: sonra çizilen parçanın sol konturu öncekinin üstünde görünür; boyunca yığınlar
      for (let yy = e.y + 14; yy < SU; yy += 36) {
        const wx = kenar(e.o, yy, false);
        if (wx === null || ustW(e.once, wx - 6) > yy) continue;
        yigin(wx + 2, yy, yy < e.y + 30 ? 1.1 : 1);
      }
    }
  }
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
    dekor(c);
    return { terr: cv, tctx: c };
  }

  return { ad: 'Hurda Gezegeni (rastgele)', W, H, get hazir() { return hazir; }, get plan() { return plan; }, get ekler() { return ekler; }, yukle, kur, arazi };
})();
