/**
 * =====================================================================
 *  รูป Finisher (1080×1350 สำหรับโพสต์ IG / Facebook)
 *  วาดด้วย Canvas 2D ตรง ๆ (ไม่ใช้ html2canvas) → ได้ผลเหมือนกันทุกเครื่อง
 *  แสดงเมื่อแอดมินเปิด "โหมดหลังจบงาน" และนักวิ่งเช็คอินวันงานแล้ว
 * =====================================================================
 */
(function () {
  const CFG = window.APP_CONFIG;
  const W = 1080, H = 1350;

  const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

  /** ดาว 5 แฉก */
  function star(g, cx, cy, r, fill) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath(); g.fillStyle = fill; g.fill();
  }
  /** ประกาย ✦ (4 แฉก) */
  function spark(g, cx, cy, r, fill) {
    g.beginPath();
    g.moveTo(cx, cy - r); g.quadraticCurveTo(cx, cy, cx + r, cy); g.quadraticCurveTo(cx, cy, cx, cy + r);
    g.quadraticCurveTo(cx, cy, cx - r, cy); g.quadraticCurveTo(cx, cy, cx, cy - r);
    g.fillStyle = fill; g.fill();
  }
  /** ย่อฟอนต์จนข้อความกว้างไม่เกิน max */
  function fit(g, text, font, size, max) {
    let s = size;
    g.font = font.replace('{s}', s);
    while (g.measureText(text).width > max && s > 20) { s -= 4; g.font = font.replace('{s}', s); }
    return s;
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  async function build(runner, opt) {
    const o = opt || {};
    if (document.fonts) {
      await Promise.all(['italic 800 100px Kanit', '600 40px Kanit', '400 30px Kanit'].map((f) => document.fonts.load(f).catch(() => {})));
    }
    const [logo, av] = await Promise.all([loadImg('img/logo-white.png'), window.U.avatarCanvas(runner, 220, 8, 0)]);

    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');

    // พื้นหลัง: กรมท่าเข้ม + แสงฟ้า/เขียวอมฟ้า (โทนเดียวกับหน้าเว็บ)
    g.fillStyle = '#0A1430'; g.fillRect(0, 0, W, H);
    let rg = g.createRadialGradient(W * 0.9, 0, 0, W * 0.9, 0, W * 0.95);
    rg.addColorStop(0, 'rgba(31,95,191,.95)'); rg.addColorStop(1, 'rgba(31,95,191,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    rg = g.createRadialGradient(0, H, 0, 0, H, W * 0.9);
    rg.addColorStop(0, 'rgba(21,134,122,.9)'); rg.addColorStop(1, 'rgba(21,134,122,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);

    // เส้นความเร็วแนวทแยง
    g.save(); g.translate(W / 2, H / 2); g.rotate(-24 * Math.PI / 180);
    let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 26; i++) {
      const y = rnd() * H * 1.6 - H * 0.8, x = rnd() * W - W * 0.8, len = 160 + rnd() * 520, w = rnd() < 0.25 ? 10 : rnd() < 0.6 ? 4 : 2;
      g.globalAlpha = 0.05 + rnd() * 0.18; g.fillStyle = rnd() < 0.7 ? '#8FB4E8' : '#FFFFFF';
      roundRect(g, x, y, len, w, w / 2); g.fill();
    }
    g.restore(); g.globalAlpha = 1;

    // ดาว 3 ดวง (ลวดลายโลโก้) มุมขวาบน + ประกาย
    star(g, 850, 330, 50, 'rgba(255,255,255,.10)'); star(g, 950, 280, 70, 'rgba(255,255,255,.14)'); star(g, 1030, 340, 50, 'rgba(255,255,255,.10)');
    [[760, 520, 18], [930, 600, 22], [1010, 230, 14], [60, 860, 12], [1010, 1160, 14]].forEach(([x, y, r]) => spark(g, x, y, r, 'rgba(255,255,255,.75)'));

    // โลโก้ + วันที่
    if (logo) g.drawImage(logo, 80, 74, 300, 300 * logo.naturalHeight / logo.naturalWidth);
    g.textAlign = 'right'; g.fillStyle = '#FFFFFF'; g.font = 'italic 800 38px Kanit, sans-serif';
    g.textAlign = 'right'; g.fillText(CFG.EVENT.dateLabel, W - 80, 112);   // iOS: ตั้ง align ซ้ำหลังเปลี่ยน font
    g.fillStyle = '#C6D5EC'; g.font = '400 26px Kanit, sans-serif'; g.textAlign = 'right'; g.fillText(CFG.EVENT.location, W - 80, 150);

    // FINISHER
    g.textAlign = 'left'; g.fillStyle = '#FFFFFF';
    const fs = fit(g, 'FINISHER', 'italic 800 {s}px Kanit, sans-serif', 210, W - 150);
    g.font = 'italic 800 ' + fs + 'px Kanit, sans-serif';
    g.fillText('FINISHER', 66, 420);
    g.fillStyle = '#8CD43E'; g.save(); g.transform(1, 0, -0.18, 1, 0, 0); g.fillRect(150, 446, 300, 14); g.restore();
    g.fillStyle = '#8FB4E8'; g.font = 'italic 800 54px Kanit, sans-serif';
    g.fillText(CFG.EVENT.distanceKm + 'K · ' + CFG.ROUTE.name, 80, 530);

    // นักวิ่ง: รูปโปรไฟล์ + ชื่อ
    g.drawImage(av, 80, 604, 220, 220);
    const nick = runner.nickname || runner.firstName || '';
    g.fillStyle = '#FFFFFF';
    const ns = fit(g, nick, '700 {s}px Kanit, sans-serif', 82, W - 420);
    g.font = '700 ' + ns + 'px Kanit, sans-serif'; g.fillText(nick, 340, 708);
    g.fillStyle = '#C6D5EC'; g.font = '400 34px Kanit, sans-serif';
    g.fillText((runner.firstName + ' ' + runner.lastName).trim(), 340, 762);

    // แถบสถิติ: BIB / ระยะ / เวลา
    const stats = [['BIB', runner.bib], ['DISTANCE', CFG.EVENT.distanceKm + ' KM']];
    if (o.time) stats.push(['TIME', o.time]);
    const top = 890, bh = 230, gap = 22, bw = (W - 160 - gap * (stats.length - 1)) / stats.length;
    stats.forEach(([k, v], i) => {
      const x = 80 + i * (bw + gap);
      roundRect(g, x, top, bw, bh, 28);
      g.fillStyle = i === 0 ? '#FFFFFF' : 'rgba(255,255,255,.08)'; g.fill();
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2; if (i) g.stroke();
      g.textAlign = 'left';
      g.fillStyle = i === 0 ? '#5E6573' : '#8FB4E8'; g.font = '600 26px Kanit, sans-serif'; g.fillText(k, x + 30, top + 56);
      g.fillStyle = i === 0 ? '#0A0A0A' : '#FFFFFF';
      const vs = fit(g, v, 'italic 800 {s}px Kanit, sans-serif', 104, bw - 60);
      g.font = 'italic 800 ' + vs + 'px Kanit, sans-serif'; g.fillText(v, x + 30, top + 178);
    });

    // ท้ายรูป
    g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(80, 1186, W - 160, 2);
    g.textAlign = 'left'; g.fillStyle = '#FFFFFF'; g.font = 'italic 800 32px Kanit, sans-serif';
    g.fillText('COMMUNITY COFFEE RUN', 80, 1250);
    g.textAlign = 'right'; g.fillStyle = '#8CD43E'; fit(g, CFG.EVENT.hashtag, 'italic 800 {s}px Kanit, sans-serif', 32, 440); g.textAlign = 'right'; g.fillText(CFG.EVENT.hashtag, W - 80, 1250);
    g.textAlign = 'left'; g.fillStyle = '#C6D5EC'; g.font = '400 24px Kanit, sans-serif';
    g.fillText('ขอบคุณที่มาวิ่งด้วยกัน · ' + CFG.EVENT.instagram, 80, 1296);

    return new Promise((res) => c.toBlob(res, 'image/png'));
  }

  window.Finisher = { build };
})();
