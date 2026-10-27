/**
 * =====================================================================
 *  หน้าแรก (index.html) — รายละเอียดงานอย่างเดียว ปุ่มสมัครพาไป register.html
 *  ข้อมูลทั้งหมดดึงจาก config.js → เปิดอีเวนต์ใหม่แค่แก้ config + รูปใน img/
 * =====================================================================
 */
(function () {
  const CFG = window.APP_CONFIG;
  const U = window.U;
  const { $, $$ } = U;

  $('#evEdition').textContent = CFG.EVENT.edition;
  $('#evDate').textContent = CFG.EVENT.dateLabel;
  $('#evTime').textContent = CFG.EVENT.startTime + ' น.';
  $('#evLoc').textContent = CFG.EVENT.location;
  // ปุ่มนำทาง (Google Maps) — ไม่มีลิงก์ = ซ่อนปุ่ม
  if (CFG.EVENT.mapUrl) { $('#evLocLink').href = CFG.EVENT.mapUrl; $('#mapBtn').href = CFG.EVENT.mapUrl; }
  else { $('#mapBtn').remove(); $('#evLocLink').removeAttribute('href'); }

  // ตารางเวลาวันงาน
  $('#tlDate').textContent = CFG.EVENT.dateLabel + ' · ' + CFG.EVENT.location;
  $('#timeline').innerHTML = (CFG.EVENT.schedule || []).map((s) => `<li class="${s.time === CFG.EVENT.startTime ? 'key' : ''}">
    <time>${U.esc(s.time || '')}</time><i></i><div><b>${U.esc(s.title)}</b>${s.desc ? `<span>${U.esc(s.desc)}</span>` : ''}</div></li>`).join('');
  $('#stTime').textContent = CFG.EVENT.startTime;
  $('#heroStars').innerHTML = '<img src="img/stars-navy.png" alt="">';

  // เส้นทาง
  $('#homeRoute').innerHTML = window.U.routeSvg({ stroke: '#7FDDF5', ghost: 'rgba(255,255,255,.38)', glow: false, start: '#0A1430', grid: 'rgba(255,255,255,.06)', width: 2.6 });
  $('#homeRouteName').textContent = CFG.ROUTE.name;
  $('#homeRouteLoc').textContent = CFG.EVENT.location + ' · ปล่อยตัว ' + CFG.EVENT.startTime + ' น.';

  /* ---------- กระดานผู้นำ: ชวนเพื่อนมากที่สุด Top N ---------- */
  (function leaderboard() {
    const R = CFG.REFERRAL || {}; let n = R.topN || 5;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const box = $('#lbPrizeBox'); if (!box) return;
    const prize = R.prize || 'รางวัลพิเศษ';
    $('#lbPrize').textContent = prize;
    $('#lbPrizeNote').textContent = R.prizeNote || '';
    $('#lbRule').textContent = R.rule || '';
    if (R.badge) { const bd = $('#lbBadge'); bd.textContent = R.badge; bd.hidden = false; }
    if (R.prizeImg) { const im = $('#lbPrizeImg'); im.src = R.prizeImg; im.hidden = false; }
    const setN = (v) => { $('#lbN').textContent = v; };
    const intro = () => { $('#lbIntro').textContent = 'ชวนเพื่อนมาวิ่งผ่านลิงก์ของคุณ ' + n + ' อันดับที่ชวนได้มากที่สุดรับ ' + prize; };
    intro(); setN(n);
    $('#lbScarce').textContent = 'LIMITED · มีเพียง ' + n + ' ใบเท่านั้น';

    /* (3) ตัวเลข TOP N ไล่ขึ้นทีละตัวตอนเลื่อนเข้าจอ */
    if (!reduce && 'IntersectionObserver' in window) {
      setN(0);
      const io = new IntersectionObserver((es) => {
        if (!es[0].isIntersecting) return; io.disconnect();
        let c = 0; const t = setInterval(() => { c++; setN(Math.min(c, n)); if (c >= n) clearInterval(t); }, 150);
      }, { threshold: 0.4 });
      io.observe(box);
    }

    /* (4) Parallax: รูปขยับช้ากว่าการเลื่อนหน้าจอ + ขยับตามเมาส์บนเดสก์ท็อป */
    if (!reduce) {
      let raf = 0;
      const tick = () => {
        raf = 0; const r = box.getBoundingClientRect(), vh = innerHeight;
        if (r.bottom < -80 || r.top > vh + 80) return;
        const off = (r.top + r.height / 2 - vh / 2) / vh;       // -1..1
        box.style.setProperty('--py', Math.max(-16, Math.min(16, off * -26)).toFixed(1) + 'px');
      };
      addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(tick); }, { passive: true });
      addEventListener('resize', tick); tick();
      box.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return; const r = box.getBoundingClientRect();
        box.style.setProperty('--px', (((e.clientX - r.left) / r.width - .5) * -14).toFixed(1) + 'px');
      });
      box.addEventListener('pointerleave', () => box.style.setProperty('--px', '0px'));
    }

    let me = null;
    const draw = (top) => {
      const rows = [];
      for (let i = 0; i < n; i++) {
        const o = top[i];
        rows.push(o
          ? `<li class="${i < 3 ? 'p' + (i + 1) : ''} ${me && me.bib && o.bib === me.bib ? 'me' : ''}"><i>${i + 1}</i><span>${U.esc(o.nickname || o.bib)}${me && me.bib && o.bib === me.bib ? ' <small class="you">คุณ</small>' : ''}</span><em>${o.count}<small> คน</small></em></li>`
          : `<li class="empty"><i>${i + 1}</i><span>ว่าง · รอคุณขึ้นมา</span><em>–</em></li>`);
      }
      $('#lbList').innerHTML = rows.join('');
    };

    /* (8) การ์ดอันดับของฉัน (เฉพาะคนที่ล็อกอิน) */
    const drawMe = (m, topN) => {
      const el = $('#lbMe'); if (!m) { el.hidden = true; return; }
      let html = '';
      if (!m.hasRun) html = '<span>สมัครวิ่งก่อน เพื่อรับลิงก์ชวนเพื่อนและลุ้นรับ' + U.esc(prize) + '</span><a class="lb-me-btn" href="register.html">สมัครวิ่ง</a>';
      else {
        const lead = m.inTop ? 'คุณอยู่อันดับ <b>' + m.rank + '</b> · ชวนแล้ว ' + m.count + ' คน — รักษาอันดับไว้!'
          : m.count > 0 ? 'คุณอยู่อันดับ <b>' + m.rank + '</b> · ชวนอีก <b>' + m.need + '</b> คนเข้า Top ' + topN
          : 'ยังไม่มีเพื่อนชำระเงินผ่านลิงก์ของคุณ · ชวนอีก <b>' + m.need + '</b> คนเข้า Top ' + topN;
        html = '<span>' + lead + '</span><button class="lb-me-btn" type="button" id="lbCopy">คัดลอกลิงก์ชวน</button>';
      }
      el.innerHTML = html; el.hidden = false;
      const cp = $('#lbCopy');
      if (cp) cp.addEventListener('click', async () => {
        const url = U.inviteUrl(m.bib);
        try { await navigator.clipboard.writeText(url); } catch (e) { const t = document.createElement('input'); t.value = url; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e2) { /* ignore */ } t.remove(); }
        cp.textContent = 'คัดลอกแล้ว'; setTimeout(() => { cp.textContent = 'คัดลอกลิงก์ชวน'; }, 1800);
      });
    };

    /* (9) ข่าวไต่อันดับ: เทียบกับครั้งล่าสุดที่เครื่องนี้เห็น (เฉพาะข้อมูลจริงจากชีต) */
    const news = (top) => {
      const KEY = 'irc_lb_prev'; let prev = null;
      try { prev = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* ignore */ }
      if (prev && prev.length) {
        const lines = [];
        top.forEach((o) => {
          const p = prev.find((x) => x.bib === o.bib), nm = U.esc(o.nickname || o.bib);
          if (!p) lines.push('<b>' + nm + '</b> เข้าสู่ Top ' + n + ' อันดับ ' + o.rank);
          else if (o.rank < p.rank) lines.push('<b>' + nm + '</b> แซงขึ้นอันดับ ' + o.rank);
        });
        if (lines.length) {
          const el = $('#lbNews'); el.innerHTML = lines.slice(0, 2).map((l) => '<div>' + l + '</div>').join(''); el.hidden = false;
          setTimeout(() => { el.classList.add('fade'); setTimeout(() => { el.hidden = true; }, 700); }, 9000);
        }
      }
      try { localStorage.setItem(KEY, JSON.stringify(top.map((o) => ({ bib: o.bib, rank: o.rank })))); } catch (e) { /* ignore */ }
    };

    draw([]);
    window.API.call('leaderboard', {}).then((d) => {
      d = d || {}; me = d.me || null;
      if (d.topN && d.topN !== n) { n = d.topN; setN(n); intro(); $('#lbScarce').textContent = 'LIMITED · มีเพียง ' + n + ' ใบเท่านั้น'; }
      draw(d.top || []); drawMe(me, n); news(d.top || []);
    }).catch(() => { /* ไม่ต้องรบกวนผู้ใช้ถ้าโหลดไม่ได้ */ });
  })();

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

/* วิดีโอหน้าแรก: เครื่องที่ตั้ง "ลดการเคลื่อนไหว" = หยุดที่ภาพนิ่ง / บางเครื่องบล็อกเล่นอัตโนมัติ = ลองสั่งเล่นอีกครั้ง */
(function () {
  const v = document.querySelector('.bs-video'); if (!v) return;
  v.muted = true;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { v.removeAttribute('autoplay'); v.pause(); return; }
  const tryPlay = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
  tryPlay();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tryPlay(); });
})();
