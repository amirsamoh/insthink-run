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

  const pinSvg = (c) => `<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`;
  /** พื้นหลังของแต่ละหน้า: รูปที่ออกแบบเอง (img/story-bg-N.webp 1080×1920) + ชั้นสีกรมท่าโปร่งแสงให้ตัวอักษรอ่านชัด
   ไม่มีรูป → ใช้พื้นหลังที่โค้ดวาดเอง (backgroundSvg) */
  const BG = { 1: 'img/story-bg-1.webp', 2: 'img/story-bg-3.webp', 3: 'img/story-bg-2.webp' };
  const SHADE = { 1: .12, 2: .12, 3: .10 };
  const bgLayer = (n) => (BG[n]
    ? `<div class="s-bg" style="background-image:url('${BG[n]}')"></div><div class="s-shade" style="background:linear-gradient(180deg,rgba(7,15,40,${SHADE[n] + .18}) 0%,rgba(7,15,40,${SHADE[n]}) 40%,rgba(7,15,40,${SHADE[n] + .3}) 100%)"></div>`
    : backgroundSvg());
  const head = (n) => `${bgLayer(n)}
      <img class="s-logo" src="img/logo-white.png" alt="">
      <div class="s-date">${esc(CFG.EVENT.dateLabel)}<small>${esc(CFG.EVENT.location)}</small></div>`;
  const foot = (n) => `<div class="s-foot"><span>${esc(CFG.EVENT.instagram)}</span><span class="s-page">${n} / 3</span><span>${esc(CFG.EVENT.hashtag)}</span></div>`;

  /** หน้า 1: I'm running — รูปโปรไฟล์ + เส้นทาง + การ์ด BIB */
  function slideBib(runner) {
    const km = CFG.EVENT.distanceKm;
    return `${head(1)}
      <div class="s-title">I'm<br><span class="o">running</span></div>
      <div class="s-runner">
        <span class="s-avatar">${runner.photo ? `<img src="${esc(runner.photo)}" alt="">` : esc(String(runner.nickname || runner.firstName || '?').charAt(0).toUpperCase())}</span>
        <span class="s-rname">${esc(runner.nickname || runner.firstName)}<small>${esc(runner.firstName)} ${esc(runner.lastName)}</small></span>
      </div>
      <div class="s-route">
        ${routeSvg({ stroke: '#FFFFFF', ghost: 'rgba(255,255,255,.38)', glow: false, start: '#0F2244', grid: 'rgba(255,255,255,.07)', width: 2.8 })}
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
      ${foot(1)}`;
  }

  /** หน้า 2: Race Kit — รูปของที่ได้รับ 4 ชิ้น (ใช้ background-image เพราะ html2canvas ไม่รองรับ object-fit) */
  function slideKit() {
    const kit = [
      ['img/bandana-flat.webp', 'ผ้าโพกหัว Bandana', 'light'],
      ['img/stickers.webp', 'สติกเกอร์ Limited', ''],
      ['img/wristband.webp', 'ริสแบน', ''],
      ['img/meal.webp', 'ข้าวยำ + เครื่องดื่ม', ''],
    ];
    const price = (CFG.PACKAGES.find((p) => p.runner) || {}).price;
    return `${head(2)}
      <div class="s-title">Race<br><span class="o">kit</span></div>
      <div class="k-grid">${kit.map(([src, name, cls], i) => `<div class="k-tile ${cls}"><div class="k-img" style="background-image:url('${src}')"></div><span class="k-no">0${i + 1}</span><span class="k-name">${esc(name)}</span></div>`).join('')}</div>
      <div class="k-note"><b>${CFG.EVENT.distanceKm}K RUN</b> · ของที่ระลึกทั้งหมดรวมในค่าสมัคร ${price} บาท</div>
      ${foot(2)}`;
  }

  /** หน้า 3: Race Day — ตารางเวลา + สถานที่ + ชวนเพื่อนด้วยลิงก์ของเจ้าของ */
  function slideDay(runner) {
    const url = window.U.inviteUrl(runner.bib).replace(/^https?:\/\//, '');
    return `${head(3)}
      <div class="s-title">Race<br><span class="o">day</span></div>
      <div class="d-when"><b>${esc(CFG.EVENT.dateLabel)}</b><span>${pinSvg('#8FB4E8')}${esc(CFG.EVENT.location)}</span></div>
      <ol class="d-tl">${(CFG.EVENT.schedule || []).map((x) => `<li class="${x.time === CFG.EVENT.startTime ? 'key' : ''}"><time>${esc(x.time || '')}</time><i></i><div><b>${esc(x.title)}</b>${x.desc ? `<span>${esc(x.desc)}</span>` : ''}</div></li>`).join('')}</ol>
      <div class="d-cta">
        <div class="d-cta-t">มาวิ่งด้วยกัน<small>สมัครผ่านลิงก์ของ ${esc(runner.nickname || runner.firstName)}</small></div>
        <div class="d-url">${esc(url)}</div>
      </div>
      ${foot(3)}`;
  }

  /** จับภาพ .story ปัจจุบันเป็น Blob */
  async function capture(el, runner) {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await Promise.all(Array.from(el.querySelectorAll('img')).map(loadImg));
    // รอรูปพื้นหลัง (background-image) ให้โหลดเสร็จ
    const bgs = Array.from(el.querySelectorAll('.k-img,.s-bg')).map((d) => (d.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/) || [])[1]).filter(Boolean);
    await Promise.all(bgs.map((src) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = src; })));
    await new Promise((r) => setTimeout(r, 80));
    const num = el.querySelector('.s-bib .num span');
    if (num) fitText(num, 780, 250);   // เลข BIB พอดีการ์ด
    fitText(el.querySelector('.s-title'), 940, 200);

    let swapAvatar = () => {};
    if (el.querySelector('.s-avatar')) {
      const av = await window.U.avatarCanvas(runner, 132, 6, 0);
      swapAvatar = (doc) => { const t = doc.querySelector('#story .s-avatar'); if (t) { t.innerHTML = ''; t.style.cssText = 'width:132px;height:132px;border:0;background:none;overflow:visible;display:block'; const c2 = doc.createElement('canvas'); c2.width = av.width; c2.height = av.height; c2.getContext('2d').drawImage(av, 0, 0); c2.style.cssText = av.style.cssText; t.appendChild(c2); } };
    }
    const canvas = await html2canvas(el, {
      width: 1080, height: 1920, scale: 1, x: 0, y: 0, scrollX: 0, scrollY: 0,
      windowWidth: 1080, windowHeight: 1920,
      backgroundColor: '#0F2244', useCORS: true, onclone: (doc) => { window.U.canvasifyImages(el)(doc); swapAvatar(doc); }, logging: false,
    });
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  /** สร้าง Story ทั้ง 3 หน้า → [Blob, Blob, Blob] */
  async function buildAll(runner) {
    const el = document.getElementById('story');
    // overlay บังจอระหว่างย้าย stage มาที่ (0,0) ให้ html2canvas วัดตำแหน่งถูก
    const overlay = document.createElement('div');
    overlay.className = 'render-overlay';
    overlay.innerHTML = '<span class="spinner"></span><span id="storyProg">Creating your story… 1/3</span>';
    document.body.appendChild(overlay);
    const stage = el.parentElement;
    stage.classList.add('rendering');
    try {
      const out = [];
      const slides = [slideBib, slideKit, slideDay];
      for (let i = 0; i < slides.length; i++) {
        const p = document.getElementById('storyProg'); if (p) p.textContent = 'Creating your story… ' + (i + 1) + '/' + slides.length;
        el.innerHTML = slides[i](runner);
        out.push(await capture(el, runner));
      }
      return out;
    } finally {
      stage.classList.remove('rendering');
      overlay.remove();
    }
  }

  /** (เดิม) หน้าเดียว */
  async function build(runner) { return (await buildAll(runner))[0]; }

  window.Story = { build, buildAll };
})();
