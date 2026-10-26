/**
 * =====================================================================
 *  วาด E-BIB และ IG Story (3 หน้า) ด้วย Canvas 2D ตรง ๆ  (v20.6)
 *  ไม่ใช้ html2canvas → ไม่ค้างบน iPhone และตัวอักษรอยู่ตำแหน่งเดียวกันทุกเครื่อง
 *  หมายเหตุ iOS Safari: การตั้ง g.font จะรีเซ็ต textAlign → ตั้งซ้ำก่อน fillText ทุกครั้ง (ฟังก์ชัน T)
 * =====================================================================
 */
(function () {
  const CFG = window.APP_CONFIG;
  const U = window.U;
  const FF = 'Kanit, "Noto Sans Thai", sans-serif';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const loadImg = (src, ms) => Promise.race([
    new Promise((res) => { const i = new Image(); i.onload = () => res(i.naturalWidth ? i : null); i.onerror = () => res(null); i.src = src; }),
    sleep(ms || 8000).then(() => null),
  ]);

  async function fonts() {
    if (!document.fonts || !document.fonts.load) return;
    const list = ['italic 800 100px Kanit', '700 40px Kanit', '600 40px Kanit', '500 30px Kanit', '400 30px Kanit'];
    await Promise.race([Promise.all(list.map((f) => document.fonts.load(f, 'ก0Aa').catch(() => {}))), sleep(3000)]);
  }

  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  /** วาดข้อความ: align/baseline ตั้งทุกครั้งหลังตั้ง font */
  function T(g, text, x, y, o) {
    const s = String(text == null ? '' : text);
    let size = o.size;
    const mkFont = (z) => (o.style || '') + ' ' + (o.weight || 400) + ' ' + z + 'px ' + FF;
    g.font = mkFont(size);
    if (o.max) while (g.measureText(s).width > o.max && size > 12) { size -= 2; g.font = mkFont(size); }
    // iOS Safari: ข้อความที่มีภาษาไทยบางครั้งไม่ทำตาม textAlign (center/right) → วาดชิดซ้ายเสมอ แล้วคำนวณตำแหน่ง x เอง
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    const w = g.measureText(s).width, al = o.align || 'left';
    const px = al === 'center' ? x - w / 2 : al === 'right' ? x - w : x;
    g.fillStyle = o.color || '#fff';
    g.fillText(s, px, y);
    return size;
  }
  /** ข้อความเว้นตัวอักษร (letter-spacing) กึ่งกลาง */
  function spaced(g, text, cx, y, o) {
    const gap = o.gap || 0;
    g.font = (o.weight || 400) + ' ' + o.size + 'px ' + FF;
    const ws = Array.from(text).map((ch) => g.measureText(ch).width);
    const total = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1);
    let x = cx - total / 2;
    g.fillStyle = o.color; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    Array.from(text).forEach((ch, i) => { g.fillText(ch, x, y); x += ws[i] + gap; });
  }
  /** ตัดบรรทัดตามความกว้าง (รองรับภาษาไทยที่ไม่มีเว้นวรรค) */
  function wrap(g, text, max, maxLines) {
    const out = []; let cur = '';
    for (const ch of Array.from(String(text))) {
      if (g.measureText(cur + ch).width > max && cur) { out.push(cur); cur = ch; if (out.length === maxLines) return out; }
      else cur += ch;
    }
    if (cur) out.push(cur);
    return out.slice(0, maxLines);
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function cover(g, im, x, y, w, h) {
    if (!im) return;
    const k = Math.max(w / im.naturalWidth, h / im.naturalHeight), sw = w / k, sh = h / k;
    g.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
  }
  function contain(g, im, x, y, w, h) {
    if (!im) return;
    const k = Math.min(w / im.naturalWidth, h / im.naturalHeight), dw = im.naturalWidth * k, dh = im.naturalHeight * k;
    g.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  const toBlob = (c) => new Promise((res) => {
    let done = false;
    const fin = (b) => { if (!done) { done = true; res(b); } };
    try { c.toBlob(fin, 'image/png'); } catch (e) { fin(null); }
    setTimeout(() => {
      if (done) return;
      try { const d = c.toDataURL('image/png').split(',')[1], bin = atob(d), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); fin(new Blob([a], { type: 'image/png' })); } catch (e) { fin(null); }
    }, 8000);
  });

  /* ============================== E-BIB ============================== */
  /** d = { dist, bib, name, nick, status:'CONFIRMED'|'CHECKED IN'|'PENDING', bandana, food, drink, start, qr:canvas|null } */
  async function ebib(runner, d) {
    await fonts();
    const [logo, spons, av] = await Promise.all([
      loadImg('img/logo-white.png'), loadImg('img/sponsors-grid-dark.webp'), U.avatarCanvas(runner, 112, 3, 2),
    ]);
    const S = 2, W = 420, H = 730;
    const c = mk(W * S, H * S), g = c.getContext('2d');
    g.scale(S, S);
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);

    // หัวการ์ดดำ + โลโก้ + ระยะ
    g.fillStyle = '#0A0A0A'; g.fillRect(0, 0, W, 64);
    if (logo) g.drawImage(logo, 22, 14, 36 * logo.naturalWidth / logo.naturalHeight, 36);
    g.font = 'italic 800 22px ' + FF;
    const dw = g.measureText(d.dist).width + 24;
    g.fillStyle = '#FFFFFF'; rr(g, W - 22 - dw, 16, dw, 32, 8); g.fill();
    T(g, d.dist, W - 22 - dw / 2, 40, { size: 22, weight: 800, style: 'italic', color: '#0A0A0A', align: 'center' });
    // แถบลายเฉียง
    g.save(); g.beginPath(); g.rect(0, 64, W, 12); g.clip();
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 64, W, 12);
    g.fillStyle = '#1B3B67';
    for (let x = -20; x < W + 20; x += 18) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 10, 64); g.lineTo(x + 2, 76); g.lineTo(x - 8, 76); g.closePath(); g.fill(); }
    g.restore();

    // ป้ายสถานะ
    const pill = { 'CHECKED IN': ['#1B3B67', '#FFFFFF'], CONFIRMED: ['#8CD43E', '#0A1430'], PENDING: ['#F5B700', '#0A0A0A'] }[d.status] || ['#8CD43E', '#0A1430'];
    g.font = '700 13px ' + FF;
    const pw = g.measureText(d.status).width + 36;
    g.fillStyle = pill[0]; rr(g, (W - pw) / 2, 92, pw, 26, 13); g.fill();
    T(g, d.status, W / 2, 110, { size: 13, weight: 700, color: pill[1], align: 'center' });

    // เลข BIB
    T(g, d.bib, W / 2, 205, { size: 100, weight: 800, style: 'italic', color: '#0A0A0A', align: 'center', max: 360 });

    // รูปโปรไฟล์
    g.drawImage(av, (W - 112) / 2, 222, 112, 112);
    // ชื่อ
    T(g, d.name, W / 2, 366, { size: 22, weight: 700, color: '#0A0A0A', align: 'center', max: 360 });
    if (d.nick) T(g, d.nick, W / 2, 390, { size: 15, weight: 400, color: '#5E6573', align: 'center', max: 360 });

    // เส้นประคั่น
    g.strokeStyle = '#C9CFD9'; g.lineWidth = 1.5; g.setLineDash([6, 5]);
    g.beginPath(); g.moveTo(24, 412); g.lineTo(W - 24, 412); g.stroke(); g.setLineDash([]);

    // QR + รายละเอียด
    const qx = 24, qy = 432, qs = 124;
    g.fillStyle = '#FFFFFF'; rr(g, qx - 4, qy - 4, qs + 8, qs + 8, 10); g.fill();
    g.strokeStyle = '#E3E7EE'; g.lineWidth = 1; g.stroke();
    if (d.qr && d.qr.width) g.drawImage(d.qr, qx, qy, qs, qs);
    else {
      g.fillStyle = '#F1F3F7'; g.fillRect(qx, qy, qs, qs);
      T(g, 'QR ใช้ได้หลัง', qx + qs / 2, qy + 60, { size: 13, weight: 500, color: '#5E6573', align: 'center' });
      T(g, 'ชำระเงินแล้ว', qx + qs / 2, qy + 80, { size: 13, weight: 500, color: '#5E6573', align: 'center' });
    }
    const rows = [['ผ้าโพกหัว', d.bandana], ['แพ้อาหาร', d.food], ['เครื่องดื่ม', d.drink], ['ปล่อยตัว', d.start]];
    const ix = 176, ir = W - 24;
    rows.forEach((r, i) => {
      const y = 452 + i * 34;
      T(g, r[0], ix, y, { size: 13, weight: 400, color: '#5E6573', align: 'left' });
      T(g, r[1] || '-', ir, y, { size: 14, weight: 700, color: '#0A0A0A', align: 'right', max: ir - ix - 70 });
      g.strokeStyle = '#E3E7EE'; g.lineWidth = 1; g.beginPath(); g.moveTo(ix, y + 10); g.lineTo(ir, y + 10); g.stroke();
    });

    // บาร์โค้ด
    try {
      const bc = mk(10, 10);
      JsBarcode(bc, d.bib, { format: 'CODE128', displayValue: false, height: 44, margin: 0, width: 2, background: '#FFFFFF', lineColor: '#0A0A0A' });
      const bw = Math.min(bc.width, W - 48), bh = 44;
      g.drawImage(bc, (W - bw) / 2, 586, bw, bh);
    } catch (e) { console.warn('barcode', e); }

    // ผู้สนับสนุน
    spaced(g, 'SUPPORTED BY', W / 2, 660, { size: 9, weight: 700, color: '#7A8394', gap: 3 });
    if (spons) { const w = 330, h = w * spons.naturalHeight / spons.naturalWidth; g.drawImage(spons, (W - w) / 2, 670, w, Math.min(h, 52)); }
    return toBlob(c);
  }

  /* ============================== STORY ============================== */
  const SW = 1080, SH = 1920;
  const BG = { 1: 'img/story-bg-1.webp', 2: 'img/story-bg-3.webp', 3: 'img/story-bg-2.webp' };
  const SHADE = { 1: .12, 2: .12, 3: .10 };
  /** ชุดสี 3 สไตล์: dark = พื้นหลังรูปกรมท่า · light = พื้นสว่างฟ้าอ่อน · minimal = ดำล้วน + เขียวมะนาว */
  const PAL = {
    dark:    { fg: '#FFFFFF', sub: '#C6D5EC', acc: '#8FB4E8', logo: 'img/logo-white.png', spons: 'img/sponsors-grid-white.webp', cardBg: '#FFFFFF', cardFg: '#0A0A0A', cardSub: '#45454f', head: '#0A0A0A', badgeBg: '#FFFFFF', badgeFg: '#0A0A0A', stripe: '#1B3B67', stripeBg: '#FFFFFF', box: 'rgba(255,255,255,.05)', boxLine: 'rgba(255,255,255,.16)', route: '#FFFFFF', ghost: 'rgba(255,255,255,.38)', dot: '#0F2244', cta: '#FFFFFF', ctaFg: '#0A1430', ctaSub: '#5E6573', ctaUrl: '#1B3B67' },
    light:   { fg: '#0A1430', sub: '#4A5A78', acc: '#1B3B67', logo: 'img/logo.png', spons: 'img/sponsors-grid-dark.webp', cardBg: '#0A1430', cardFg: '#FFFFFF', cardSub: '#C6D5EC', head: '#1B3B67', badgeBg: '#8CD43E', badgeFg: '#0A1430', stripe: '#8CD43E', stripeBg: '#0A1430', box: 'rgba(27,59,103,.06)', boxLine: 'rgba(27,59,103,.18)', route: '#1B3B67', ghost: 'rgba(27,59,103,.30)', dot: '#FFFFFF', cta: '#0A1430', ctaFg: '#FFFFFF', ctaSub: '#C6D5EC', ctaUrl: '#8CD43E' },
    minimal: { fg: '#FFFFFF', sub: '#9AA3B5', acc: '#8CD43E', logo: 'img/logo-white.png', spons: 'img/sponsors-grid-white.webp', cardBg: '#FFFFFF', cardFg: '#0A0A0A', cardSub: '#45454f', head: '#0A0A0A', badgeBg: '#8CD43E', badgeFg: '#0A0A0A', stripe: '#8CD43E', stripeBg: '#FFFFFF', box: 'rgba(255,255,255,.05)', boxLine: 'rgba(255,255,255,.18)', route: '#8CD43E', ghost: 'rgba(255,255,255,.28)', dot: '#0A0A0A', cta: '#8CD43E', ctaFg: '#0A0A0A', ctaSub: '#2B3A12', ctaUrl: '#0A0A0A' },
  };

  function base(g, n, ctx, p, style) {
    if (style === 'dark') {
      g.fillStyle = '#0F2244'; g.fillRect(0, 0, SW, SH);
      cover(g, ctx.bg[n], 0, 0, SW, SH);
      const lg = g.createLinearGradient(0, 0, 0, SH), s = ctx.shade != null ? ctx.shade : SHADE[n];
      lg.addColorStop(0, 'rgba(7,15,40,' + (s + .18) + ')'); lg.addColorStop(.4, 'rgba(7,15,40,' + s + ')'); lg.addColorStop(1, 'rgba(7,15,40,' + (s + .3) + ')');
      g.fillStyle = lg; g.fillRect(0, 0, SW, SH);
    } else if (style === 'light') {
      const lg = g.createLinearGradient(0, 0, 0, SH); lg.addColorStop(0, '#F4F8FE'); lg.addColorStop(1, '#D3E1F3');
      g.fillStyle = lg; g.fillRect(0, 0, SW, SH);
      let rg = g.createRadialGradient(SW, 0, 0, SW, 0, 900); rg.addColorStop(0, 'rgba(61,107,176,.35)'); rg.addColorStop(1, 'rgba(61,107,176,0)');
      g.fillStyle = rg; g.fillRect(0, 0, SW, SH);
      rg = g.createRadialGradient(0, SH, 0, 0, SH, 900); rg.addColorStop(0, 'rgba(140,212,62,.30)'); rg.addColorStop(1, 'rgba(140,212,62,0)');
      g.fillStyle = rg; g.fillRect(0, 0, SW, SH);
    } else {
      g.fillStyle = '#0A0A0A'; g.fillRect(0, 0, SW, SH);
      if (ctx.bgMin) {
        cover(g, ctx.bgMin, 0, 0, SW, SH);
        const mg = g.createLinearGradient(0, 0, 0, SH); mg.addColorStop(0, 'rgba(0,0,0,.25)'); mg.addColorStop(.5, 'rgba(0,0,0,.30)'); mg.addColorStop(1, 'rgba(0,0,0,.55)');
        g.fillStyle = mg; g.fillRect(0, 0, SW, SH);
      }
    }
    if (ctx.logo) g.drawImage(ctx.logo, 80, 100, 400, 400 * ctx.logo.naturalHeight / ctx.logo.naturalWidth);
    T(g, CFG.EVENT.dateLabel, SW - 80, 154, { size: 40, weight: 800, style: 'italic', color: p.fg, align: 'right', max: 460 });
    T(g, CFG.EVENT.location, SW - 80, 200, { size: 26, weight: 400, color: p.sub, align: 'right', max: 460 });
  }
  function title(g, l1, l2, p) {
    T(g, l1.toUpperCase(), 70, 500, { size: 200, weight: 800, style: 'italic', color: p.fg, max: 940 });
    T(g, l2.toUpperCase(), 70, 672, { size: 200, weight: 800, style: 'italic', color: p.acc, max: 940 });
  }
  function foot(g, n, ctx, p) {
    spaced(g, 'SUPPORTED BY', SW / 2, 1618, { size: 20, weight: 700, color: p.sub, gap: 6 });
    if (ctx.spons) { const w = 760, h = w * ctx.spons.naturalHeight / ctx.spons.naturalWidth; g.drawImage(ctx.spons, (SW - w) / 2, 1796 - h, w, h); }
    T(g, CFG.EVENT.instagram, 80, 1848, { size: 32, weight: 800, style: 'italic', color: p.fg, align: 'left', max: 380 });
    T(g, CFG.EVENT.hashtag, SW - 80, 1848, { size: 32, weight: 800, style: 'italic', color: p.acc, align: 'right', max: 380 });
  }

  /** การ์ด BIB (ใช้ทั้งหน้า 1 และสติกเกอร์) — วาดที่ (bx,by) ขนาด bw×bh */
  function bibCard(g, ctx, p, runner, bx, by, bw, bh, numSize) {
    const nick = runner.nickname || runner.firstName || '';
    g.save(); rr(g, bx, by, bw, bh, 34); g.clip();
    g.fillStyle = p.cardBg; g.fillRect(bx, by, bw, bh);
    g.fillStyle = p.head; g.fillRect(bx, by, bw, 84);
    if (ctx.logoW) g.drawImage(ctx.logoW, bx + 36, by + 16, 52 * ctx.logoW.naturalWidth / ctx.logoW.naturalHeight, 52);
    g.font = 'italic 800 40px ' + FF; const dw = g.measureText(CFG.EVENT.distanceKm + 'K').width + 40;
    g.fillStyle = p.badgeBg; rr(g, bx + bw - 36 - dw, by + 16, dw, 52, 10); g.fill();
    T(g, CFG.EVENT.distanceKm + 'K', bx + bw - 36 - dw / 2, by + 56, { size: 40, weight: 800, style: 'italic', color: p.badgeFg, align: 'center' });
    g.fillStyle = p.stripeBg; g.fillRect(bx, by + 84, bw, 14);
    g.fillStyle = p.stripe;
    for (let x = bx - 30; x < bx + bw + 30; x += 26) { g.beginPath(); g.moveTo(x, by + 84); g.lineTo(x + 16, by + 84); g.lineTo(x + 6, by + 98); g.lineTo(x - 10, by + 98); g.closePath(); g.fill(); }
    T(g, runner.bib, bx + bw / 2, by + 98 + (bh - 98 - 56) / 2 + (numSize || 200) * 0.37, { size: numSize || 200, weight: 800, style: 'italic', color: p.cardFg, align: 'center', max: bw - 140 });
    T(g, nick, bx + 40, by + bh - 28, { size: 28, weight: 500, color: p.cardSub, align: 'left', max: bw / 2 - 60 });
    T(g, CFG.EVENT.dateLabel, bx + bw - 40, by + bh - 28, { size: 28, weight: 500, color: p.cardSub, align: 'right', max: bw / 2 - 60 });
    g.restore();
  }

  function slide1(runner, ctx, p, style) {
    const c = mk(SW, SH), g = c.getContext('2d');
    base(g, 1, ctx, p, style);
    const nick = runner.nickname || runner.firstName || '';
    title(g, "I'm", 'running', p);
    g.drawImage(ctx.av, 80, 700, 132, 132);
    T(g, nick, 242, 756, { size: 52, weight: 700, color: p.fg, max: 700 });
    T(g, (runner.firstName + ' ' + runner.lastName).trim(), 242, 800, { size: 30, weight: 400, color: p.sub, max: 700 });

    g.fillStyle = p.box; rr(g, 80, 850, 920, 310, 28); g.fill();
    g.strokeStyle = p.boxLine; g.lineWidth = 2; g.stroke();
    const k = 270 / 100, ox = 100 + (460 - 270) / 2, oy = 870;
    const P = (q) => [ox + q[0] * k, oy + q[1] * k];
    g.lineJoin = 'round'; g.lineCap = 'round';
    (CFG.ROUTE.ghost || []).forEach((line) => {
      g.beginPath(); line.forEach((q, i) => { const z = P(q); i ? g.lineTo(z[0], z[1]) : g.moveTo(z[0], z[1]); });
      g.strokeStyle = p.ghost; g.lineWidth = 0.55 * k; g.stroke();
    });
    g.beginPath(); CFG.ROUTE.points.forEach((q, i) => { const z = P(q); i ? g.lineTo(z[0], z[1]) : g.moveTo(z[0], z[1]); });
    g.strokeStyle = p.route; g.lineWidth = 2.8 * k; g.stroke();
    const s0 = P(CFG.ROUTE.points[0]);
    g.fillStyle = p.dot; g.beginPath(); g.arc(s0[0], s0[1], 3.7 * k, 0, 7); g.fill(); g.strokeStyle = p.route; g.lineWidth = 0.9 * k; g.stroke();
    g.fillStyle = p.route; g.beginPath(); g.arc(s0[0], s0[1], 1.9 * k, 0, 7); g.fill();
    g.font = 'italic 800 52px ' + FF; const kmW = g.measureText('KM').width;
    T(g, 'KM', 960, 970, { size: 52, weight: 800, style: 'italic', color: p.acc, align: 'right' });
    T(g, CFG.EVENT.distanceKm, 960 - kmW - 6, 970, { size: 140, weight: 800, style: 'italic', color: p.fg, align: 'right' });
    T(g, CFG.ROUTE.name, 960, 1022, { size: 30, weight: 800, style: 'italic', color: p.fg, align: 'right', max: 380 });
    T(g, CFG.EVENT.edition, 960, 1066, { size: 24, weight: 400, color: p.sub, align: 'right', max: 380 });
    T(g, 'ปล่อยตัว ' + CFG.EVENT.startTime + ' น.', 960, 1100, { size: 24, weight: 400, color: p.sub, align: 'right', max: 380 });

    bibCard(g, ctx, p, runner, 80, 1190, 920, 370);
    foot(g, 1, ctx, p);
    return c;
  }

  /* ---------- สติกเกอร์โปร่งใส 4 แบบ (หน้า 2-5): ไม่มีพื้นหลัง วางทับรูปของตัวเอง ---------- */
  /** แผ่นรองสติกเกอร์: dark = กรมท่าเข้ม · light = ขาว · minimal = ไม่มีแผ่น (ตัวอักษรขาวมีเงา) */
  const SK = {
    dark:    { plate: '#0A1430', line: 'rgba(255,255,255,.22)', fg: '#FFFFFF', acc: '#8FB4E8', pillBg: '#8CD43E', pillFg: '#0A1430' },
    light:   { plate: '#FFFFFF', line: 'rgba(27,59,103,.25)', fg: '#0A1430', acc: '#1B3B67', pillBg: '#1B3B67', pillFg: '#FFFFFF' },
    minimal: { plate: null, line: null, fg: '#FFFFFF', acc: '#8CD43E', pillBg: '#8CD43E', pillFg: '#0A0A0A' },
  };
  function plate(g, s, x, y, w, h, r) {
    if (!s.plate) return;
    g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 28; g.shadowOffsetY = 10;
    g.fillStyle = s.plate; rr(g, x, y, w, h, r); g.fill(); g.restore();
    g.strokeStyle = s.line; g.lineWidth = 2; rr(g, x, y, w, h, r); g.stroke();
  }
  const shadowOn = (g, s) => { if (!s.plate) { g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 22; g.shadowOffsetY = 5; } };
  const shadowOff = (g) => { g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0; };

  /** 2) การ์ด BIB ย่อส่วน */
  function stickerCard(runner, ctx, p, style) {
    const c = mk(1000, 480), g = c.getContext('2d');
    plate(g, { plate: p.cardBg, line: 'rgba(0,0,0,.0)' }, 100, 40, 800, 400, 34);
    bibCard(g, ctx, p, runner, 100, 40, 800, 400, 150);
    return c;
  }
  /** 3) โลโก้งาน + สโลแกน */
  function stickerLogo(runner, ctx, p, style) {
    const s = SK[style], c = mk(1000, 560), g = c.getContext('2d');
    plate(g, s, 40, 40, 920, 480, 40);
    shadowOn(g, s);
    const lg = style === 'light' ? (ctx.stLogoC || ctx.logoD) : (ctx.stLogoW || ctx.logoW);
    if (lg) { const w = 560, h = w * lg.naturalHeight / lg.naturalWidth; g.drawImage(lg, 500 - w / 2, 80, w, h); }
    T(g, 'RUN ' + CFG.EVENT.distanceKm + 'K. FIND YOUR FLOW.', 500, 400, { size: 58, weight: 800, style: 'italic', color: s.fg, align: 'center', max: 840 });
    T(g, CFG.EVENT.dateLabel + ' · ' + CFG.EVENT.location, 500, 460, { size: 32, weight: 500, color: s.acc, align: 'center', max: 840 });
    shadowOff(g);
    return c;
  }
  /** 4) ป้ายชื่อทรงเม็ดยา: 6K · BIB · ชื่อเล่น */
  function stickerPill(runner, ctx, p, style) {
    const s = SK[style], c = mk(1000, 260), g = c.getContext('2d');
    const nick = runner.nickname || runner.firstName || '';
    plate(g, s, 40, 50, 920, 160, 80);
    g.fillStyle = s.pillBg; g.beginPath(); g.arc(130, 130, 56, 0, 7); g.fill();
    T(g, CFG.EVENT.distanceKm + 'K', 130, 148, { size: 46, weight: 800, style: 'italic', color: s.pillFg, align: 'center' });
    shadowOn(g, s);
    T(g, runner.bib, 214, 152, { size: 84, weight: 800, style: 'italic', color: s.fg, align: 'left' });
    g.font = 'italic 800 84px ' + FF; const bw = g.measureText(runner.bib).width;
    g.fillStyle = s.acc; g.fillRect(214 + bw + 26, 92, 4, 76);
    T(g, nick, 214 + bw + 56, 152, { size: 54, weight: 700, color: s.fg, align: 'left', max: 920 - (214 + bw + 56) });
    shadowOff(g);
    return c;
  }
  /** โลโก้งานหลัก (ไฟล์ที่ออกแบบเอง พื้นโปร่งใส) */
  function stickerMainLogo(runner, ctx, p, style) {
    const im = style === 'light' ? ctx.stLogoC : ctx.stLogoW;
    const w = 1600, h = im ? w * im.naturalHeight / im.naturalWidth : 520, pad = 50;
    const c = mk(w + pad * 2, Math.round(h) + pad * 2), g = c.getContext('2d');
    if (im) {
      g.shadowColor = style === 'light' ? 'rgba(255,255,255,.95)' : 'rgba(0,0,0,.55)'; g.shadowBlur = style === 'light' ? 26 : 22; g.shadowOffsetY = style === 'light' ? 0 : 5;
      g.drawImage(im, pad, pad, w, h);
    }
    return c;
  }
  /** แผนที่เส้นทาง (พื้นโปร่งใส ไม่มีเงา) + ข้อความ DISTANCE 6 KM ในพื้นที่ว่างกลางแผนที่ */
  function stickerMap(runner, ctx, p, style) {
    const im = ctx.stMap, w = 1400, h = im ? w * im.naturalHeight / im.naturalWidth : 900, pad = 20;
    const c = mk(w + pad * 2, Math.round(h) + pad * 2), g = c.getContext('2d');
    if (im) g.drawImage(im, pad, pad, w, h);   // ไม่ใส่เงา
    return c;
  }
  /** กรอบรูปที่ออกแบบเอง: เลข BIB อยู่ในช่องมุมขวาล่าง */
  const FRAME_SLOT = { cx: 985, cy: 1802, w: 360, color: { dark: '#FFFFFF', light: '#0A1430', minimal: '#FFFFFF' } };
  function stickerFrame(runner, ctx, p, style) {
    const im = ctx.stFrame, c = mk(im ? im.naturalWidth : 1231, im ? im.naturalHeight : 1920), g = c.getContext('2d');
    if (im) g.drawImage(im, 0, 0);
    T(g, runner.bib, FRAME_SLOT.cx, FRAME_SLOT.cy + 26, { size: 74, weight: 500, style: 'italic', color: FRAME_SLOT.color[style], align: 'center', max: FRAME_SLOT.w });
    return c;
  }

  /** style: 'dark' | 'light' | 'minimal' → [Blob×7] : การ์ด BIB เต็มจอ + สติกเกอร์/กรอบโปร่งใส 6 แบบ */
  async function story(runner, style, onProgress) {
    const st = PAL[style] ? style : 'dark', p = PAL[st];
    await fonts();
    const [logo, logoW, logoD, spons, av, b1, b2, b3, stLogoC, stLogoW, stMap, stFrame, bgL, bgM, sponsW] = await Promise.all([
      loadImg(p.logo), loadImg('img/logo-white.png'), loadImg('img/logo.png'), loadImg(p.spons), U.avatarCanvas(runner, 132, 6, 0),
      st === 'dark' ? loadImg(BG[1]) : null, st === 'dark' ? loadImg(BG[2]) : null, st === 'dark' ? loadImg(BG[3]) : null,
      st === 'light' ? loadImg('img/st-logo-color.webp') : null, st !== 'light' ? loadImg('img/st-logo-white.webp') : null,
      loadImg('img/st-map-' + (st === 'light' ? 'navy' : st === 'minimal' ? 'lime' : 'white') + '.webp'),
      loadImg('img/st-frame-' + st + '.webp'),
      st === 'light' ? loadImg('img/story-bg-light.webp') : null, st === 'minimal' ? loadImg('img/story-bg-min.webp') : null,
      st === 'light' ? loadImg('img/sponsors-grid-white.webp') : null,
    ]);
    // โลโก้บนหัวการ์ด BIB: การ์ด light ใช้หัวสีกรมท่า → ใช้โลโก้ขาวเสมอ
    const ctx = { bgMin: bgM, stLogoC, stLogoW, stMap, stFrame, logo, logoW, logoD, spons, av, bg: { 1: b1, 2: b2, 3: b3 } };
    const out = [];
    for (const [i, fn] of [slide1, stickerMainLogo, stickerFrame, stickerCard, stickerPill, stickerMap, stickerLogo].entries()) {
      if (onProgress) onProgress(i);
      await sleep(30);
      let cv;
      if (i === 0 && st === 'light') {
        // การ์ด BIB เต็มจอสไตล์สว่าง: พื้นหลังเป็นรูปโทนเขียวอมฟ้า → ใช้ตัวอักษรขาว/การ์ดขาวแบบเดียวกับสไตล์มืด
        cv = fn(runner, Object.assign({}, ctx, { logo: logoW, spons: sponsW, bg: { 1: bgL, 2: bgL, 3: bgL }, shade: .30 }), PAL.dark, 'dark');
      } else cv = fn(runner, ctx, p, st);
      out.push(await toBlob(cv));
      cv.width = cv.height = 1;
    }
    return out;
  }

  window.Draw = { ebib, story };
})();
