/**
 * ดูรูปเต็มจอ + ซูม (ใช้กับ Race Kit หน้าแรก)
 *  - มือถือ: ถ่างสองนิ้วซูม · ลากเลื่อนเมื่อซูมอยู่ · แตะสองครั้งซูม/คืน · ปัดซ้าย/ขวาเปลี่ยนรูป (ตอนไม่ได้ซูม)
 *  - คอม: ล้อเมาส์ซูม · ดับเบิลคลิก · ลูกศรซ้าย/ขวา · Esc ปิด
 *  U.lightbox(items, index, { onClose })   items = [{ src, alt, cap }]
 */
(function () {
  const MAX = 4;
  let box, img, cap, count, btnPrev, btnNext, items = [], idx = 0, opts = {}, lastFocus = null;
  let s = 1, tx = 0, ty = 0;                       // สเกล / เลื่อน
  const pts = new Map(); let pinch = null, pan = null, tapT = 0, tapX = 0, tapY = 0, swipe = null;

  function build() {
    box = document.createElement('div');
    box.className = 'zv'; box.hidden = true;
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'ดูรูป');
    box.innerHTML = `
      <div class="zv-top"><span class="zv-count" aria-live="polite"></span>
        <button type="button" class="zv-btn zv-close" aria-label="ปิด"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="zv-stage"><img class="zv-img" alt="" draggable="false"></div>
      <button type="button" class="zv-btn zv-nav zv-prev" aria-label="รูปก่อนหน้า"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>
      <button type="button" class="zv-btn zv-nav zv-next" aria-label="รูปถัดไป"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>
      <div class="zv-bottom"><p class="zv-cap"></p>
        <div class="zv-zoom"><button type="button" class="zv-btn" data-z="-1" aria-label="ซูมออก"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 12h12"/></svg></button>
        <button type="button" class="zv-btn" data-z="1" aria-label="ซูมเข้า"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 12h12M12 6v12"/></svg></button></div>
        <p class="zv-hint">ถ่างสองนิ้ว หรือแตะสองครั้งเพื่อซูม</p></div>`;
    document.body.appendChild(box);
    img = box.querySelector('.zv-img'); cap = box.querySelector('.zv-cap'); count = box.querySelector('.zv-count');
    btnPrev = box.querySelector('.zv-prev'); btnNext = box.querySelector('.zv-next');
    box.querySelector('.zv-close').addEventListener('click', close);
    btnPrev.addEventListener('click', () => show(idx - 1));
    btnNext.addEventListener('click', () => show(idx + 1));
    box.querySelectorAll('[data-z]').forEach((b) => b.addEventListener('click', () => zoomAt(s * (b.dataset.z > 0 ? 1.6 : 1 / 1.6))));
    const stage = box.querySelector('.zv-stage');
    stage.addEventListener('click', (e) => { if (e.target === stage && s === 1) close(); });   // แตะพื้นที่ว่าง = ปิด
    stage.addEventListener('pointerdown', down);
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY); }, { passive: false });
    stage.addEventListener('dblclick', (e) => { if (e.pointerType !== 'touch') zoomAt(s > 1 ? 1 : 2.5, e.clientX, e.clientY); });
    document.addEventListener('keydown', (e) => {
      if (box.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
      else if (e.key === 'Tab') {                    // วนโฟกัสอยู่ในหน้าต่าง
        const f = [...box.querySelectorAll('button:not([hidden])')].filter((b) => b.offsetParent);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    window.addEventListener('resize', () => { if (!box.hidden) clamp(), apply(); });
  }

  function apply(anim) {
    img.style.transition = anim ? 'transform .22s ease' : 'none';
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    box.classList.toggle('zoomed', s > 1.01);
  }
  function clamp() {
    if (s <= 1) { tx = 0; ty = 0; return; }
    const w = img.offsetWidth * s, h = img.offsetHeight * s;            // offsetWidth = ขนาดก่อน transform
    const mx = Math.max(0, (w - innerWidth) / 2), my = Math.max(0, (h - innerHeight) / 2);
    tx = Math.min(mx, Math.max(-mx, tx)); ty = Math.min(my, Math.max(-my, ty));
  }
  // ซูมโดยให้จุด (cx,cy) บนจอค้างอยู่ที่เดิม
  function zoomAt(ns, cx, cy) {
    ns = Math.min(MAX, Math.max(1, ns));
    if (cx === undefined) { cx = innerWidth / 2; cy = innerHeight / 2; }
    const ox = cx - innerWidth / 2, oy = cy - innerHeight / 2;
    tx = ox - (ox - tx) * (ns / s); ty = oy - (oy - ty) * (ns / s);
    s = ns; clamp(); apply(true);
  }

  function down(e) {
    if (e.target.closest('.zv-btn')) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, tx, ty };
      pan = null; swipe = null;
    } else if (pts.size === 1) {
      if (s > 1) pan = { x: e.clientX, y: e.clientY, tx, ty };
      else swipe = { x: e.clientX, y: e.clientY };
    }
  }
  function move(e) {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const ns = Math.min(MAX, Math.max(1, pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
      const ox = pinch.cx - innerWidth / 2, oy = pinch.cy - innerHeight / 2;
      const mx = (a.x + b.x) / 2 - pinch.cx, my = (a.y + b.y) / 2 - pinch.cy;
      tx = ox - (ox - pinch.tx) * (ns / pinch.s) + mx; ty = oy - (oy - pinch.ty) * (ns / pinch.s) + my;
      s = ns; clamp(); apply();
    } else if (pan) {
      tx = pan.tx + e.clientX - pan.x; ty = pan.ty + e.clientY - pan.y; clamp(); apply();
    }
  }
  function up(e) {
    if (!pts.has(e.pointerId)) return;
    const p = pts.get(e.pointerId); pts.delete(e.pointerId);
    if (pinch) { if (pts.size < 2) pinch = null; if (s < 1.05) { s = 1; clamp(); apply(true); } return; }
    if (swipe) {
      const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y; swipe = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { show(idx + (dx < 0 ? 1 : -1)); return; }
      if (dy > 90 && Math.abs(dy) > Math.abs(dx)) { close(); return; }        // ปัดลง = ปิด
    }
    pan = null;
    // แตะสองครั้ง (นิ้ว)
    if (e.pointerType === 'touch') {
      const now = Date.now();
      if (now - tapT < 300 && Math.hypot(p.x - tapX, p.y - tapY) < 30) { zoomAt(s > 1 ? 1 : 2.5, p.x, p.y); tapT = 0; }
      else { tapT = now; tapX = p.x; tapY = p.y; }
    }
  }

  function show(i) {
    const n = items.length;
    idx = (i + n) % n;
    const it = items[idx];
    s = 1; tx = 0; ty = 0; apply();
    img.src = it.src; img.alt = it.alt || '';
    cap.textContent = it.cap || '';
    count.textContent = n > 1 ? (idx + 1) + ' / ' + n : '';
    btnPrev.hidden = btnNext.hidden = n < 2;
  }
  function open(list, i, o) {
    if (!box) build();
    items = list; opts = o || {}; lastFocus = document.activeElement;
    show(i || 0);
    box.hidden = false; document.documentElement.classList.add('zv-open');
    requestAnimationFrame(() => box.classList.add('in'));
    box.querySelector('.zv-close').focus();
  }
  function close() {
    if (!box || box.hidden) return;
    box.classList.remove('in'); box.hidden = true; document.documentElement.classList.remove('zv-open');
    pts.clear(); pinch = pan = swipe = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    if (opts.onClose) opts.onClose();
  }
  window.U = window.U || {};
  window.U.lightbox = open;
})();
