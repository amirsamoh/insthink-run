/**
 * =====================================================================
 *  หน้าแรก (index.html) — รายละเอียดงานอย่างเดียว ปุ่มสมัครพาไป register.html
 *  ข้อมูลทั้งหมดดึงจาก config.js → เปิดอีเวนต์ใหม่แค่แก้ config + รูปใน img/
 * =====================================================================
 */
(function () {
  const CFG = window.APP_CONFIG;
  const { $, $$ } = window.U;

  $('#evEdition').textContent = CFG.EVENT.edition;
  $('#evDate').textContent = CFG.EVENT.dateLabel;
  $('#evTime').textContent = CFG.EVENT.startTime + ' น.';
  $('#evLoc').textContent = CFG.EVENT.location;
  $('#stTime').textContent = CFG.EVENT.startTime;
  $('#heroStars').innerHTML = '<img src="img/stars-navy.png" alt="">';

  // เส้นทาง
  $('#homeRoute').innerHTML = window.U.routeSvg({ stroke: '#5FD3EE', dash: '#0A1430', start: '#0A1430', grid: 'rgba(255,255,255,.06)', width: 2.4 });
  $('#homeRouteName').textContent = CFG.ROUTE.name;
  $('#homeRouteLoc').textContent = CFG.EVENT.location + ' · ปล่อยตัว ' + CFG.EVENT.startTime + ' น.';

  /* ---------- Race Kit: coverflow เลื่อนเองทุก 2.5 วิ (หยุดชั่วคราวขณะนิ้วแตะ) ---------- */
  (function coverflow() {
    const root = $('#kitFlow'); if (!root) return;
    const cards = $$('.cf-card', root), n = cards.length, dots = $('.cf-dots', root);
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cur = 0, timer = null, hold = false;
    dots.innerHTML = cards.map((_, i) => `<button type="button" role="tab" aria-label="ชิ้นที่ ${i + 1}"></button>`).join('');
    const dotEls = $$('button', dots);
    const prev = new Array(n).fill(null);
    const place = (c, o) => {
      c.style.setProperty('--o', o);
      c.style.setProperty('--a', Math.abs(o));
      c.classList.toggle('on', o === 0);
      c.classList.toggle('far', Math.abs(o) >= 2);   // 4 ชิ้น → ซ่อนใบที่อยู่ไกล ให้ซ้าย-ขวาสมดุล
      c.setAttribute('aria-hidden', o === 0 ? 'false' : 'true');
    };
    function paint() {
      cards.forEach((c, i) => {
        let o = i - cur;
        if (o > n / 2) o -= n; if (o < -n / 2) o += n;      // วนรอบ
        const p = prev[i];
        prev[i] = o;
        if (p !== null && Math.abs(o - p) > 1) {
          // การ์ดที่วนจากฝั่งหนึ่งไปอีกฝั่ง: วาร์ปไปรอนอกขอบฝั่งใหม่แบบไม่มีแอนิเมชัน แล้วค่อยเลื่อนเข้ามา (ไม่บินตัดผ่านกลางจอ)
          c.style.transition = 'none';
          place(c, o > 0 ? o + 1 : o - 1);
          void c.offsetWidth;
          c.style.transition = '';
        }
        place(c, o);
      });
      dotEls.forEach((d, i) => d.classList.toggle('on', i === cur));
    }
    const go = (k) => { cur = (k + n) % n; paint(); };
    const start = () => { stop(); if (!reduce) timer = setInterval(() => { if (!hold && !document.hidden) go(cur + 1); }, 2500); };
    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    $$('[data-cf]', root).forEach((b) => b.addEventListener('click', () => { go(cur + Number(b.dataset.cf)); start(); }));
    dotEls.forEach((d, i) => d.addEventListener('click', () => { go(i); start(); }));
    cards.forEach((c, i) => c.addEventListener('click', () => { if (i !== cur) { go(i); start(); } }));
    // ปัดซ้าย/ขวาบนมือถือ
    let x0 = null;
    const stage = $('.cf-stage', root);
    stage.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; hold = true; }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      hold = false;
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) { go(cur + (dx < 0 ? 1 : -1)); start(); }
    });
    paint(); start();
  })();
})();
