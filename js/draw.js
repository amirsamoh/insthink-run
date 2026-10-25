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
    g.textAlign = o.align || 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = o.color || '#fff';
    g.fillText(s, x, y);
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

  function base(g, n, ctx) {
    g.fillStyle = '#0F2244'; g.fillRect(0, 0, SW, SH);
    cover(g, ctx.bg[n], 0, 0, SW, SH);
    const lg = g.createLinearGradient(0, 0, 0, SH), s = SHADE[n];
    lg.addColorStop(0, 'rgba(7,15,40,' + (s + .18) + ')'); lg.addColorStop(.4, 'rgba(7,15,40,' + s + ')'); lg.addColorStop(1, 'rgba(7,15,40,' + (s + .3) + ')');
    g.fillStyle = lg; g.fillRect(0, 0, SW, SH);
    if (ctx.logo) g.drawImage(ctx.logo, 80, 100, 400, 400 * ctx.logo.naturalHeight / ctx.logo.naturalWidth);
    T(g, CFG.EVENT.dateLabel, SW - 80, 154, { size: 40, weight: 800, style: 'italic', align: 'right', max: 460 });
    T(g, CFG.EVENT.location, SW - 80, 200, { size: 26, weight: 400, color: '#C6D5EC', align: 'right', max: 460 });
  }
  function title(g, l1, l2) {
    T(g, l1.toUpperCase(), 70, 500, { size: 200, weight: 800, style: 'italic', max: 940 });
    T(g, l2.toUpperCase(), 70, 672, { size: 200, weight: 800, style: 'italic', color: '#8FB4E8', max: 940 });
  }
  function foot(g, n, ctx) {
    spaced(g, 'SUPPORTED BY', SW / 2, 1618, { size: 20, weight: 700, color: '#C6D5EC', gap: 6 });
    if (ctx.spons) { const w = 760, h = w * ctx.spons.naturalHeight / ctx.spons.naturalWidth; g.drawImage(ctx.spons, (SW - w) / 2, 1796 - h, w, h); }
    T(g, CFG.EVENT.instagram, 80, 1848, { size: 32, weight: 800, style: 'italic', align: 'left', max: 380 });
    T(g, n + ' / 3', SW / 2, 1848, { size: 28, weight: 800, style: 'italic', color: 'rgba(255,255,255,.55)', align: 'center' });
    T(g, CFG.EVENT.hashtag, SW - 80, 1848, { size: 32, weight: 800, style: 'italic', color: '#8FB4E8', align: 'right', max: 380 });
  }

  function slide1(runner, ctx) {
    const c = mk(SW, SH), g = c.getContext('2d');
    base(g, 1, ctx); title(g, "I'm", 'running');
    const nick = runner.nickname || runner.firstName || '';
    g.drawImage(ctx.av, 80, 700, 132, 132);
    T(g, nick, 242, 756, { size: 52, weight: 700, max: 700 });
    T(g, (runner.firstName + ' ' + runner.lastName).trim(), 242, 800, { size: 30, weight: 400, color: '#C6D5EC', max: 700 });

    // กล่องเส้นทาง
    g.fillStyle = 'rgba(255,255,255,.05)'; rr(g, 80, 850, 920, 310, 28); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 2; g.stroke();
    const k = 270 / 100, ox = 100 + (460 - 270) / 2, oy = 870;
    const P = (p) => [ox + p[0] * k, oy + p[1] * k];
    g.lineJoin = 'round'; g.lineCap = 'round';
    (CFG.ROUTE.ghost || []).forEach((line) => {
      g.beginPath(); line.forEach((p, i) => { const q = P(p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
      g.strokeStyle = 'rgba(255,255,255,.38)'; g.lineWidth = 0.55 * k; g.stroke();
    });
    g.beginPath(); CFG.ROUTE.points.forEach((p, i) => { const q = P(p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 2.8 * k; g.stroke();
    const s0 = P(CFG.ROUTE.points[0]);
    g.fillStyle = '#0F2244'; g.beginPath(); g.arc(s0[0], s0[1], 3.7 * k, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 0.9 * k; g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(s0[0], s0[1], 1.9 * k, 0, 7); g.fill();
    // ข้อมูลระยะ
    g.font = 'italic 800 52px ' + FF; const kmW = g.measureText('KM').width;
    T(g, 'KM', 960, 970, { size: 52, weight: 800, style: 'italic', color: '#8FB4E8', align: 'right' });
    T(g, CFG.EVENT.distanceKm, 960 - kmW - 6, 970, { size: 140, weight: 800, style: 'italic', align: 'right' });
    T(g, CFG.ROUTE.name, 960, 1022, { size: 30, weight: 800, style: 'italic', align: 'right', max: 380 });
    T(g, CFG.EVENT.edition, 960, 1066, { size: 24, weight: 400, color: '#C6D5EC', align: 'right', max: 380 });
    T(g, 'ปล่อยตัว ' + CFG.EVENT.startTime + ' น.', 960, 1100, { size: 24, weight: 400, color: '#C6D5EC', align: 'right', max: 380 });

    // การ์ด BIB
    const bx = 80, by = 1190, bw = 920, bh = 370;
    g.save(); rr(g, bx, by, bw, bh, 34); g.clip();
    g.fillStyle = '#fff'; g.fillRect(bx, by, bw, bh);
    g.fillStyle = '#0A0A0A'; g.fillRect(bx, by, bw, 84);
    if (ctx.logo) g.drawImage(ctx.logo, bx + 36, by + 16, 52 * ctx.logo.naturalWidth / ctx.logo.naturalHeight, 52);
    g.font = 'italic 800 40px ' + FF; const dw = g.measureText(CFG.EVENT.distanceKm + 'K').width + 40;
    g.fillStyle = '#fff'; rr(g, bx + bw - 36 - dw, by + 16, dw, 52, 10); g.fill();
    T(g, CFG.EVENT.distanceKm + 'K', bx + bw - 36 - dw / 2, by + 56, { size: 40, weight: 800, style: 'italic', color: '#0A0A0A', align: 'center' });
    g.fillStyle = '#fff'; g.fillRect(bx, by + 84, bw, 14);
    g.fillStyle = '#1B3B67';
    for (let x = bx - 30; x < bx + bw + 30; x += 26) { g.beginPath(); g.moveTo(x, by + 84); g.lineTo(x + 16, by + 84); g.lineTo(x + 6, by + 98); g.lineTo(x - 10, by + 98); g.closePath(); g.fill(); }
    T(g, runner.bib, bx + bw / 2, by + 278, { size: 200, weight: 800, style: 'italic', color: '#0A0A0A', align: 'center', max: 780 });
    T(g, nick, bx + 40, by + bh - 28, { size: 28, weight: 500, color: '#45454f', align: 'left', max: 420 });
    T(g, CFG.EVENT.dateLabel, bx + bw - 40, by + bh - 28, { size: 28, weight: 500, color: '#45454f', align: 'right', max: 420 });
    g.restore();
    foot(g, 1, ctx);
    return c;
  }

  function slide2(runner, ctx) {
    const c = mk(SW, SH), g = c.getContext('2d');
    base(g, 2, ctx); title(g, 'Race', 'kit');
    const kit = [['bandana', 'ผ้าโพกหัว Bandana', true], ['stickers', 'สติกเกอร์ Limited', false], ['wristband', 'ริสแบน', false], ['meal', 'ข้าวยำ + เครื่องดื่ม', false]];
    kit.forEach((it, i) => {
      const x = 80 + (i % 2) * 472, y = 700 + Math.floor(i / 2) * 404, w = 448, h = 380, light = it[2];
      g.save(); rr(g, x, y, w, h, 30); g.clip();
      if (light) { const rg = g.createRadialGradient(x + w / 2, y + h * .2, 0, x + w / 2, y + h * .2, w * .8); rg.addColorStop(0, '#FFFFFF'); rg.addColorStop(1, '#DCE5F1'); g.fillStyle = rg; }
      else g.fillStyle = '#1B3B67';
      g.fillRect(x, y, w, h);
      if (light) contain(g, ctx.kit[i], x + 20, y + 24, w - 40, h - 104); else cover(g, ctx.kit[i], x, y, w, h);
      const lg = g.createLinearGradient(0, y, 0, y + h); lg.addColorStop(.52, 'rgba(10,20,48,0)'); lg.addColorStop(1, 'rgba(10,20,48,.9)');
      g.fillStyle = lg; g.fillRect(x, y, w, h);
      g.restore();
      T(g, '0' + (i + 1), x + w - 26, y + 62, { size: 44, weight: 800, style: 'italic', color: light ? '#0A1430' : '#fff', align: 'right' });
      T(g, it[1], x + 26, y + h - 30, { size: 36, weight: 700, align: 'left', max: w - 50 });
    });
    const price = (CFG.PACKAGES.find((p) => p.runner) || {}).price;
    g.font = 'italic 800 34px ' + FF; const a = CFG.EVENT.distanceKm + 'K RUN';
    const aw = g.measureText(a).width;
    T(g, a, 80, 1536, { size: 34, weight: 800, style: 'italic', color: '#8CD43E', align: 'left' });
    T(g, ' · ของที่ระลึกทั้งหมดรวมในค่าสมัคร ' + price + ' บาท', 80 + aw, 1536, { size: 32, weight: 400, color: '#C6D5EC', align: 'left', max: 920 - aw });
    foot(g, 2, ctx);
    return c;
  }

  function slide3(runner, ctx) {
    const c = mk(SW, SH), g = c.getContext('2d');
    base(g, 3, ctx); title(g, 'Race', 'day');
    T(g, CFG.EVENT.dateLabel, 80, 770, { size: 76, weight: 800, style: 'italic', max: 920 });
    // หมุดสถานที่
    g.save(); g.translate(80, 796); g.scale(1.5, 1.5); g.strokeStyle = '#8FB4E8'; g.lineWidth = 2.2; g.lineCap = 'round'; g.lineJoin = 'round';
    g.stroke(new Path2D('M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z')); g.beginPath(); g.arc(12, 9.5, 2.5, 0, 7); g.stroke(); g.restore();
    T(g, CFG.EVENT.location, 134, 832, { size: 38, weight: 500, color: '#C6D5EC', align: 'left', max: 860 });

    // ไทม์ไลน์
    let y = 920; const items = CFG.EVENT.schedule || [];
    const rowsInfo = items.map((x) => {
      g.font = '400 28px ' + FF;
      const lines = x.desc ? wrap(g, x.desc, 590, 2) : [];
      return { x, lines, h: 56 + (lines.length ? 12 + lines.length * 38 : 0) + 36 };
    });
    const total = rowsInfo.reduce((a, r) => a + r.h, 0), k = total > 440 ? 440 / total : 1;
    rowsInfo.forEach((r, idx) => {
      const key = r.x.time === CFG.EVENT.startTime;
      T(g, r.x.time || '', 310, y + 56, { size: 66, weight: 800, style: 'italic', color: key ? '#8CD43E' : '#fff', align: 'right', max: 230 });
      if (idx < rowsInfo.length - 1) { g.fillStyle = 'rgba(143,180,232,.35)'; g.fillRect(355, y + 66, 4, r.h * k - 20); }
      g.beginPath(); g.arc(357, y + 38, 17, 0, 7); g.fillStyle = key ? '#8CD43E' : '#0F2244'; g.fill();
      g.lineWidth = 5; g.strokeStyle = key ? '#fff' : '#8FB4E8'; g.stroke();
      T(g, r.x.title, 404, y + 44, { size: 44, weight: 700, align: 'left', max: 596 });
      r.lines.forEach((ln, j) => T(g, ln, 404, y + 90 + j * 38, { size: 28, weight: 400, color: '#C6D5EC', align: 'left' }));
      y += r.h * k;
    });

    // ปุ่มชวนเพื่อน
    const url = U.inviteUrl(runner.bib).replace(/^https?:\/\//, '');
    g.fillStyle = '#fff'; rr(g, 80, 1370, 920, 180, 34); g.fill();
    T(g, 'มาวิ่งด้วยกัน', 124, 1446, { size: 52, weight: 800, style: 'italic', color: '#0A1430', align: 'left', max: 830 });
    T(g, 'สมัครผ่านลิงก์ของ ' + (runner.nickname || runner.firstName), 124, 1486, { size: 26, weight: 400, color: '#5E6573', align: 'left', max: 830 });
    T(g, url, 124, 1524, { size: 28, weight: 600, color: '#1B3B67', align: 'left', max: 832 });
    foot(g, 3, ctx);
    return c;
  }

  /** onProgress(i) ถูกเรียกก่อนวาดแต่ละหน้า → คืน [Blob×3] */
  async function story(runner, onProgress) {
    await fonts();
    const [logo, spons, av, b1, b2, b3, k1, k2, k3, k4] = await Promise.all([
      loadImg('img/logo-white.png'), loadImg('img/sponsors-grid-white.webp'), U.avatarCanvas(runner, 132, 6, 0),
      loadImg(BG[1]), loadImg(BG[2]), loadImg(BG[3]),
      loadImg('img/bandana-flat.webp'), loadImg('img/stickers.webp'), loadImg('img/wristband.webp'), loadImg('img/meal.webp'),
    ]);
    const ctx = { logo, spons, av, bg: { 1: b1, 2: b2, 3: b3 }, kit: [k1, k2, k3, k4] };
    const out = [];
    for (const [i, fn] of [slide1, slide2, slide3].entries()) {
      if (onProgress) onProgress(i);
      await sleep(30);
      const cv = fn(runner, ctx);
      out.push(await toBlob(cv));
      cv.width = cv.height = 1;   // คืนหน่วยความจำ (iPhone จำกัด)
    }
    return out;
  }

  window.Draw = { ebib, story };
})();
