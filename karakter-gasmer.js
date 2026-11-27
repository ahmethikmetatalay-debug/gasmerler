/* ======================================================================
   GASMER_YENI: resimli, modüler Gaşmer karakteri (v30.2)
   Parçalar assets/gasmer/*.webp (karakter-gasmer-veri.js: GASMER_PARCA, koordinatlar KAYNAK pikselinde,
   resimler yarı boyda; her çizim boyutu manifestten verilir). Prototip: Masaüstü/karakter-gaşmer/prototip.

   GASMER_YENI.ciz(ctx, {
     x, y   : yere değen nokta (etek/bot altı ortası)      boy : tepeden yere yükseklik (ctx birimi)
     renk   : takım rengi (panço + kapüşon)                yon : 1 sağa, -1 sola
     poz    : 'bekle' | 'yuru' | 'hava' | 'nisan' | 'aci' | 'yumruk' | 'sevinc'
     t      : zaman (sn)        aci : nişan açısı (bakış yönüne göre, aynalamadan önce)
     silah  : WEAPONS id (nişanda elde; 'jet' sırtta tüp, 'punch' eldiven)
     hava   : 0 yükseliyor … 1 düşüyor (poz 'hava')        vurus : 0…1 yumruk uzanması (poz 'yumruk')
     jet    : 0 yok, 1 sırtta tüp, 2 tüp + alev           yuz : 'aci' | 'mutlu' (zorla)   hain : true
     faz    : askere özgü kayma (bekleme salınımları aynı anda olmasın)
   })
   Ağdan bir şey gitmez; her cihaz kendi çizer.
   ====================================================================== */
(function () {
  'use strict';
  const P = window.GASMER_PARCA;
  if (!P) return;
  const R = {};
  const G = window.GASMER_YENI = { hazir: false, yukseklik: 300, ciz, yukle };

  let yukleniyor = false;
  function yukle(onek = '') {
    if (yukleniyor) return; yukleniyor = true;
    const l = [];
    for (const ad in P) { l.push([ad, ad]); if (P[ad].delik) l.push([ad + '-delik', ad + '-delik']); }
    let kalan = l.length, hata = false;
    for (const [k, dosya] of l) {
      const im = new Image();
      im.onload = () => { R[k] = im; if (--kalan === 0 && !hata) hazirla(); };
      im.onerror = () => { hata = true; };
      im.src = onek + 'assets/gasmer/' + dosya + '.webp';
    }
  }
  function hazirla() {
    // karakterin yerel boyu: bekleme pozunda en üst piksel (kapüşon ucu) ile yer arası
    try {
      const c = document.createElement('canvas'); c.width = 200; c.height = 400; const x = c.getContext('2d');
      ciz(x, { x: 100, y: 390, boy: 0, olcekYerel: 1, renk: '#888', yon: 1, poz: 'bekle', t: 0 });
      const d = x.getImageData(0, 0, 200, 400).data;
      let ust = 400; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) { ust = Math.floor((i >> 2) / 200); break; }
      if (ust < 380) G.yukseklik = 390 - ust;
    } catch (e) { /* yerel dosyada getImageData olmayabilir: varsayılan boy */ }
    G.hazir = true;
  }

  // ---------------- yardımcılar ----------------
  const W = ad => P[ad].w, H = ad => P[ad].h;
  const kopya = (ad, f) => { const im = R[ad], c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); f(x, im, c); return c; };
  const boyaOnb = new Map();
  function boyali(ad, renk) {   // gri kumaş takım rengine (multiply), çizgi ve gölge kalır
    const k = ad + renk; let c = boyaOnb.get(k);
    if (!c) {
      c = kopya(ad, (x, im, cv) => {
        x.drawImage(im, 0, 0);
        x.globalCompositeOperation = 'multiply'; x.fillStyle = renk; x.fillRect(0, 0, cv.width, cv.height);
        x.globalCompositeOperation = 'soft-light'; x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(0, 0, cv.width, cv.height);
        x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0);
      });
      boyaOnb.set(k, c);
    }
    return c;
  }
  const koyuOnb = {}, aynaOnb = {};
  const koyu = ad => koyuOnb[ad] || (koyuOnb[ad] = kopya(ad, (x, im) => { x.filter = 'brightness(0.6) saturate(0.8)'; x.drawImage(im, 0, 0); }));
  const aynali = ad => aynaOnb[ad] || (aynaOnb[ad] = kopya(ad, (x, im) => { x.translate(im.width, 0); x.scale(-1, 1); x.drawImage(im, 0, 0); }));
  const yumusak = k => { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); };
  const gecis = (a, b, p, p0, p1) => [a, b, yumusak((p - p0) / (p1 - p0))];

  // ---------------- ölçüler (yerel birim) ----------------
  const PS = 0.35, KS = 0.61, ELS = 0.165, BS = 0.18, CS = 0.2, LS = 0.19, LIFT = 16;
  const BOT_Y = -(P.bot3.alt - P.bot3.bilek[1]) * BS;
  const AYAK_DUR = [[8, BOT_Y + 2, 0, 'bot3'], [-12, BOT_Y - 3, 0, 'bot3-c']];

  // ---------------- yüz ----------------
  const GA = 0.30, GB = 0.70;
  const GOZ = (a, b, o = 0.27, y = 0.43) => [[a, GA, y, o, 0, 1], [b, GB, y, o * 0.92, 0, 1]];
  const MASKE = [['maske-duz', 0.5, 0.80, 1.15, 0]];
  const YUZ = {
    normal: [...GOZ('goz-a', 'goz-b'), ['kas-a', GA, 0.25, 0.22, 0], ['kas-b', GB, 0.24, 0.22, 0], ...MASKE],
    mutlu: [['goz-mutlu-a', GA, 0.42, 0.22, 0], ['goz-mutlu-b', GB, 0.42, 0.22, 0], ...MASKE],
    aci: [['x-a', GA, 0.42, 0.24, 0], ['x-b', GB, 0.42, 0.26, 0], ...MASKE],
    hain: [...GOZ('goz-a', 'goz-b'), ['kas-sert-a', GA, 0.27, 0.24, 0.12], ['kas-sert-b', GB, 0.26, 0.24, -0.12], ...MASKE],
  };
  // Kapüşon (boyalı) + deliğe kırpılmış yüz tek resimde; renk/yüz/bakış (12 yön) başına önbellek
  const kapusOnb = new Map();
  function kapus(ad, renk, yuz, bak) {
    let bq = -1;
    if (bak) bq = Math.round((Math.atan2(bak[1], bak[0]) / (Math.PI * 2) + 1) * 12) % 12;
    const key = ad + renk + yuz + bq;
    let c = kapusOnb.get(key);
    if (c) return c;
    const K = P[ad], im = R[ad], s = im.width / K.w;   // resim ölçeği (kaynak → dosya)
    c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d');
    const f = document.createElement('canvas'); f.width = im.width; f.height = im.height;
    const y = f.getContext('2d'); y.scale(s, s);
    const d = K.delik, hw = 132, hh = 186, hx = d[0] + d[2] / 2 - hw / 2, hy = d[1] + d[3] / 2 - hh / 2;
    const ko = (hw * 1.5) / W('kafa');
    y.drawImage(R.kafa, hx + hw * 0.5 - W('kafa') * ko * 0.56, hy - hh * 0.16, W('kafa') * ko, H('kafa') * ko);
    const b = bq < 0 ? [1, 0.1] : [Math.cos(bq / 12 * Math.PI * 2), Math.sin(bq / 12 * Math.PI * 2)];
    for (const [e, cx, cy, o, r, bakar] of YUZ[yuz] || YUZ.normal) {
      const w = o * hw, h = H(e) * w / W(e);
      const bx = bakar ? b[0] * hw * 0.04 : 0, by = bakar ? b[1] * hh * 0.03 : 0;
      y.save(); y.translate(hx + cx * hw + bx, hy + cy * hh + by); y.rotate(r); y.drawImage(R[e], -w / 2, -h / 2, w, h); y.restore();
    }
    y.setTransform(1, 0, 0, 1, 0, 0);
    y.globalCompositeOperation = 'destination-in'; y.drawImage(R[ad + '-delik'], 0, 0, f.width, f.height);
    x.drawImage(boyali(ad, renk), 0, 0); x.drawImage(f, 0, 0);
    if (kapusOnb.size > 400) kapusOnb.clear();
    kapusOnb.set(key, c);
    return c;
  }

  // ---------------- pozlar ----------------
  const EL_DUR = ['el-yumruk-yan', 44, -54, -0.1];
  const POZ = {
    bekle(t, o) {   // bekleme; ara sıra yumuşakça "bekle 2" salınımına geçer
      const n = Math.sin(t * 2.4), sal = Math.pow(Math.max(0, Math.sin(Math.PI * 2 * (t / 14 + (o.faz || 0)))), 2);
      const s = Math.sin(t * 2.2);
      return { sy: 1 + 0.02 * n, sx: 1 - 0.012 * n, rot: 0.06 * s * sal, bas: [0, -1.5 * n, 0.06 * Math.sin(t * 2.2 - 0.6) * sal], on: [EL_DUR[0], 44, -54 - n, -0.1] };
    },
    yuru(t) {
      const f = (t / 0.9) % 1, ip = 2 * Math.PI, ADIM = 13, KALK = 10;
      const ayak = (ff, x0, y0) => {
        ff = (ff + 1) % 1;
        if (ff < 0.6) { const u = ff / 0.6, topuk = u > 0.72; return [x0 + ADIM - 2 * ADIM * u, y0 - (topuk ? 3 * (u - 0.72) / 0.28 : 0), 0, topuk ? 'bot3-topuk' : 'bot3']; }
        const u = (ff - 0.6) / 0.4, e = yumusak(u);
        return [x0 - ADIM + 2 * ADIM * e, y0 - KALK * Math.sin(Math.PI * u), -0.08 * Math.sin(Math.PI * u), u < 0.75 ? 'bot3-kalk' : 'bot3'];
      };
      const yay = 1.6 * (1 - Math.cos(2 * ip * f)), gec = k => Math.sin(ip * (f - k));
      return { gy: -yay, rot: 0.04 + 0.015 * gec(0.05), sy: 1 + 0.012 * Math.cos(2 * ip * f), egik: -0.05 * gec(0.12),
        bas: [2, -0.6 * yay, 0.03 * gec(0.2)], panco: 'panco-salinan', bacak: 'ayri',
        ayak: [ayak(f, 8, BOT_Y + 2), ayak(f + 0.5, -12, BOT_Y - 3)],
        on: [EL_DUR[0], 44 - 6 * gec(0.1), -54 - yay * 0.6, 0.12 * gec(0.15)] };
    },
    nisan(t, o) {
      const n = Math.sin(t * 2.4), a = o.aci || 0;
      return { sy: 1 + 0.015 * n, bas: [3, -n, a * 0.25], bak: [Math.cos(a), Math.sin(a)], silah: a };
    },
    hava(t, o) {   // havada: yükselirken uçuş pançosu, düşerken rüzgârlı panço; kollar açık, bacaklar toplanmış
      const k = Math.min(1, Math.max(0, o.hava ?? 0.5));
      return { panco: ['panco-ucus1', 'panco-ruzgar', yumusak((k - 0.35) / 0.3)], sy: 1.04, sx: 0.97, rot: 0.1 * (k - 0.5),
        bas: [0, 0, -0.06], bacakKare: ['bc-adim2', -10], on: [EL_DUR[0], 54, -84, -0.7] };
    },
    aci(t, o) {
      const p = o.acit ?? (t % 1.2), s = p < 0.4 ? Math.sin(p * 70) * (0.4 - p) * 10 : 0;
      return { x: s, yuz: 'aci', on: EL_DUR };
    },
    yumruk(t, o) {
      const u = o.vurus ?? 0;
      return { rot: 0.1 * u, x: 6 * u, bas: [4 * u, 0, 0.06 * u], on: ['el-yumruk-on', 44 + 64 * u, -80, 0] };
    },
    sevinc(t) {
      const h = Math.abs(Math.sin(t * 6));
      return { y: -18 * h, sy: 1 + 0.04 * h, yuz: 'mutlu', bas: [0, -2, 0.05 * Math.sin(t * 3)], on: ['el-bas', 56, -77 - 5 * h, -0.1],
        bacakKare: [['bc-genis', 'bc-adim2', yumusak((h - 0.15) / 0.3)], -10 * yumusak((h - 0.15) / 0.3)] };
    },
  };

  // ---------------- silahlar ----------------
  // nisan: nişan açısıyla döner (tut: kabza, resim kesri; kavra: kabzanın yumruktaki yeri; ileri: öne kaydırma)
  // el: ön elde (tut: kavranan nokta; boy: en uzun kenar). Kürek: ağzı nişan (kazma) yönüne bakar.
  const BAZUKA = { tip: 'nisan', r: 's-bazuka', ileri: 12, kavra: [12, -2], uzun: 150, tut: [0.455, 0.72] };
  const SILAH = {
    bazooka: BAZUKA, drill: BAZUKA, guided: BAZUKA,
    portal: { tip: 'nisan', r: 's-portal', ayna: true, ileri: 22, kavra: [12, -2], uzun: 112, tut: [0.27, 0.8] },
    shovel: { tip: 'nisan', r: 's-kurek', don: -Math.PI / 2, kazi: true, uzun: 118, tut: [0.1, 0.5] },
    grenade: { tip: 'el', r: 's-konserve', tut: [0.5, 1.0], boy: 66 },
    cluster: { tip: 'el', r: 's-kavanoz', tut: [0.5, 1.0], boy: 66 },
    sticky: { tip: 'el', r: 's-yapiskan', boy: 63 },
    dynamite: { tip: 'el', r: 's-dinamit', tut: [0.2, 0.86], don: -0.35, boy: 66 },
    remote: { tip: 'el', r: 's-telsiz', tut: [0.52, 1.02], boy: 82 },
    airstrike: { tip: 'el', r: 's-telsiz', tut: [0.52, 1.02], boy: 82 },
    goat: { tip: 'el', r: 's-deliordek', boy: 75 },
    rduck: { tip: 'el', r: 's-roketliordek', boy: 81 },
    mduck: { tip: 'el', r: 's-misketliordek', boy: 81 },
    lasso: { tip: 'el', r: 's-kement', ileri: 14, tut: [0.3, 0.1], don: 0.1 - Math.PI / 2, boy: 96 },
    revive: { tip: 'el', r: 's-aku', boy: 69 },
    tape: { tip: 'el', r: 's-bant', boy: 60 },
  };
  G.silahVar = id => !!SILAH[id];
  const elCiz = (ctx, ad, x, y, r = 0, olc = ELS) => { ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.drawImage(R[ad], -W(ad) * olc / 2, -H(ad) * olc / 2, W(ad) * olc, H(ad) * olc); ctx.restore(); };
  function silahCiz(ctx, s, a) {
    if (s.tip === 'nisan') {
      const ad = s.r, k = s.uzun / W(ad), im = s.ayna ? aynali(ad) : R[ad];
      ctx.save(); ctx.translate(4, -86); ctx.rotate(s.kazi ? a - s.don : a); ctx.translate(4 + (s.ileri || 0), 14);
      ctx.save(); ctx.rotate(s.don || 0);
      const [kx, ky] = s.kavra || [0, 0];
      ctx.drawImage(im, kx - s.tut[0] * W(ad) * k, ky - s.tut[1] * H(ad) * k, W(ad) * k, H(ad) * k);
      ctx.restore();
      elCiz(ctx, 'el-yumruk-yan', 0, 0);
      ctx.restore();
    } else {
      const k = s.boy / Math.max(W(s.r), H(s.r)), [tx, ty] = s.tut || [0.5, 0.86];
      ctx.save(); ctx.translate(42 + (s.ileri || 0), -76);
      ctx.save(); ctx.rotate(s.don || 0); ctx.drawImage(R[s.r], -tx * W(s.r) * k, -ty * H(s.r) * k, W(s.r) * k, H(s.r) * k); ctx.restore();
      elCiz(ctx, 'el-yumruk-yan', 0, 0);
      ctx.restore();
    }
  }

  // ---------------- gövde parçaları ----------------
  const pancoListe = p => Array.isArray(p.panco) ? p.panco : [p.panco || 'panco-duz', null, 0];
  function pancoCiz(ctx, p, renk) {   // boyundan asılı; geçişte iki resim birbirinin boyuna esneyerek erir
    const [a, b, k] = pancoListe(p);
    const tek = (ad, alfa, hedef, m) => {
      if (alfa <= 0) return;
      const Hd = hedef ? P[hedef] : P[ad], mm = m || 0;
      const ex = 1 + (Hd.w / W(ad) - 1) * mm, ey = 1 + (Hd.h / H(ad) - 1) * mm;
      ctx.save(); ctx.globalAlpha *= Math.min(1, alfa);
      ctx.scale(PS * ex, PS * ey); ctx.translate(-P[ad].boyun[0], -P[ad].boyun[1]);
      ctx.drawImage(boyali(ad, renk), 0, 0, W(ad), H(ad)); ctx.restore();
    };
    if (!b || k <= 0) return tek(a, 1);
    if (k >= 1) return tek(b, 1);
    if (k < 0.5) { tek(a, 1, b, k); tek(b, k * 2, a, 1 - k); } else { tek(b, 1, a, 1 - k); tek(a, (1 - k) * 2, b, k); }
  }
  function sirtYeri(p) {   // çanta/tüp yeri (panço resmi pikseli, boyna göre); geçişte ara değer
    const [a, b, k] = pancoListe(p);
    const yer = ad => [P[ad].canta[0] - P[ad].boyun[0], P[ad].canta[1] - P[ad].boyun[1]];
    let [x, y] = yer(a);
    if (b && k > 0) { const [x2, y2] = yer(b); x += (x2 - x) * k; y += (y2 - y) * k; }
    return [x, y];
  }
  function sirtCiz(ctx, p, jet) {
    const [x, y] = sirtYeri(p), o = CS / PS, cw = W('canta-yan') * o, ch = H('canta-yan') * o;
    ctx.save(); ctx.scale(PS, PS);
    if (!jet) ctx.drawImage(R['canta-yan'], x, y, cw, ch);
    else {   // tüp: sağ kenarı çantanınkiyle aynı (sırta yaslı)
      const kt = ch * 1.05 / H('s-tup'), ad = jet === 2 ? 's-tup-alev' : 's-tup';
      ctx.drawImage(R[ad], x + cw - W('s-tup') * kt * 0.9, y - 6, W(ad) * kt, H(ad) * kt);
    }
    ctx.restore();
  }
  function bacakCiz(ctx, kalca, [ax, ay, r, botAd = 'bot3'], arka) {
    const [kx, ky] = kalca, vx = ax - kx, vy = ay - ky, L = Math.hypot(vx, vy), bw = 22;
    ctx.save(); ctx.translate(kx, ky); ctx.rotate(Math.atan2(-vx, vy));
    ctx.drawImage(arka ? R['baldir-arka'] : R['baldir-a'], -bw / 2, 0, bw, L + 6); ctx.restore();
    const B = P[botAd];
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(r);
    ctx.drawImage(arka ? koyu(botAd) : R[botAd], -B.bilek[0] * BS, -B.bilek[1] * BS, B.w * BS, B.h * BS); ctx.restore();
  }
  function bacakKareCiz(ctx, [kare, dy]) {   // iki bacak + bot tek resim; bel ortası x = 0, taban yerde
    const tek = (ad, alfa) => {
      if (alfa <= 0) return;
      ctx.save(); ctx.globalAlpha *= Math.min(1, alfa);
      ctx.translate(0, dy); ctx.scale(LS, LS); ctx.translate(-P[ad].bel[0], -P[ad].alt);
      ctx.drawImage(R[ad], 0, 0, W(ad), H(ad)); ctx.restore();
    };
    const [a, b, k] = Array.isArray(kare) ? kare : [kare, null, 0];
    if (!b || k <= 0) return tek(a, 1);
    if (k >= 1) return tek(b, 1);
    if (k < 0.5) { tek(a, 1); tek(b, k * 2); } else { tek(b, 1); tek(a, (1 - k) * 2); }
  }

  // ---------------- tek resim: mermiler, ikonlar, barikat ----------------
  const EKSEN = { 's-gudumlu': -0.35 };   // ana doğrultu elle (PCA kablodan sapıyor)
  G.eksen = ad => EKSEN[ad] ?? (P[ad] && P[ad].eksen) ?? 0;
  G.var = ad => !!(G.hazir && P[ad] && R[ad]);
  // ad resmini çiz: en uzun kenarı boy; o.alt: alt kenarın ortası orijinde (yoksa merkez); o.ayna: yatay ayna;
  // o.boya: renge boyanmış kopya (kırmızı hayalet vb.). Döner: resim kesri (fx, fy) noktasının yerel konumu için fonksiyon.
  G.resim = (ctx, ad, boy, o = {}) => {
    const k = boy / Math.max(W(ad), H(ad)), w = W(ad) * k, h = H(ad) * k, x0 = -w / 2, y0 = o.alt ? -h : -h / 2;
    const im = o.boya ? boyali(ad, o.boya) : o.ayna ? aynali(ad) : R[ad];
    ctx.drawImage(im, x0, y0, w, h);
    return (fx, fy) => [x0 + (o.ayna ? 1 - fx : fx) * w, y0 + fy * h];
  };
  G.boyut = (ad, boy) => { const k = boy / Math.max(W(ad), H(ad)); return [W(ad) * k, H(ad) * k]; };
  // Silah menüsü ikonu (S × S tuval, ölçek çağıranda)
  const IKON = { bazooka: 's-bazuka', grenade: 's-konserve', punch: 's-eldiven', cluster: 's-kavanoz', goat: 's-deliordek', portal: 's-portal', shovel: 's-kurek',
    lasso: 's-kement', airstrike: 's-telsiz', jet: 's-tup', revive: 's-aku', tape: 's-bant', rduck: 's-roketliordek', mduck: 's-misketliordek',
    dynamite: 's-dinamit', barricade: 's-barikat', drill: 's-delici', guided: 's-gudumlu', sticky: 's-yapiskan', remote: 's-telsiz' };
  G.ikon = (c, id, S) => {
    const ad = IKON[id]; if (!G.var(ad)) return false;
    c.save(); c.translate(S / 2, S / 2);
    G.resim(c, ad, S * 0.92, { ayna: id === 'portal' });
    c.restore(); return true;
  };

  // ---------------- çizim ----------------
  function ciz(ctx, o) {
    if (!G.hazir && !o.olcekYerel) return false;
    const t = o.t || 0, poz = POZ[o.poz] ? o.poz : 'bekle';
    const p = POZ[poz](t, o);
    const S = o.silah ? SILAH[o.silah] : null;
    if (poz === 'nisan' && S && S.kazi) p.bak = [Math.cos(o.aci || 0), Math.sin(o.aci || 0)];   // kürek: ağız = kazma yönü, baş da oraya
    const yuz = o.yuz || p.yuz || (o.hain ? 'hain' : 'normal');
    const K = P['kapus-34'], PD = P['panco-duz'], neckY = -(PD.alt - PD.boyun[1]) * PS;
    const k = o.olcekYerel || (o.boy / G.yukseklik), yon = o.yon === -1 ? -1 : 1;
    ctx.save();
    ctx.translate(o.x || 0, o.y || 0); ctx.scale(k * yon, k);
    ctx.translate(p.x || 0, p.y || 0);
    // 1) bacaklar (pançonun arkasında)
    if (p.bacak === 'ayri') {
      const ay = p.ayak || AYAK_DUR, kalcaY = -LIFT - 34;
      bacakCiz(ctx, [-6, kalcaY], ay[1], true); bacakCiz(ctx, [6, kalcaY], ay[0], false);
    } else bacakKareCiz(ctx, p.bacakKare || ['bc-genis', 0]);
    // gövde: etek ucunun ortasından döner/esner
    ctx.translate(0, -LIFT + (p.gy || 0)); ctx.rotate(p.rot || 0); ctx.scale(p.sx || 1, p.sy || 1);
    // 2) sırt (çanta ya da tüp) + 3) panço: aynı dönüşümde (eğilme dahil)
    ctx.save(); ctx.translate(0, neckY); if (p.egik) ctx.transform(1, 0, p.egik, 1, 0, 0);
    sirtCiz(ctx, p, o.jet || 0);
    pancoCiz(ctx, p, o.renk || '#ef5350');
    ctx.restore();
    // 4) kapüşon + yüz
    const b = p.bas || [0, 0, 0], [hx, hy, hw] = K.delik;
    ctx.save(); ctx.translate(6 + b[0], neckY + 44 + b[1]); ctx.rotate(b[2]); ctx.scale(KS, KS);
    ctx.translate(-(hx + hw * 0.5), -K.h + 12);
    ctx.drawImage(kapus('kapus-34', o.renk || '#ef5350', yuz, p.bak), 0, 0, K.w, K.h);
    ctx.restore();
    // 5) silah (en önde) ya da ön el
    if (p.silah !== undefined && S) silahCiz(ctx, S, p.silah);
    else if (p.silah === undefined && p.on) {
      if (o.silah === 'punch' && p.on[0] === 'el-yumruk-on') elCiz(ctx, 's-eldiven', p.on[1], p.on[2], p.on[3], 0.13);
      else elCiz(ctx, p.on[0], p.on[1], p.on[2], p.on[3]);
    }
    ctx.restore();
    return true;
  }
})();
