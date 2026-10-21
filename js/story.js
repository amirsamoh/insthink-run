/**
 * =====================================================================
 *  IG Story Generator (1080×1920)
 *  ประกอบ DOM ใน .story (นอกจอ) → html2canvas → PNG Blob
 *
 *  - ไม่ใส่ QR ส่วนตัวในรูป เพราะรูปจะถูกแชร์สาธารณะ (QR มี token ใช้เช็คอิน)
 *  - ห้ามใส่ <text> ใน SVG พื้นหลัง (ฟอนต์เว็บไม่โหลดใน SVG-as-image)
 *  - รอ document.fonts.ready + โหลดรูปโลโก้ก่อนจับภาพ
 * =====================================================================
 */
(function () {
  const CFG = window.APP_CONFIG;
  const { esc, routeSvg } = window.U;

  /** พื้นหลัง abstract motion: พื้นกรมท่า + แสงเรือง + เส้นความเร็ว + ดาว + จุด halftone */
  function backgroundSvg() {
    let seed = 11;   // สุ่มแบบคงที่ ทุกรูปลายเหมือนกัน
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    let streaks = '';
    for (let i = 0; i < 28; i++) {
      const y = Math.round(rnd() * 2000) - 40;
      const x = Math.round(rnd() * 900) - 200;
      const len = 180 + Math.round(rnd() * 560);
      const w = rnd() < 0.25 ? 12 : rnd() < 0.6 ? 5 : 2;
      const op = (0.06 + rnd() * 0.22).toFixed(2);
      const col = rnd() < 0.7 ? '#8FB4E8' : '#FFFFFF';
      streaks += `<rect x="${x}" y="${y}" width="${len}" height="${w}" rx="${w / 2}" fill="${col}" opacity="${op}"/>`;
    }
    let dots = '';
    for (let r = 0; r < 12; r++) for (let k = 0; k < 12; k++) {
      dots += `<circle cx="${1040 - k * 26}" cy="${560 + r * 26}" r="${(2.6 - r * 0.18).toFixed(2)}" fill="#FFFFFF" opacity=".14"/>`;
    }
    const star = (cx, cy, s, op) => {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? s * 0.45 : s;
        pts.push((cx + Math.cos(a) * rr).toFixed(1) + ',' + (cy + Math.sin(a) * rr).toFixed(1));
      }
      return `<polygon points="${pts.join(' ')}" fill="#FFFFFF" opacity="${op}" stroke-linejoin="round"/>`;
    };
    return `<svg class="bg-svg" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g1" cx="90%" cy="8%" r="65%">
          <stop offset="0" stop-color="#3D6BB0" stop-opacity=".9"/><stop offset=".5" stop-color="#1B3B67" stop-opacity=".35"/><stop offset="1" stop-color="#1B3B67" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0F2244"/><stop offset="1" stop-color="#070F1F"/>
        </linearGradient>
        <linearGradient id="sw" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#8FB4E8" stop-opacity="0"/><stop offset=".5" stop-color="#8FB4E8" stop-opacity=".9"/><stop offset="1" stop-color="#8FB4E8" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="1080" height="1920" fill="url(#g2)"/>
      <rect width="1080" height="1920" fill="url(#g1)"/>
      <g transform="rotate(-24 540 960)">${streaks}</g>
      <path d="M-80 650 C 260 540, 520 780, 1160 480" fill="none" stroke="url(#sw)" stroke-width="6"/>
      <path d="M-80 700 C 300 600, 560 820, 1160 550" fill="none" stroke="url(#sw)" stroke-width="2" opacity=".6"/>
      ${star(860, 300, 54, 0.10)}${star(960, 250, 74, 0.14)}${star(1050, 310, 54, 0.10)}
      ${dots}
    </svg>`;
  }

  /** ย่อขนาดฟอนต์จนข้อความกว้างไม่เกิน maxW px */
  function fitText(node, maxW, start) {
    let size = start;
    node.style.fontSize = size + 'px';
    while (node.scrollWidth > maxW && size > 60) { size -= 6; node.style.fontSize = size + 'px'; }
  }

  const loadImg = (img) => (img.complete && img.naturalWidth ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; }));

  /** ประกอบ DOM ของ Story แล้วคืนค่า Blob (PNG) */
  async function build(runner) {
    const el = document.getElementById('story');
    const km = CFG.EVENT.distanceKm;

    el.innerHTML = `
      ${backgroundSvg()}
      <img class="s-logo" src="img/logo-white.png" alt="">
      <div class="s-date">${esc(CFG.EVENT.dateLabel)}<small>${esc(CFG.EVENT.location)}</small></div>
      <div class="s-title">I'm<br><span class="o">running</span></div>
      <div class="s-runner">
        <span class="s-avatar">${runner.photo ? `<img src="${esc(runner.photo)}" alt="">` : esc(String(runner.nickname || runner.firstName || '?').charAt(0).toUpperCase())}</span>
        <span class="s-rname">${esc(runner.nickname || runner.firstName)}<small>${esc(runner.firstName)} ${esc(runner.lastName)}</small></span>
      </div>
      <div class="s-route">
        ${routeSvg({ stroke: '#FFFFFF', dash: '#0F2244', start: '#0F2244', grid: 'rgba(255,255,255,.07)', width: 2.6 })}
        <div class="rinfo">
          <div class="k">${km}<small>KM</small></div>
          <div class="n">${esc(CFG.ROUTE.name)}</div>
          <div class="t">${esc(CFG.EVENT.edition)}<br>ปล่อยตัว ${esc(CFG.EVENT.startTime)} น.</div>
        </div>
      </div>
      <div class="s-bib">
        <div class="top"><img src="img/logo-white.png" alt=""><b>${km}K</b></div>
        <div class="band"></div>
        <div class="num"><span>${esc(runner.bib)}</span></div>
        <div class="nm"><span>${esc(runner.nickname || runner.firstName)}</span><span>${esc(CFG.EVENT.dateLabel)}</span></div>
      </div>
      <div class="s-foot"><span>${esc(CFG.EVENT.instagram)}</span><span>${esc(CFG.EVENT.hashtag)}</span></div>`;

    // overlay บังจอระหว่างย้าย stage มาที่ (0,0) ให้ html2canvas วัดตำแหน่งถูก
    const overlay = document.createElement('div');
    overlay.className = 'render-overlay';
    overlay.innerHTML = '<span class="spinner"></span><span>Creating your story…</span>';
    document.body.appendChild(overlay);
    const stage = el.parentElement;
    stage.classList.add('rendering');

    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await Promise.all(Array.from(el.querySelectorAll('img')).map(loadImg));
      await new Promise((r) => setTimeout(r, 80));
      fitText(el.querySelector('.s-bib .num span'), 780, 250);   // เลข BIB พอดีการ์ด
      fitText(el.querySelector('.s-title'), 940, 200);

      const canvas = await html2canvas(el, {
        width: 1080, height: 1920, scale: 1, x: 0, y: 0, scrollX: 0, scrollY: 0,
        windowWidth: 1080, windowHeight: 1920,
        backgroundColor: '#0F2244', useCORS: true, logging: false,
      });
      return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    } finally {
      stage.classList.remove('rendering');
      overlay.remove();
    }
  }

  window.Story = { build };
})();
