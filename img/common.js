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

  /* ---------- ตัวช่วยจับภาพ (html2canvas) ที่ "ไม่ค้าง": มี timeout ทุกขั้นตอน + ปิดแอนิเมชัน/เงา/blur ในฉากที่จับภาพ ---------- */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg || 'timeout')), ms))]);
  /** รอฟอนต์ไม่เกิน 2.5 วินาที (ฟอนต์จาก Google บนเน็ตช้า/ถูกบล็อกจะไม่ทำให้ค้างอีก) */
  const fontsReady = () => (document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready.catch(() => {}), sleep(2500)]) : Promise.resolve());
  /** รอรูปโหลด (ไม่เกิน ms) — รูปเสีย/ช้าจะข้ามไปแทนที่จะรอตลอดไป */
  const imgReady = (im, ms) => (im.complete && im.naturalWidth ? Promise.resolve() : Promise.race([new Promise((r) => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); }), sleep(ms || 6000)]));
  /** ในฉากที่ clone: ซ่อนทุกอย่างที่ไม่ใช่ตัวที่จะจับภาพ (ลดงานของ html2canvas) — ใช้เมื่อตำแหน่งตัวที่จับไม่ขึ้นกับ element อื่น */
  function isolateClone(doc, id) {
    let node = doc.getElementById(id);
    while (node && node !== doc.body) {
      Array.from(node.parentNode.children).forEach((sib) => { if (sib !== node && !/^(SCRIPT|STYLE|LINK)$/.test(sib.tagName)) sib.style.display = 'none'; });
      node = node.parentNode;
    }
  }
  const CAPTURE_CSS = '*,*::before,*::after{animation:none!important;transition:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;box-shadow:none!important}';
  async function capture(el, opts, timeoutMs) {
    const userClone = opts && opts.onclone;
    const o = Object.assign({ logging: false, useCORS: true, imageTimeout: 8000, removeContainer: true }, opts, {
      onclone: (doc, node) => {
        const s = doc.createElement('style'); s.textContent = CAPTURE_CSS; doc.head.appendChild(s);
        if (userClone) userClone(doc, node);
      },
    });
    try { return await withTimeout(window.html2canvas(el, o), timeoutMs || 60000, 'สร้างรูปนานเกินไป'); }
    catch (e) { throw e; }
  }
  /** จับภาพเสร็จแล้วคืนหน่วยความจำของ canvas ทันที (iPhone จำกัดหน่วยความจำ canvas) */
  const canvasToBlob = (cv) => new Promise((res) => cv.toBlob((b) => { cv.width = cv.height = 0; res(b); }, 'image/png'));

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
      g.fillStyle = '#FFFFFF'; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.font = 'italic 800 ' + Math.round(r2 * 1.0) + 'px Kanit, sans-serif';
      g.textAlign = 'left'; g.fillText(ch, R - g.measureText(ch).width / 2, R + r2 * 0.06);   // คำนวณกึ่งกลางเอง (iOS + ภาษาไทย)
    }
    c.style.cssText = 'display:block;margin:0 auto;width:' + size + 'px;height:' + size + 'px';
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
  const sweetLabel = (v) => (!v || v === '100%' ? 'หวานปกติ' : v === 'หวานหน่อย' ? 'หวานน้อย' : v);

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
    // qrcodejs ใส่ทั้ง canvas และ img แล้ว "ซ่อน canvas / โชว์ img" แบบอะซิงก์ทีหลัง (ครั้งแรกที่ตรวจ data-URI)
    // → เก็บแต่ canvas และบังคับให้โชว์ซ้ำหลังมันทำงานเสร็จ ไม่งั้น QR จะหายแต่ตอนดาวน์โหลดยังได้
    const fix = () => {
      const img = el.querySelector('img'); if (img) img.remove();
      const cv = el.querySelector('canvas'); if (cv) cv.style.display = 'block';
    };
    fix(); [0, 60, 250, 800].forEach((t) => setTimeout(fix, t));
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
    // เส้นเรียบทึบตามรูปเส้นทางจริง + เส้นรองจางๆ (ขอบเรือง + เงาเส้นเยื้อง) + จุดสตาร์ตแบบวงแหวน
    const o = Object.assign({ stroke: '#1B3B67', width: 2.1, ghost: 'rgba(94,101,115,.45)', ghostWidth: 0.55, glow: false, grid: 'rgba(15,34,68,.08)', start: '#FFFFFF' }, opts || {});
    const route = CFG.ROUTE;
    const pts = route.points.map((p) => p.join(',')).join(' ');
    const [sx, sy] = route.points[0];
    const grid = Array.from({ length: 9 }, (_, i) => `<line x1="${(i + 1) * 10}" y1="0" x2="${(i + 1) * 10}" y2="100"/><line x1="0" y1="${(i + 1) * 10}" x2="100" y2="${(i + 1) * 10}"/>`).join('');
    // เส้นรอง: ถนนรอบๆ ที่ไม่ได้วิ่ง (เทา/ขาวจางๆ อยู่ใต้เส้นหลัก)
    const ghost = (route.ghost || []).map((g) => `<polyline points="${g.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${o.ghost}" stroke-width="${o.ghostWidth}" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
    const line = (extra) => `<polyline points="${pts}" fill="none" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <g stroke="${o.grid}" stroke-width=".3">${grid}</g>
      ${ghost}
      ${o.glow ? line(`stroke="${o.stroke}" stroke-opacity=".16" stroke-width="${o.width * 3.4}"`) : ''}
      ${line(`stroke="${o.stroke}" stroke-width="${o.width}"`)}
      <circle cx="${sx}" cy="${sy}" r="3.7" fill="${o.start}" stroke="${o.stroke}" stroke-width=".9"/>
      <circle cx="${sx}" cy="${sy}" r="1.9" fill="${o.stroke}"/>
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
  /* ---------- ลิงก์ชวนเพื่อน: ?ref=R001 → จำไว้ในเครื่อง 30 วัน แล้วแนบตอนสมัคร ---------- */
  const REF_KEY = 'irc_ref';
  (function captureRef() {
    try {
      const v = (new URLSearchParams(location.search).get('ref') || '').toUpperCase();
      if (/^[A-Z]\d{3,5}$/.test(v)) localStorage.setItem(REF_KEY, JSON.stringify({ code: v, at: Date.now() }));
    } catch (e) { /* ignore */ }
  })();
  const ref = {
    get() {
      try {
        const o = JSON.parse(localStorage.getItem(REF_KEY) || 'null');
        return o && Date.now() - o.at < 30 * 864e5 ? o.code : '';
      } catch (e) { return ''; }
    },
    clear() { try { localStorage.removeItem(REF_KEY); } catch (e) { /* ignore */ } },
  };
  /** ลิงก์ชวนเพื่อนของ BIB นี้ (ชี้ไปหน้าแรกของเว็บ) */
  const inviteUrl = (bib) => location.origin + location.pathname.replace(/[^/]*$/, '') + '?ref=' + encodeURIComponent(bib);

  /* ---------- ธีมมืด / สว่าง (จำในเครื่อง · ค่าเริ่มต้นตามระบบของเครื่อง) ---------- */
  const THEME_KEY = 'irc_theme';
  const theme = {
    saved() { try { return localStorage.getItem(THEME_KEY) || ''; } catch (e) { return ''; } },
    current() { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; },
    set(t) {
      document.documentElement.dataset.theme = t;
      try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* ignore */ }
      const m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute('content', t === 'dark' ? '#070D1F' : '#FFFFFF');
    },
  };
  (function initTheme() {
    if (document.documentElement.dataset.theme) return;   // ตั้งไว้แล้วจากสคริปต์ใน <head>
    const t = theme.saved() || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = t;
  })();
  const themeIcon = () => (theme.current() === 'dark'
    ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>'
    : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7z"/></svg>');

  /* ---------- เอฟเฟกต์เลื่อนหน้า: องค์ประกอบค่อยๆ ลอยขึ้นเมื่อเลื่อนมาถึง ---------- */
  function reveal(root) {
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = $$('[data-reveal]', root || document);
    if (reduce || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((ents) => ents.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach((e, i) => {
      if (e.dataset.reveal === 'stagger') Array.from(e.children).forEach((c, j) => c.style.setProperty('--d', (j * 70) + 'ms'));
      io.observe(e);
    });
  }

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
        <nav class="nav-links">${links.map(([h, t]) => `<a href="${h}" class="${here === h ? 'on' : ''}">${t}</a>`).join('')}<button class="theme-btn" type="button" data-theme-btn aria-label="สลับโหมดมืด / สว่าง">${themeIcon()}</button>${acct}</nav>`;
    }
    // ปุ่มสลับธีม (หน้า admin/checkin ไม่มี data-nav → แทรกไว้ใน header)
    const head = $('.site-head');
    if (head && !head.querySelector('[data-theme-btn]')) {
      const b = document.createElement('button');
      b.className = 'theme-btn'; b.type = 'button'; b.setAttribute('data-theme-btn', ''); b.setAttribute('aria-label', 'สลับโหมดมืด / สว่าง');
      b.innerHTML = themeIcon();
      head.insertBefore(b, head.children[1] || null);
    }
    $$('[data-theme-btn]').forEach((b) => b.addEventListener('click', () => {
      document.documentElement.classList.add('theme-anim');
      theme.set(theme.current() === 'dark' ? 'light' : 'dark');
      $$('[data-theme-btn]').forEach((x) => { x.innerHTML = themeIcon(); });
      setTimeout(() => document.documentElement.classList.remove('theme-anim'), 450);
    }));
    reveal();
    // Footer มาตรฐาน (โลโก้ขาว + สโลแกน + ปุ่ม Admin) ทุกหน้าที่มี <footer class="site-foot">
    const foot = $('footer.site-foot');
    if (foot && !foot.querySelector('.admin-link')) {
      foot.innerHTML = `<div class="foot-in">
        <img src="img/logo-white.png" alt="INSTHINK RUN CLUB">
        ${document.querySelector('.sponsors') ? '' : '<img class="foot-spons" src="img/sponsors-row-white.webp" alt="ผู้สนับสนุน" loading="lazy">'}
        <div class="tagline">Insthink · Community · Coffee Run</div>
        <div class="foot-btns">
          <a class="btn btn-sm admin-link" href="admin.html">Admin</a>
          <a class="btn btn-sm admin-link" href="checkin.html">Staff เช็คอิน</a>
        </div>
        <div class="copy">© ${new Date().getFullYear()} INSTHINK RUN CLUB · ${esc(CFG.EVENT.hashtag || '')} · v20.25</div>
      </div>`;
    }
  }
  document.addEventListener('DOMContentLoaded', mountChrome);

  window.U = {
    $, $$, esc, toast, busy, normPhone, myBibs, pkg, pkgByPrefix, delivery, money,
    PAY_LABEL, payPill, checkinLabel, qrPayload, parseQr, renderQR, renderBarcode,
    promptPayPayload, compressImage, loading, saveImage, isMobile, compressAvatar, avatarHtml, canvasifyImages, avatarCanvas, sweetLabel, routeSvg, starSvg, fmtDate,
    ref, inviteUrl, theme, reveal, sleep, withTimeout, fontsReady, imgReady, isolateClone, capture, canvasToBlob,
  };
})();
