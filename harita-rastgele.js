/* ==========================================================================
   HARİTA: Hurda Gezegeni — rastgele (W.M.D tarzı yığma)
   W.M.D Landscape Generator mantığı: harita su boşluklarıyla ayrılmış kara
   kütlelerinden oluşur; her kütle taban parçalarından kurulur, üstüne kat kat
   yığın parçaları oturur, kütleler arasına uçları aynı hizada köprüler kurulur,
   yamaçlardan kemer çıkıntıları uzanır, yakınlara ulaşılabilir adalar ve düz
   yüzeylere katı hurda eşyalar serpilir.

   Boyut (k/o/b): dünya genişliği ve yüksekliği, kütle sayısı, kat sayısı,
   ada ve dekor sayısı. Arazi iki yanda dünyanın içinde biter (kenarda su).

   Çarpışma maskesi harita-parcalar-veri.js'teki RLE'den kurulur; bütün hesap
   tam sayı ve tohumlu mulberry32: aynı tohum + boyut her telefonda piksel
   piksel aynı haritayı verir. Gökyüzü/paralaks/bataklık Hurda Gezegeni'nden.
   Parçaları yenilemek: gasmerler-parca-uretimi/araclar/parca_derle.py v2
   ========================================================================== */
const HARITA_RASTGELE = (() => {
  const BOYUT = {
    k: { W: 2400, H: 1100, kutle: [2, 2], kat: 1, ada: [1, 2], dekor: 10 },
    o: { W: 2900, H: 1300, kutle: [2, 3], kat: 2, ada: [2, 3], dekor: 14 },
    b: { W: 3400, H: 1500, kutle: [3, 4], kat: 3, ada: [2, 4], dekor: 18 },
  };
  const K = 1.25;                  // arazi tuvali ölçeği (parca_derle.py K ile aynı)
  const YOK = 99999;
  const KENAR = 70;                // arazi iki yanda dünyanın en az bu kadar içinde biter
  const ALT = 24, GOMUL = 60;      // taban alt kesiği su çizgisinin ALT..ALT+GOMUL px altında
  const UC = 40;                   // köprü ucu karanın üstüne bu kadar biner
  const TAVAN = 110;               // hiçbir parça bundan yukarı çıkmaz (gökyüzü payı)
  const SURUM = 5;
  let W = 2900, H = 1300, SU = 1260, ayar = BOYUT.o;

  const OLCEKLER = { zemin: [85, 100, 115], ust: [85, 100, 115], yan: [90, 110], ada: [90, 110], kiris: [90, 110, 130], dekor: [90, 110] };
  const profil = (p, satir) => {
    const ust = new Int16Array(p.w).fill(-1), alt = new Int16Array(p.w).fill(-1);
    satir.forEach((v, y) => { for (let i = 0; i < v.length; i += 2) for (let x = v[i]; x < v[i] + v[i + 1]; x++) { if (ust[x] < 0) ust[x] = y; alt[x] = y; } });
    return { ust, alt };
  };
  const PARCA = [];
  for (const d of HARITA_PARCA_VERI) {   // her parça birkaç boyda (W.M.D prefab m_Scale); ölçekleme tam sayıyla
    const taban = d.rle.split(';').map(r => r ? r.split(',').map(s => parseInt(s, 16)) : []);
    for (const s of OLCEKLER[d.tur] || [100]) {
      const w = Math.floor(d.w * s / 100), h = Math.floor(d.h * s / 100), satir = [];
      for (let y = 0; y < h; y++) {
        const v = taban[Math.floor(y * 100 / s)], o = [];
        for (let i = 0; i < v.length; i += 2) { const a = Math.floor(v[i] * s / 100), b = Math.min(w, Math.floor((v[i] + v[i + 1]) * s / 100)); if (b > a) o.push(a, b - a); }
        satir.push(o);
      }
      const p = { ad: d.ad, tur: d.tur, olcek: s, w, h, satir };
      Object.assign(p, profil(p, satir));
      p.tepe = p.ust.reduce((m, v) => v >= 0 ? Math.min(m, v) : m, 99999);
      PARCA.push(p);
    }
  }
  const ADLAR = [...new Set(PARCA.map(p => p.ad))];
  const tur = t => PARCA.filter(p => p.tur === t);
  const ZEMIN = tur('zemin'), UST = tur('ust'), YAN = tur('yan'), KIRIS = tur('kiris'), DEKOR = tur('dekor');
  const ADA = PARCA.filter(p => p.tur === 'ada' || /levha|raf/.test(p.ad));   // yassı yığınlar yüzen ada olarak da kullanılır

  const img = {};
  let yukleniyor = null, hazir = false, plan = [], ekler = [];

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

  // Boyut seçimi: 'k' | 'o' | 'b' (bilinmeyen → orta). Dünyayı ayarlar; oyun W/H/su çizgisini buradan alır
  function ayarla(kod) {
    ayar = BOYUT[kod] || BOYUT.o; W = ayar.W; H = ayar.H; SU = H - 40;
    return { W, H, SU };
  }

  function rastgele(a) {   // mulberry32 (oyunun rng'sinden ayrı)
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  // Yerleşmiş parça o = { p, x, y, ayna }: dünya sütununda üst/alt yüzey (yoksa YOK / -1)
  const sutun = (o, wx) => { const c = wx - o.x; if (c < 0 || c >= o.p.w) return -1; return o.ayna ? o.p.w - 1 - c : c; };
  const ustW = (o, wx) => { const c = sutun(o, wx); return c < 0 || o.p.ust[c] < 0 ? YOK : o.y + o.p.ust[c]; };
  const altW = (o, wx) => { const c = sutun(o, wx); return c < 0 || o.p.alt[c] < 0 ? -1 : o.y + o.p.alt[c]; };
  const tamSol = o => { for (let wx = o.x; wx < o.x + o.p.w; wx++) if (ustW(o, wx) < YOK) return wx; return o.x; };
  const tamSag = o => { for (let wx = o.x + o.p.w - 1; wx >= o.x; wx--) if (ustW(o, wx) < YOK) return wx; return o.x; };

  function yaz(solid, o) {
    const p = o.p;
    for (let y = 0; y < p.h; y++) {
      const wy = o.y + y; if (wy < 0 || wy >= H) continue;
      const v = p.satir[y];
      for (let i = 0; i < v.length; i += 2) {
        let x0 = (o.ayna ? p.w - v[i] - v[i + 1] : v[i]) + o.x, x1 = x0 + v[i + 1];
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

  function kur(solid, tohum) {
    const r = rastgele((tohum >>> 0) ^ 0x5bd1e995), sec = a => a[Math.floor(r() * a.length)];
    const ara = (a, b) => a + Math.floor(r() * (b - a + 1));
    const karistir = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    solid.fill(0); plan = []; ekler = [];
    // T: her sütunun en üst katı satırı (yüzey); yerleştirdikçe güncellenir
    const T = new Int32Array(W).fill(YOK);
    const tazele = (x0, x1) => { for (let wx = Math.max(0, x0); wx < Math.min(W, x1); wx++) { let y = 0; while (y < H && !solid[y * W + wx]) y++; T[wx] = y < H ? y : YOK; } };
    const koy = o => { plan.push(o); yaz(solid, o); tazele(o.x, o.x + o.p.w); };
    const Tz = wx => wx < 0 || wx >= W ? YOK : T[wx];

    // ---- 1. Kara kütleleri: su boşluklarıyla ayrılmış aralıklar
    const n = ara(ayar.kutle[0], ayar.kutle[1]);
    const bosluklar = Array.from({ length: n - 1 }, () => ara(170, 330));
    const kullan = W - 2 * KENAR - bosluklar.reduce((a, b) => a + b, 0);
    const agir = Array.from({ length: n }, () => 75 + Math.floor(r() * 51)), topA = agir.reduce((a, b) => a + b, 0);
    const kutleler = [];
    let x0 = KENAR;
    for (let i = 0; i < n; i++) {
      const gen = Math.floor(kullan * agir[i] / topA);
      kutleler.push({ L: x0, R: x0 + gen - 1, parca: [] });
      x0 += gen + (bosluklar[i] || 0);
    }
    // Taban parçalarını kütlenin içinde yan yana bindirerek diz, sonra kütleyi aralığının ortasına kaydır
    for (const k of kutleler) {
      const ilkL = k.L, ilkR = k.R;
      let son = null;
      for (let dene = 0; dene < 8; dene++) {
        const sag = son ? tamSag(son) : k.L - 1;
        if (k.R - sag < 150) break;
        const aday = [];
        for (const q of ZEMIN) {
          if (son && q.ad === son.p.ad) continue;
          const ayna = r() < 0.5, g = Math.floor(r() * GOMUL), o = { p: q, x: 0, y: SU + ALT + g - q.h, ayna };
          const sol0 = tamSol(o), sag0 = tamSag(o);   // x = 0'dayken
          const ov = son ? Math.floor(Math.min(q.w, son.p.w) * (25 + Math.floor(r() * 21)) / 100) : 0;
          o.x = son ? sag + 1 - ov - sol0 : k.L - sol0;
          if (o.x + sag0 <= k.R) aday.push(o);
        }
        if (!aday.length) break;
        son = sec(aday); k.parca.push(son);
      }
      if (!k.parca.length) {   // aralık en küçük tabandan dar: en küçüğünü ortaya koy
        const q = ZEMIN.reduce((a, b) => a.w < b.w ? a : b), o = { p: q, x: 0, y: SU + ALT - q.h, ayna: r() < 0.5 };
        o.x = Math.floor((ilkL + ilkR) / 2 - q.w / 2); k.parca.push(o);
      }
      const sol = Math.min(...k.parca.map(tamSol)), sag = Math.max(...k.parca.map(tamSag));
      const dx = Math.floor((ilkL + ilkR) / 2 - (sol + sag) / 2);
      for (const o of k.parca) { o.x += dx; koy(o); }
      k.L = sol + dx; k.R = sag + dx;
    }

    // ---- 2. Kat kat yığma: üst parçalar yüzeye oturur (alt profili yüzeye değer, biraz gömülür)
    const ustler = [];
    function yigKoy(k, kat) {
      const q = sec(UST), ayna = r() < 0.5, aday = [];
      const m0 = Math.floor(q.w * 0.2), m1 = q.w - m0, gom = Math.floor(q.h * 0.22);
      for (let x = k.L - 20; x + q.w <= k.R + 20; x += 8) {
        if (x < KENAR || x + q.w > W - KENAR) continue;
        let dokun = YOK;   // parçanın alt profili yüzeye ilk değdiği yükseklik
        for (let c = 0; c < q.w; c++) { const a = q.alt[ayna ? q.w - 1 - c : c], t = Tz(x + c); if (a >= 0 && t < YOK) dokun = Math.min(dokun, t - a); }
        if (dokun === YOK) continue;
        const y = dokun + gom;
        if (y + q.tepe < TAVAN) continue;
        let ok = true;   // orta %60'ı yüzeyle desteklensin (boşluğa sarkmasın)
        for (let c = m0; c < m1 && ok; c += 3) { const a = q.alt[ayna ? q.w - 1 - c : c], t = Tz(x + c); if (a >= 0 && (t === YOK || t - (y + a) > 40)) ok = false; }
        if (!ok) continue;
        if (ustler.some(u => u.kat === kat && Math.abs(u.o.x + u.o.p.w / 2 - x - q.w / 2) < (u.o.p.w + q.w) * 0.35)) continue;
        aday.push({ io: { p: q, x, y, ayna }, puan: -y + Math.floor(r() * 160) });   // yukarıdakini biraz yeğle: kütle yükselir
      }
      if (!aday.length) return false;
      aday.sort((a, b) => b.puan - a.puan);
      const s = aday[Math.floor(r() * Math.min(3, aday.length))].io;
      koy(s); ustler.push({ o: s, kat });
      return true;
    }
    for (let kat = 1; kat <= ayar.kat; kat++) for (const k of kutleler) {
      const adet = 1 + Math.floor(r() * 2) + ((k.R - k.L) > 900 ? 1 : 0) - (kat > 1 && r() < 0.35 ? 1 : 0);
      for (let i = 0; i < adet; i++) yigKoy(k, kat);
    }

    // ---- 3. Köprüler: sol kütlenin kenar çıkıntısından karşı kütleye. Karşı uç yüzeye aynı hizada oturur;
    //      oralarda o yükseklikte yüzey yoksa ucun altına, üstü köprü hizasına gelecek şekilde gömülü bir yığın ayağı konur
    const duz = (wx, yon) => { const t = Tz(wx); return t < SU - 80 && Math.abs(Tz(wx - 10) - t) <= 9 && Math.abs(Tz(wx + 10) - t) <= 9 && Tz(wx + yon * 40) > t + 6; };   // plastik tüyleri yüzünden ±9 px düz sayılır
    function ayakBul(xr, ya) {   // xr sütununda üstü ya±6 olan, yüzeye gömülü bir üst parça
      const aday = [];
      for (const q of UST) for (const ayna of [false, true]) {
        const m0 = Math.floor(q.w * 0.2), m1 = q.w - m0;
        for (let x = xr - Math.floor(q.w * 0.75); x <= xr - Math.floor(q.w * 0.25); x += 6) {
          if (x < KENAR || x + q.w > W - KENAR) continue;
          const cu = q.ust[ayna ? q.w - 1 - (xr - x) : xr - x]; if (cu < 0) continue;
          const y = ya - cu;
          let dokun = YOK;
          for (let c = 0; c < q.w; c++) { const a = q.alt[ayna ? q.w - 1 - c : c], t = Tz(x + c); if (a >= 0 && t < YOK) dokun = Math.min(dokun, t - a); }
          if (dokun === YOK || y < dokun + Math.floor(q.h * 0.1) || y > dokun + Math.floor(q.h * 0.6)) continue;
          let ok = true;
          for (let c = m0; c < m1 && ok; c += 3) { const a = q.alt[ayna ? q.w - 1 - c : c], t = Tz(x + c); if (a >= 0 && (t === YOK || t - (y + a) > 40)) ok = false; }
          if (ok) aday.push({ p: q, x, y, ayna });
        }
      }
      return aday.length ? sec(aday) : null;
    }
    for (let i = 0; i + 1 < kutleler.length; i++) {
      if (r() > 0.85) continue;
      const a = kutleler[i], b = kutleler[i + 1], capalar = [];
      for (let xl = a.R - 340; xl <= a.R - 10; xl += 3) if (duz(xl, 1)) capalar.push(xl);
      let kuruldu = false;
      for (const xl of karistir(capalar).slice(0, 30)) {
        if (kuruldu) break;
        const ya = Tz(xl);
        for (const q of karistir(KIRIS)) {
          const xr = xl + q.w - 2 * UC;
          if (xr < b.L + 20 || xr > b.R - 40) continue;
          const bo = { p: q, x: xl - UC, y: 0, ayna: r() < 0.5 };
          const ub = ustW(bo, xl); bo.y = ya - (ub === YOK ? 0 : ub) + 3;
          if (bo.y + q.h > SU - 40 || bo.y < TAVAN) continue;
          let temiz = true;   // köprünün altı uçlar dışında araziye değmesin
          for (let wx = xl + 24; wx <= xr - 60 && temiz; wx += 2) if (Tz(wx) < altW(bo, wx) - 10) temiz = false;
          if (!temiz) continue;
          const yr = Tz(xr);
          if (yr < ya - 12) continue;   // karşı yüzey köprüden yüksek
          let ayak = null;
          if (yr > ya + 12) { ayak = ayakBul(xr, ya); if (!ayak) continue; }
          if (ayak) koy(ayak);
          koy(bo);
          ekler.push({ tur: 'kopru', x: xl, y: ya }, { tur: 'kopru', x: xr, y: ya });
          kuruldu = true; break;
        }
      }
    }

    // ---- 4. Yamaç kemerleri: çizimde ayak sağda; sol yamaçta olduğu gibi, sağ yamaçta aynalı
    for (const k of kutleler) {
      if (r() > 0.6) continue;
      const q = sec(YAN), aday = [], gom = Math.floor(q.w * 0.3);
      for (const sag of [false, true]) for (let yt = TAVAN + 40; yt + q.h <= SU - 120; yt += 8) {
        let duvar = null;   // bu satırda kütlenin en dış katı sütunu
        const sy = (yt + 20) * W;
        if (sag) { for (let wx = Math.min(W - 1, k.R + 40); wx >= k.L; wx--) if (solid[sy + wx]) { duvar = wx; break; } }
        else for (let wx = Math.max(0, k.L - 40); wx <= k.R; wx++) if (solid[sy + wx]) { duvar = wx; break; }
        if (duvar === null) continue;
        const x = sag ? duvar - gom + 1 : duvar - q.w + gom;
        if (x < KENAR || x + q.w > W - KENAR) continue;
        const dis0 = sag ? x + gom : x, dis1 = sag ? x + q.w : x + q.w - gom;
        // dışarı uzanan kısmın üstü boş, altında asker sığacak boşluk olsun
        if (bosMu(solid, dis0, yt - 50, dis1, yt + q.h + 50)) aday.push({ p: q, x, y: yt, ayna: sag });
      }
      if (aday.length) koy(sec(aday));
    }

    // ---- 5. Yüzen adalar: kütleler arası suyun üstünde ya da tepelerin yanında, karadan ulaşılabilir
    const adaSigar = (o, pay) => o.x >= KENAR && o.x + o.p.w <= W - KENAR && o.y >= TAVAN && o.y + o.p.h <= SU - 60 && bosMu(solid, o.x - pay, o.y - 80, o.x + o.p.w + pay, o.y + o.p.h + 50);
    const adaHedef = ara(ayar.ada[0], ayar.ada[1]);
    const hedefler = [];
    for (let i = 0; i + 1 < kutleler.length; i++) {   // su boşluğunun üstü (iki kıyının yüksekliğinde)
      const y = Math.min(Tz(kutleler[i].R - 60), Tz(kutleler[i + 1].L + 60));
      if (y < YOK) hedefler.push({ x: Math.floor((kutleler[i].R + kutleler[i + 1].L) / 2), y: y + 60, su: true });
    }
    for (let wx = KENAR; wx < W - KENAR; wx += 12) { const t = Tz(wx); if (t < SU - 200 && t <= Tz(wx - 60) && t <= Tz(wx + 60)) hedefler.push({ x: wx, y: t }); }
    let adaSay = 0;
    for (const tp of karistir(hedefler)) {
      if (adaSay >= adaHedef) break;
      const q = sec(ADA), aday = [];
      for (let d = tp.su ? 0 : 140; d <= (tp.su ? 60 : 300); d += 10) for (const yon of [-1, 1]) for (let dy = 50; dy <= 190; dy += 10) {
        const ix = tp.su ? tp.x - (q.w >> 1) + yon * d : yon > 0 ? tp.x + d : tp.x - d - q.w;
        const io = { p: q, x: ix, y: tp.y - dy, ayna: r() < 0.5 };
        if (adaSigar(io, 45)) aday.push(io);
      }
      if (aday.length) { koy(sec(aday)); adaSay++; }
    }

    // ---- 6. Dekor: düz yüzeylere katı hurda eşyalar (birbirinden ve köprü uçlarından uzak)
    const konan = [], dekorlar = karistir(DEKOR);
    for (let i = 0, dene = 0; konan.length < ayar.dekor && dene < ayar.dekor * 150; dene++) {
      const q = dekorlar[(i + dene) % dekorlar.length], ayna = r() < 0.5;
      const x = KENAR + Math.floor(r() * (W - 2 * KENAR - q.w));
      let en = YOK, eb = 0;
      for (let c = 0; c < q.w; c++) { const t = Tz(x + c); en = Math.min(en, t); eb = Math.max(eb, t); }
      if (eb >= YOK || eb - en > 9 || eb > SU - 30 || en - q.h < TAVAN) continue;
      if (konan.some(k => Math.abs(k.x - x) < 70 && Math.abs(k.y - en) < 120) || ekler.some(e => Math.abs(e.x - x - (q.w >> 1)) < 70)) continue;
      const io = { p: q, x, y: 0, ayna };
      let y0 = YOK;
      for (let c = 0; c < q.w; c++) { const a = q.alt[ayna ? q.w - 1 - c : c]; if (a >= 0) y0 = Math.min(y0, Tz(x + c) - a); }
      io.y = y0 + 3;
      koy(io); konan.push(io); i++;
    }
    return plan;
  }

  // ---- Çizim: parçalar plan sırasıyla (taban → yığın → köprü → kemer → ada → dekor)
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

  return {
    ad: 'Hurda Gezegeni (rastgele)', BOYUT,
    get W() { return W; }, get H() { return H; }, get SU() { return SU; },
    get hazir() { return hazir; }, get plan() { return plan; }, get ekler() { return ekler; },
    yukle, ayarla, kur, arazi,
  };
})();
