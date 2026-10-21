/**
 * =====================================================================
 *  หน้าเช็คอิน (checkin.html) — สำหรับเจ้าหน้าที่หน้างาน
 *  นักวิ่ง = เช็คอิน + รับผ้าโพกหัว · ออเดอร์ผ้าโพกหัว (รับที่งาน) = บันทึกการรับของ
 *  backend ปฏิเสธรายการที่ยังไม่ชำระเงิน
 *  สแกน QR (IRC|BIB|TOKEN) หรือ Barcode (BIB) → action "checkin"
 *  → backend อัปเดตคอลัมน์ status/checkinAt ใน Google Sheets ทันที
 * =====================================================================
 */
(function () {
  const { $, esc, toast, busy, parseQr, pkg, delivery, fmtDate } = window.U;
  const KEY = 'irc_staff_key';
  const NAME = 'irc_staff_name';
  let key = sessionStorage.getItem(KEY) || '';
  let scanner = null;
  let lastCode = '', lastAt = 0, working = false, count = 0;

  /* ---------- Login ---------- */
  $('#staffName').value = localStorage.getItem(NAME) || '';

  async function enter(k) {
    await API.call('auth', { key: k });
    key = k;
    sessionStorage.setItem(KEY, k);
    $('#gate').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#logoutBtn').classList.remove('hidden');
  }

  $('#gate').addEventListener('submit', async (e) => {
    e.preventDefault();
    localStorage.setItem(NAME, $('#staffName').value.trim());
    busy($('#gateBtn'), true, 'ตรวจสอบ…');
    try { await enter($('#staffKey').value.trim()); }
    catch (err) { toast(err.message, 'err'); }
    finally { busy($('#gateBtn'), false); }
  });

  $('#logoutBtn').addEventListener('click', () => { sessionStorage.removeItem(KEY); location.reload(); });

  if (key) enter(key).catch(() => sessionStorage.removeItem(KEY));

  /* ---------- เสียงแจ้งผล (Web Audio — ไม่ต้องมีไฟล์เสียง) ---------- */
  let ac = null;
  function beep(ok) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = ok ? 1046 : 220;
      o.type = ok ? 'sine' : 'square';
      g.gain.setValueAtTime(0.18, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + (ok ? 0.18 : 0.4));
      o.connect(g).connect(ac.destination);
      o.start(); o.stop(ac.currentTime + 0.4);
      if (navigator.vibrate) navigator.vibrate(ok ? 80 : [100, 60, 100]);
    } catch (e) { /* ignore */ }
  }

  /* ---------- แสดงผลการเช็คอิน ---------- */
  function show(kind, big, html) {
    const el = $('#result');
    el.className = 'scan-result ' + kind;
    el.innerHTML = `<div class="big">${big}</div>${html || ''}`;
  }

  function runnerTags(r) {
    const p = pkg(r.package);
    const d = delivery(r.delivery);
    const tags = [`<span class="tag"><b>${esc(p.label)}</b></span>`];
    if (d.code === 'SHIP') tags.push(`<span class="tag">ผ้าโพกหัว: <b>${r.shipStatus === 'SHIPPED' ? 'จัดส่งแล้ว' : 'รอจัดส่ง'}</b> (ไม่ต้องมอบที่งาน)</span>`);
    else tags.push('<span class="tag">มอบ <b>ผ้าโพกหัว 1 ผืน</b></span>');
    if (p.runner) tags.push(`<span class="tag">เครื่องดื่ม: <b>${esc(r.drink)}</b> · หวาน ${esc(r.sweetness || '100%')}</span>`);
    return `<p style="margin:8px 0 0;font-size:20px;font-weight:500">${esc(r.firstName)} ${esc(r.lastName)} ${r.nickname ? '(' + esc(r.nickname) + ')' : ''}</p>
      <div class="tags">${tags.join('')}</div>`;
  }

  function addLog(bib, text) {
    const log = $('#log');
    if (log.querySelector('.muted')) log.innerHTML = '';
    const row = document.createElement('div');
    row.innerHTML = `<b style="font-weight:800;font-style:italic;color:var(--navy)">${esc(bib)}</b><span>${esc(text)}</span><span class="muted">${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>`;
    log.prepend(row);
  }

  /* ---------- เช็คอิน ---------- */
  async function handle(text) {
    const now = Date.now();
    if (working || (text === lastCode && now - lastAt < 4000)) return; // กันสแกนซ้ำรัว ๆ
    lastCode = text; lastAt = now;

    const p = parseQr(text);
    if (!p) { beep(false); show('bad', 'INVALID', '<p>QR นี้ไม่ใช่ E-BIB ของงาน</p>'); return; }

    working = true;
    show('', p.bib, '<p class="muted"><span class="spinner"></span> กำลังบันทึก…</p>');
    try {
      const res = await API.call('checkin', { key, bib: p.bib, token: p.token, by: localStorage.getItem(NAME) || '' });
      if (res.already) {
        beep(false);
        show('warn', 'ALREADY IN', `<p style="margin:4px 0 0">${esc(p.bib)} · เช็คอินไปแล้วเมื่อ ${esc(fmtDate(res.runner.checkinAt, true))}</p>` + runnerTags(res.runner));
        addLog(p.bib, 'ซ้ำ');
      } else {
        beep(true);
        count++;
        $('#countToday').textContent = count + ' คน';
        show('ok', '✓ ' + esc(p.bib), runnerTags(res.runner));
        addLog(p.bib, res.runner.firstName);
      }
    } catch (err) {
      beep(false);
      show('bad', 'ERROR', `<p>${esc(err.message)}</p>`);
    } finally {
      working = false;
    }
  }

  /* ---------- กล้อง (html5-qrcode) — ต้องเปิดผ่าน HTTPS ---------- */
  $('#camBtn').addEventListener('click', async () => {
    const btn = $('#camBtn');
    if (scanner && scanner.isScanning) {
      await scanner.stop();
      btn.textContent = 'เปิดกล้องสแกน';
      return;
    }
    try {
      scanner = scanner || new Html5Qrcode('reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128],
        verbose: false,
      });
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.7); return { width: s, height: s }; } },
        (text) => handle(text),
        () => { /* ไม่เจอโค้ดในเฟรมนี้ — ไม่ต้องทำอะไร */ }
      );
      btn.textContent = 'ปิดกล้อง';
    } catch (err) {
      toast('เปิดกล้องไม่ได้: ตรวจสอบสิทธิ์กล้อง และต้องเปิดเว็บผ่าน https://', 'err');
    }
  });

  /* ---------- พิมพ์ BIB เอง (กรณีกล้องมีปัญหา) ---------- */
  $('#manualForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#manualBib').value.trim().toUpperCase();
    if (!/^[A-Z]\d{4}$/.test(v)) return toast('รูปแบบเลข เช่น R0012', 'err');
    lastCode = ''; // อนุญาตให้กดซ้ำได้
    handle(v);
    $('#manualBib').value = '';
  });
})();
