/**
 * =====================================================================
 *  Common helpers — ใช้ร่วมกันทุกหน้า
 * =====================================================================
 */
(function () {
  const CFG = window.APP_CONFIG;

  /** query selector สั้น ๆ */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /** กัน XSS ทุกครั้งที่เอาข้อมูลผู้ใช้ใส่ innerHTML */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** แจ้งเตือนด้านล่างจอ */
  function toast(msg, type) {
    let wrap = $('#toasts');
    if (!wrap) { wrap = document.createElement('div'); wrap.id = 'toasts'; document.body.appendChild(wrap); }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    wrap.appendChild(t);
    const ms = type === 'err' ? 6500 : 3400;   // ข้อความผิดพลาดค้างนานขึ้น จะได้อ่านทัน
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 500);
  }

  /** ปุ่มแสดงสถานะกำลังโหลด */
  function busy(btn, on, text) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>' + (text || 'กำลังโหลด…'); }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }

  /** หน้าจอ Loading เต็มจอ — ใช้ตอนรอเซิร์ฟเวอร์นาน ๆ (ส่งสลิป / สมัคร / สร้างรูป) */
  function loading(on, text, sub) {
    let el = $('#loadingOverlay');
    if (!on) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'loadingOverlay'; el.className = 'loading-overlay'; document.body.appendChild(el); }
    el.innerHTML = `<div class="lo-box"><span class="spinner"></span><b>${esc(text || 'Loading…')}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  }

  const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
  const blobToDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });

  /**
   * บันทึกรูป — คอมพิวเตอร์: ดาวน์โหลดไฟล์
   * มือถือ: เปิดหน้ารูปเต็มจอ (กดค้างที่รูปเพื่อบันทึก) + ปุ่ม "บันทึก / แชร์" ที่เปิดแผงแชร์ของเครื่อง
   * (มือถือหลายรุ่น และเบราว์เซอร์ในแอป LINE / IG / FB ไม่ยอมให้ดาวน์โหลดไฟล์ตรง ๆ)
   */
  async function saveImage(blob, name, onDone) {
    if (!blob) return;
    if (!isMobile()) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      if (onDone) setTimeout(onDone, 600);
      return;
    }
    const url = await blobToDataUrl(blob);
    const file = new File([blob], name, { type: blob.type || 'image/png' });
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    const inApp = /Line\/|FBAN|FBAV|Instagram|MicroMessenger|TikTok/i.test(navigator.userAgent);
    const sheet = document.createElement('div');
    sheet.className = 'save-sheet';
    sheet.innerHTML = `<div class="ss-in">
      <img src="${url}" alt="${esc(name)}">
      <button class="btn btn-light btn-xl" type="button" data-dl>ดาวน์โหลดรูปลงเครื่อง</button>
      <p>หรือ <b>กดค้างที่รูป</b> แล้วเลือก “บันทึกรูปภาพ / Save image”</p>
      ${inApp ? '<div class="ss-warn">คุณเปิดเว็บผ่านแอป LINE / Facebook / Instagram ซึ่งมักบล็อกการบันทึกรูป กด “คัดลอกลิงก์เว็บ” แล้วเปิดใน Safari หรือ Chrome จะบันทึกได้</div>' : ''}
      <div class="btn-row">
        ${canShare ? '<button class="btn btn-light" type="button" data-share>แชร์ / บันทึกลงอัลบั้ม</button>' : ''}
        ${inApp ? '<button class="btn btn-light" type="button" data-copy>คัดลอกลิงก์เว็บ</button>' : ''}
        <button class="btn btn-ghost" type="button" data-close>ปิด</button>
      </div></div>`;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', async (e) => {
      if (e.target.closest('[data-close]') || e.target === sheet) { sheet.remove(); if (onDone) onDone(); return; }
      if (e.target.closest('[data-dl]')) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
        toast('กำลังดาวน์โหลด ตรวจในโฟลเดอร์ ดาวน์โหลด / ไฟล์', 'ok');
        return;
      }
      if (e.target.closest('[data-copy]')) {
        try { await navigator.clipboard.writeText(location.origin + location.pathname.replace(/[^/]*$/, '')); toast('คัดลอกลิงก์แล้ว นำไปเปิดใน Safari / Chrome', 'ok'); }
        catch (err) { toast('คัดลอกไม่ได้ กดค้างที่ช่องที่อยู่เว็บเพื่อคัดลอก', 'err'); }
        return;
      }
      if (e.target.closest('[data-share]')) {
        try { await navigator.share({ files: [file] }); } catch (err) { /* ผู้ใช้ยกเลิก — ยังกดค้างบันทึกได้ */ }
      }
    });
  }

  /**
   * html2canvas บางเครื่องไม่วาดรูปที่ฝังเป็น data: URL (รูปโปรไฟล์ / QR) → ได้กรอบเปล่า
   * แก้: ในฉากที่จะจับภาพ แทน <img data:> ด้วย <canvas> ที่วาดจากรูปต้นฉบับ (วาดได้แน่นอน)
   * ใช้: html2canvas(el, { onclone: U.canvasifyImages(el) })
   */
  function canvasifyImages(origRoot) {
    const origs = Array.from(origRoot.querySelectorAll('img')).map((im) => ({ im, w: im.getBoundingClientRect().width, h: im.getBoundingClientRect().height }));
    return (doc) => {
      const root = doc.getElementById(origRoot.id) || doc.body;
      Array.from(root.querySelectorAll('img')).forEach((clone, i) => {
        const o = origs[i];
        if (!o || !/^data:/.test(clone.getAttribute('src') || '') || !o.im.naturalWidth) return;
        const c = doc.createElement('canvas');
        c.width = o.im.naturalWidth; c.height = o.im.naturalHeight;
        c.getContext('2d').drawImage(o.im, 0, 0);
        c.className = clone.className;
        c.style.cssText = 'display:block;width:' + o.w + 'px;height:' + o.h + 'px';
        clone.parentNode.replaceChild(c, clone);
      });
    };
  }

  /**
   * วาดวงกลมรูปโปรไฟล์ลง <canvas> เอง (ไม่พึ่ง html2canvas) — รูปไม่มี/โหลดไม่ได้ → วงกลมกรมท่า + ตัวอักษรแรก
   * size = เส้นผ่านศูนย์กลางรวมขอบ (px) · border = ขอบขาว · ring = เส้นกรมท่านอกสุด
   */
  async function avatarCanvas(runner, size, border, ring) {
    const S = 3, px = size * S;
    const c = document.createElement('canvas'); c.width = c.height = px;
    const g = c.getContext('2d');
    const R = px / 2, ringPx = (ring || 0) * S, bPx = (border || 0) * S;
    g.fillStyle = '#1B3B67'; g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.fill();            // ring
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(R, R, R - ringPx, 0, Math.PI * 2); g.fill();   // border
    const r2 = R - ringPx - bPx;
    g.save(); g.beginPath(); g.arc(R, R, r2, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#1B3B67'; g.fillRect(0, 0, px, px);
    let drawn = false;
    if (runner && runner.photo) {
      const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = runner.photo; });
      if (im && im.naturalWidth) {
        const side = Math.min(im.naturalWidth, im.naturalHeight);
        g.drawImage(im, (im.naturalWidth - side) / 2, (im.naturalHeight - side) / 2, side, side, R - r2, R - r2, r2 * 2, r2 * 2);
        drawn = true;
      } else console.warn('avatar: รูปโปรไฟล์โหลดไม่ได้');
    }
    g.restore();
    if (!drawn) {
      const ch = String((runner && (runner.nickname || runner.firstName)) || '?').charAt(0).toUpperCase();
      g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'italic 800 ' + Math.round(r2 * 1.0) + 'px Kanit, sans-serif';
      g.fillText(ch, R, R + r2 * 0.06);
    }
    c.style.cssText = 'display:block;width:' + size + 'px;height:' + size + 'px';
    return c;
  }

  /** แจ้งเตือนอัตโนมัติเมื่อสคริปต์ของหน้าเว็บพัง (แทนที่จะเงียบ แล้วฟอร์มรีโหลดเอง) */
  window.addEventListener('error', (e) => { if (e.message) toast('หน้าเว็บมีข้อผิดพลาด: ' + e.message, 'err'); });
  window.addEventListener('unhandledrejection', (e) => toast('เกิดข้อผิดพลาด: ' + ((e.reason && e.reason.message) || e.reason), 'err'));

  /** เบอร์โทร: เหลือเฉพาะตัวเลข และแปลง +66 / 66 เป็น 0 (เบราว์เซอร์มือถือมักกรอกให้ในรูปแบบ +66) */
  function normPhone(v) {
    let s = String(v || '').replace(/\D/g, '');
    if (s.startsWith('660')) s = s.slice(2);                          // +66 0812345678 → 0812345678
    else if (s.startsWith('66') && s.length >= 10) s = '0' + s.slice(2); // +66 812345678 → 0812345678
    return s.slice(0, 10);
  }

  /* ---------- รายการของฉัน (จำไว้ในเครื่องที่สมัคร) ---------- */
  const MY_KEY = 'irc_my_bibs';
  const myBibs = {
    all() { try { return JSON.parse(localStorage.getItem(MY_KEY)) || []; } catch (e) { return []; } },
    add(bib, token) {
      const list = myBibs.all().filter((x) => x.bib !== bib);
      list.unshift({ bib, token });
      try { localStorage.setItem(MY_KEY, JSON.stringify(list.slice(0, 10))); } catch (e) { /* ignore */ }
    },
    remove(bib) { try { localStorage.setItem(MY_KEY, JSON.stringify(myBibs.all().filter((x) => x.bib !== bib))); } catch (e) { /* ignore */ } },
    token(bib) { const f = myBibs.all().find((x) => x.bib === bib); return f ? f.token : ''; },
  };

  /** ความหวาน: ข้อมูลเก่าเก็บเป็น '100%' → แสดงเป็น หวานปกติ */
  const sweetLabel = (v) => (!v || v === '100%' ? 'หวานปกติ' : v);

  /* ---------- แพ็กเกจ / สถานะ ---------- */
  const pkg = (code) => CFG.PACKAGES.find((p) => p.code === code) || CFG.PACKAGES[0];
  const pkgByPrefix = (bib) => CFG.PACKAGES.find((p) => p.prefix === String(bib || '').charAt(0)) || CFG.PACKAGES[0];
  const delivery = (code) => CFG.DELIVERY.find((d) => d.code === code) || CFG.DELIVERY[0];
  const money = (n) => Number(n || 0).toLocaleString('th-TH') + ' ฿';

  const PAY_LABEL = { UNPAID: 'รอชำระเงิน', SLIP_UPLOADED: 'รอตรวจสอบสลิป', PAID: 'ชำระแล้ว', REJECTED: 'แอดมินปฏิเสธ' };
  const PAY_CLASS = { UNPAID: 'warn', SLIP_UPLOADED: 'info', PAID: 'ok', REJECTED: 'bad' };
  const payPill = (s) => `<span class="pill ${PAY_CLASS[s] || ''}">${PAY_LABEL[s] || s || '-'}</span>`;
  const checkinLabel = (r) => (pkg(r.package).runner ? (r.status === 'CHECKED_IN' ? 'เช็คอินแล้ว' : 'ยังไม่เช็คอิน') : (r.status === 'CHECKED_IN' ? 'รับของแล้ว' : 'ยังไม่รับของ'));

  /* ---------- QR / Barcode ---------- */
  /** ข้อความใน QR: IRC|BIB|TOKEN — หน้า checkin อ่านรูปแบบนี้ */
  const qrPayload = (r) => 'IRC|' + r.bib + '|' + (r.token || '');

  function parseQr(text) {
    const s = String(text || '').trim();
    const m = s.match(/^IRC\|([A-Z]\d{3,5})\|([a-z0-9]*)$/i);
    if (m) return { bib: m[1].toUpperCase(), token: m[2] };
    if (/^[A-Z]\d{3,5}$/i.test(s)) return { bib: s.toUpperCase(), token: '' }; // barcode = เลขอย่างเดียว
    return null;
  }

  /** วาด QR ลงใน element (qrcodejs → <canvas> ที่ html2canvas จับภาพได้) */
  function renderQR(el, text, size, dark, light) {
    el.innerHTML = '';
    new QRCode(el, {
      text, width: size || 160, height: size || 160,
      colorDark: dark || '#0A0A0A', colorLight: light || '#FFFFFF',
      correctLevel: QRCode.CorrectLevel.M,
    });
    const img = el.querySelector('img'); if (img) img.remove();   // qrcodejs ใส่ทั้ง canvas และ img
    const cv = el.querySelector('canvas'); if (cv) cv.style.display = 'block';
  }

  function renderBarcode(svg, bib, opts) {
    JsBarcode(svg, bib, Object.assign({
      format: 'CODE128', displayValue: false, height: 44, margin: 0, width: 2,
      background: 'transparent', lineColor: '#0A0A0A',
    }, opts || {}));
  }

  /* ---------- PromptPay QR (มาตรฐาน EMVCo / Thai QR Payment) ---------- */
  function crc16(s) {
    let crc = 0xFFFF;
    for (let i = 0; i < s.length; i++) {
      crc ^= s.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  /** id = เบอร์มือถือ / เลขบัตร ปชช. 13 หลัก / e-wallet 15 หลัก, amount = จำนวนเงิน (บาท) */
  function promptPayPayload(id, amount) {
    const f = (tag, v) => tag + String(v.length).padStart(2, '0') + v;
    const t = String(id || '').replace(/\D/g, '');
    let acc;
    if (t.length >= 15) acc = f('03', t);
    else if (t.length >= 13) acc = f('02', t);
    else acc = f('01', ('0000000000000' + t.replace(/^0/, '66')).slice(-13));
    const body = f('00', '01') + f('01', amount ? '12' : '11') +
      f('29', f('00', 'A000000677010111') + acc) +
      f('58', 'TH') + f('53', '764') + (amount ? f('54', Number(amount).toFixed(2)) : '') + '6304';
    return body + crc16(body);
  }

  /* ---------- ย่อรูปสลิปก่อนอัปโหลด (ลดขนาดเหลือ ~100–300KB) ---------- */
  function compressImage(file, max, quality) {
    max = max || 1200;
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('กรุณาเลือกไฟล์รูปภาพ'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        const x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality || 0.78));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('เปิดไฟล์รูปไม่ได้ ลองบันทึกเป็น JPG แล้วอัปโหลดใหม่')); };
      img.src = url;
    });
  }

  /** รูปโปรไฟล์: ครอปกลางเป็นสี่เหลี่ยมจัตุรัส 320px แล้วลดคุณภาพจนไฟล์ ≤ ~34KB (เก็บในชีตได้) */
  function compressAvatar(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('กรุณาเลือกไฟล์รูปภาพ'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const size = 320, side = Math.min(img.width, img.height);
        const c = document.createElement('canvas'); c.width = c.height = size;
        const x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, size, size);
        x.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        URL.revokeObjectURL(url);
        let q = 0.82, out = c.toDataURL('image/jpeg', q);
        while (out.length > 42000 && q > 0.3) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
        out.length > 44000 ? reject(new Error('รูปซับซ้อนเกินไป ลองเลือกรูปอื่น')) : resolve(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('เปิดไฟล์รูปไม่ได้ ลองบันทึกเป็น JPG แล้วอัปโหลดใหม่')); };
      img.src = url;
    });
  }

  /** วงกลมรูปโปรไฟล์ (ไม่มีรูป → ตัวอักษรแรกของชื่อ) */
  function avatarHtml(m, cls) {
    const ini = esc(String((m && (m.nickname || m.firstName)) || '?').charAt(0).toUpperCase());
    return `<span class="avatar ${cls || ''}">${m && m.photo ? `<img src="${esc(m.photo)}" alt="">` : ini}</span>`;
  }

  /* ---------- เส้นทางวิ่ง → SVG ---------- */
  function routeSvg(opts) {
    const o = Object.assign({ stroke: '#1B3B67', dash: '#FFFFFF', width: 3.2, glow: true, grid: 'rgba(15,34,68,.08)', start: '#FFFFFF' }, opts || {});
    const route = CFG.ROUTE;
    const pts = route.points.map((p) => p.join(',')).join(' ');
    const [sx, sy] = route.points[0];
    const grid = Array.from({ length: 9 }, (_, i) => `<line x1="${(i + 1) * 10}" y1="0" x2="${(i + 1) * 10}" y2="100"/><line x1="0" y1="${(i + 1) * 10}" x2="100" y2="${(i + 1) * 10}"/>`).join('');
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <g stroke="${o.grid}" stroke-width=".3">${grid}</g>
      ${o.glow ? `<polyline points="${pts}" fill="none" stroke="${o.stroke}" stroke-opacity=".18" stroke-width="${o.width * 3}" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
      <polyline points="${pts}" fill="none" stroke="${o.stroke}" stroke-width="${o.width}" stroke-linejoin="round" stroke-linecap="round"/>
      <polyline points="${pts}" fill="none" stroke="${o.dash}" stroke-width="${o.width * 0.28}" stroke-dasharray="1.5 3" stroke-linecap="round"/>
      <circle cx="${sx}" cy="${sy}" r="4.2" fill="${o.start}" stroke="${o.stroke}" stroke-width="1.6"/>
      <circle cx="${sx}" cy="${sy}" r="1.6" fill="${o.stroke}"/>
    </svg>`;
  }

  /** ดาว 5 แฉก (ลวดลายจากโลโก้) */
  const starSvg = (fill) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="${fill || 'currentColor'}" d="M12 1.8l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 9l7.1-.6z"/></svg>`;

  function fmtDate(iso, withTime) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const opt = withTime ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' };
    return d.toLocaleString('th-TH', opt);
  }

  /** เติม header (เมนู + บัญชี) และปุ่ม Admin ท้ายเว็บ ให้ทุกหน้า */
  function mountChrome() {
    const nav = $('[data-nav]');
    if (nav) {
      const here = location.pathname.split('/').pop() || 'index.html';
      const links = [['register.html', 'สมัครวิ่ง'], ['search.html', 'ค้นหา'], ['profile.html', 'ของฉัน']];
      const m = Auth.member();
      const acct = Auth.loggedIn()
        ? `<a class="acct-link" href="account.html" aria-label="บัญชีของฉัน">${avatarHtml(m, 'sm')}</a>`
        : `<a class="btn btn-sm btn-dark" href="login.html">เข้าสู่ระบบ</a>`;
      nav.innerHTML = `
        <a class="brand" href="index.html" aria-label="INSTHINK RUN CLUB"><img src="img/logo.png" alt="INSTHINK RUN CLUB"></a>
        <nav class="nav-links">${links.map(([h, t]) => `<a href="${h}" class="${here === h ? 'on' : ''}">${t}</a>`).join('')}${acct}</nav>`;
    }
    // Footer มาตรฐาน (โลโก้ขาว + สโลแกน + ปุ่ม Admin) ทุกหน้าที่มี <footer class="site-foot">
    const foot = $('footer.site-foot');
    if (foot && !foot.querySelector('.admin-link')) {
      foot.innerHTML = `<div class="foot-in">
        <img src="img/logo-white.png" alt="INSTHINK RUN CLUB">
        <div class="tagline">Insthink · Community · Coffee Run</div>
        <div class="foot-btns">
          <a class="btn btn-sm admin-link" href="admin.html">Admin</a>
          <a class="btn btn-sm admin-link" href="checkin.html">Staff เช็คอิน</a>
        </div>
        <div class="copy">© ${new Date().getFullYear()} INSTHINK RUN CLUB · ${esc(CFG.EVENT.hashtag || '')}</div>
      </div>`;
    }
  }
  document.addEventListener('DOMContentLoaded', mountChrome);

  window.U = {
    $, $$, esc, toast, busy, normPhone, myBibs, pkg, pkgByPrefix, delivery, money,
    PAY_LABEL, payPill, checkinLabel, qrPayload, parseQr, renderQR, renderBarcode,
    promptPayPayload, compressImage, loading, saveImage, isMobile, compressAvatar, avatarHtml, canvasifyImages, avatarCanvas, sweetLabel, routeSvg, starSvg, fmtDate,
  };
})();
