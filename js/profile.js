/**
 * =====================================================================
 *  หน้า "ของฉัน" (profile.html?bib=R001)
 *  - ยืนยันตัวตน: บัญชีที่ล็อกอิน / token ในเครื่อง / ลิงก์อีเมล (?t=) / เบอร์โทร 4 ตัวท้าย
 *  - ชำระเงิน: PromptPay QR ตามยอดจริง + แนบสลิป (ย่อรูปก่อนส่ง)
 *  - นักวิ่ง: E-BIB (QR ใช้งานได้เมื่อชำระแล้ว) + เส้นทาง + IG Story
 *  - ออเดอร์ผ้าโพกหัว: สถานะการชำระ/จัดส่ง
 * =====================================================================
 */
(function () {
  const CFG = window.APP_CONFIG;
  const U = window.U;
  const { $, esc, toast, busy, loading, myBibs, pkg, pkgByPrefix, delivery, money, PAY_LABEL, payPill, checkinLabel, fmtDate } = U;

  const params = new URLSearchParams(location.search);
  const bib = (params.get('bib') || '').toUpperCase();
  let auth = {};          // { token } หรือ { phone4 }
  let runner = null;
  let slipData = '';
  let storyBlob = null;

  /* ---------- ไม่มีเลขใน URL → รายการในเครื่อง ---------- */
  if (!bib) {
    $('#pickView').classList.remove('hidden');
    const paint = () => {
      const list = myBibs.all();
      $('#pickEmpty').classList.toggle('hidden', list.length > 0);
      $('#myList').innerHTML = list.map((x) => {
        const p = pkgByPrefix(x.bib);
        return `<div class="result-wrap"><a class="result" href="profile.html?bib=${encodeURIComponent(x.bib)}">
          <span class="bib-tag ${p.runner ? '' : 'm'}">${esc(x.bib)}</span>
          <span class="who"><b>${esc(p.title)}</b><span>แตะเพื่อเปิด</span></span><span>→</span></a>
          <button class="result-del" type="button" data-del="${esc(x.bib)}">ลบออก</button></div>`;
      }).join('');
    };
    paint();
    $('#myList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-del]');
      if (b && confirm('ลบ ' + b.dataset.del + ' ออกจากรายการในเครื่องนี้?\n(ข้อมูลการสมัครยังอยู่ในระบบ เปิดกลับได้ด้วยการล็อกอิน หรือเบอร์โทร 4 ตัวท้าย)')) { myBibs.remove(b.dataset.del); paint(); }
    });
    // ล็อกอินอยู่ → ดึงรายการจริงจากบัญชี (ตัดรายการเก่าที่ไม่มีในระบบแล้ว)
    if (Auth.loggedIn()) {
      API.call('myRegs', {}).then(({ regs }) => {
        localStorage.setItem('irc_my_bibs', JSON.stringify(regs.map((r) => ({ bib: r.bib, token: r.token || '' }))));
        paint();
      }).catch(() => {});
    }
    return;
  }

  /* ---------- ยืนยันตัวตน + โหลดข้อมูล ---------- */
  async function load(a) {
    U.loading(true, 'กำลังโหลดข้อมูล…', 'รอสักครู่');
    try {
      const { runner: r } = await API.call('get', Object.assign({ bib }, a));
      auth = a;
      runner = r;
      if (r.token) { myBibs.add(r.bib, r.token); auth = { token: r.token }; }
      render();
    } finally { U.loading(false); }
  }

  // ลิงก์จากอีเมล: ?t=TOKEN → ใช้แล้วลบออกจาก URL (ไม่ให้ติดไปเวลาแชร์ลิงก์)
  const urlToken = params.get('t');
  if (urlToken) {
    params.delete('t');
    history.replaceState(null, '', 'profile.html?' + params.toString());
  }
  const token = urlToken || myBibs.token(bib);
  if (token) load({ token }).catch((e) => { myBibs.remove(bib); toast(e.message, 'err'); askPhone(); });
  else if (Auth.loggedIn()) load({}).catch(() => askPhone());   // เจ้าของที่ล็อกอินอยู่ (session แนบอัตโนมัติ)
  else askPhone();

  function askPhone() {
    $('#vBib').textContent = bib;
    $('#verifyModal').classList.remove('hidden');
    setTimeout(() => $('#phone4').focus(), 50);
  }

  $('#verifyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = $('#phone4').value.replace(/\D/g, '');
    if (v.length !== 4) return toast('กรอก 4 หลัก', 'err');
    busy($('#verifyBtn'), true, 'ตรวจสอบ…');
    try {
      await load({ phone4: v });
      $('#verifyModal').classList.add('hidden');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      busy($('#verifyBtn'), false);
    }
  });

  /* ---------- แสดงผล ---------- */
  function render() {
    const p = pkg(runner.package);
    const d = delivery(runner.delivery);
    const paid = runner.paymentStatus === 'PAID';

    if (params.get('new')) $('#successHead').classList.remove('hidden');
    $('#profileView').classList.remove('hidden');
    document.title = runner.bib + ' · INSTHINK RUN CLUB';

    // หัวการ์ด + ขั้นตอน
    $('#pHeadline').textContent = runner.bib + ' · ' + p.label;
    $('#pPay').innerHTML = payPill(runner.paymentStatus);
    const lastStep = p.runner ? 'พร้อมวิ่ง' : (d.code === 'SHIP' ? 'จัดส่งแล้ว' : 'รับของแล้ว');
    const doneLast = p.runner ? paid : (d.code === 'SHIP' ? runner.shipStatus === 'SHIPPED' : runner.status === 'CHECKED_IN');
    const steps = [
      ['สมัคร', true],
      ['ชำระเงิน (แนบสลิป)', paid],
      [lastStep, doneLast],
    ];
    const firstOpen = steps.findIndex((s) => !s[1]);
    $('#steps').innerHTML = steps.map((s, i) => `<div class="step ${s[1] ? 'done' : i === firstOpen ? 'now' : ''}"><i></i>${esc(s[0])}</div>`).join('');

    renderPayment(p, d, paid);
    renderDetail(p, d);

    // นักวิ่ง: E-BIB / เส้นทาง / Story — ออเดอร์ผ้าโพกหัวไม่มีส่วนนี้
    $('#bibCol').classList.toggle('hidden', !p.runner);
    $('#routeCard').classList.toggle('hidden', !p.runner);
    $('#storyCard').classList.toggle('hidden', !p.runner);
    if (p.runner) renderBib(p, d, paid);
  }

  function renderPayment(p, d, paid) {
    $('#payCard').classList.toggle('hidden', paid);
    if (paid) return;

    const n = $('#payNotice');
    n.classList.add('hidden');
    if (runner.paymentStatus === 'SLIP_UPLOADED') {
      n.className = 'notice info';
      n.textContent = 'ได้รับสลิปแล้วเมื่อ ' + fmtDate(runner.slipAt, true) + ' · รอทีมงานตรวจสอบ';
    } else if (runner.paymentStatus === 'REJECTED') {
      n.className = 'notice bad';
      n.textContent = 'ทีมงานแจ้งให้แนบสลิปใหม่: ' + (runner.payNote || '-');
    }

    $('#payAmount').textContent = money(runner.amount);
    $('#ppAmt').textContent = money(runner.amount);
    $('#payFor').textContent = p.title + (d.fee ? ' + ค่าจัดส่ง ' + d.fee + ' ฿' : '');

    const id = CFG.PAYMENT.promptpayId;
    if (id) {
      U.renderQR($('#ppQr'), U.promptPayPayload(id, runner.amount), 196, '#0A0A0A');
      $('#ppName').textContent = CFG.PAYMENT.payeeName || '';
    } else {
      $('#ppQr').innerHTML = '<div class="notice warn small" style="margin:20px 0">ผู้จัดงานยังไม่ได้ตั้งค่าเลข PromptPay<br>(config.js → PAYMENT.promptpayId)</div>';
      $('#btnSaveQr').classList.add('hidden');
    }
    $('#uploadLabel').textContent = runner.paymentStatus === 'SLIP_UPLOADED' ? 'แนบสลิปใหม่ (ถ้าต้องการ)' : 'แตะเพื่อเลือกรูปสลิป';
  }

  function renderDetail(p, d) {
    const rows = [
      ['แพ็กเกจ', p.title],
      ['ยอดชำระ', money(runner.amount)],
      ['ผ้าโพกหัว', d.label],
      ['สถานะ', runner.paymentStatus === 'PAID' ? checkinLabel(runner) : PAY_LABEL[runner.paymentStatus]],
    ];
    if (d.code === 'SHIP') {
      rows.push(['การจัดส่ง', runner.shipStatus === 'SHIPPED' ? 'ส่งแล้ว · ' + (runner.trackingNo || '') : 'รอจัดส่ง']);
      if (runner.address) rows.push(['ที่อยู่จัดส่ง', runner.address + ' ' + (runner.zipcode || ''), true]);
    }
    if (p.runner) rows.push(['เครื่องดื่ม', runner.drink + ' · ' + U.sweetLabel(runner.sweetness)], ['แพ้อาหาร', runner.note || '-']);
    $('#detail').innerHTML = rows.map(([k, v, wide]) => `<div class="${wide ? 'wide' : ''}"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
  }

  function renderBib(p, d, paid) {
    $('#bDist').textContent = CFG.EVENT.distanceKm + 'K';
    $('#bNum').textContent = runner.bib;
    $('#bName').textContent = runner.firstName + ' ' + runner.lastName;
    $('#bNick').textContent = runner.nickname ? '“' + runner.nickname + '”' : '';
    $('#bBandana').textContent = d.code === 'SHIP' ? 'จัดส่ง' : 'รับที่งาน';
    $('#bFood').textContent = runner.note || '-';
    $('#bDrink').textContent = runner.drink;
    $('#bAvatar').innerHTML = U.avatarHtml(runner, 'lg');
    $('#bStart').textContent = CFG.EVENT.startTime + ' น.';
    U.renderBarcode($('#bBarcode'), runner.bib);

    const rib = $('#bRibbon');
    rib.classList.remove('hidden', 'wait');
    if (runner.status === 'CHECKED_IN') rib.textContent = 'CHECKED IN';
    else if (paid) rib.textContent = 'CONFIRMED';
    else { rib.textContent = 'PENDING'; rib.classList.add('wait'); }

    // QR ใช้งานได้เฉพาะเมื่อชำระแล้ว (และมี token = เจ้าของตัวจริง)
    const box = $('#bQrBox');
    const old = box.querySelector('.lock'); if (old) old.remove();
    if (paid && runner.token) {
      U.renderQR($('#bQr'), U.qrPayload(runner), 232);
      $('#bibHint').textContent = 'แสดง QR นี้ที่จุดลงทะเบียนเพื่อเช็คอินและรับผ้าโพกหัว';
    } else {
      $('#bQr').innerHTML = '';
      const lock = document.createElement('div');
      lock.className = 'lock';
      lock.textContent = paid ? 'เปิดจากลิงก์ในอีเมลเพื่อแสดง QR' : 'QR จะแสดงเมื่อชำระเงินแล้ว';
      box.appendChild(lock);
      $('#bibHint').textContent = paid ? '' : 'E-BIB จะใช้งานได้ทันทีหลังแนบสลิป';
    }
    $('#bibActions').classList.toggle('hidden', !paid);

    $('#pRouteName').textContent = CFG.ROUTE.name;
    $('#pRoute').innerHTML = U.routeSvg();
    $('#pCheckpoints').textContent = CFG.ROUTE.checkpoints.join('  ·  ');
  }

  /* ---------- แนบสลิป ---------- */
  $('#slipFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      slipData = await U.compressImage(file);
      const img = $('#slipPreview');
      img.src = slipData;
      img.classList.remove('hidden');
      $('#uploadLabel').textContent = 'เปลี่ยนรูป';
      $('#btnSendSlip').classList.remove('hidden');
    } catch (err) {
      toast(err.message, 'err');
    }
  });

  $('#btnSendSlip').addEventListener('click', async () => {
    if (!slipData) return;
    const btn = $('#btnSendSlip');
    busy(btn, true, 'กำลังส่งสลิป…');
    try {
      loading(true, 'กำลังส่งสลิป…', 'อาจใช้เวลา 5–15 วินาที กรุณาอย่าปิดหน้านี้');
      const { runner: r } = await API.call('uploadSlip', Object.assign({ bib, image: slipData }, auth));
      runner = Object.assign(runner, r);
      slipData = '';
      $('#slipPreview').classList.add('hidden');
      $('#slipFile').value = '';
      btn.classList.add('hidden');
      toast(runner.paymentStatus === 'PAID' ? 'ชำระเงินสำเร็จ! E-BIB พร้อมใช้งานแล้ว' : 'ส่งสลิปแล้ว รอทีมงานตรวจสอบ', 'ok');
      render();
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      loading(false);
      busy(btn, false);
    }
  });

  $('#btnSaveQr').addEventListener('click', () => {
    const cv = $('#ppQr canvas');
    if (!cv) return;
    // วาด QR ลงการ์ดพื้นขาวพร้อมยอดเงิน แล้วดาวน์โหลด
    const c = document.createElement('canvas'); c.width = 600; c.height = 720;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 600, 720);
    x.fillStyle = '#113566'; x.fillRect(0, 0, 600, 80);
    x.fillStyle = '#fff'; x.font = 'bold 32px Kanit, sans-serif'; x.textAlign = 'center'; x.fillText('PromptPay', 300, 52);
    x.drawImage(cv, 80, 110, 440, 440);
    x.fillStyle = '#1B3B67'; x.font = 'italic 800 52px Kanit, sans-serif'; x.fillText(money(runner.amount), 300, 625);
    x.fillStyle = '#5E6573'; x.font = '24px Kanit, sans-serif'; x.fillText(runner.bib + ' · ' + (CFG.PAYMENT.payeeName || CFG.EVENT.name), 300, 675);
    c.toBlob((b) => U.saveImage(b, 'INSTHINK-' + runner.bib + '-PromptPay.png'), 'image/png');
  });

  /* ---------- IG Story ---------- */
  const storyName = () => 'INSTHINK-' + runner.bib + '-story.png';

  $('#btnStory').addEventListener('click', async () => {
    if (!runner) return;
    const btn = $('#btnStory');
    busy(btn, true, 'กำลังสร้างรูป…');
    try {
      storyBlob = await Story.build(runner);
      const box = $('#storyPreview');
      box.querySelector('img').src = URL.createObjectURL(storyBlob);
      box.classList.remove('hidden');
      $('#storyActions').classList.remove('hidden');
      btn.dataset.label = 'สร้างใหม่';
    } catch (e) {
      console.error(e);
      toast('สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง', 'err');
    } finally {
      busy(btn, false);
    }
  });

  // Web Share API: บนมือถือเปิดแผงแชร์ → เลือก Instagram → Story
  $('#btnShare').addEventListener('click', async () => {
    if (!storyBlob) return;
    const file = new File([storyBlob], storyName(), { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: CFG.EVENT.name, text: CFG.EVENT.hashtag }); }
      catch (e) { if (e.name !== 'AbortError') toast('แชร์ไม่สำเร็จ ใช้ปุ่มดาวน์โหลดแทน', 'err'); }
    } else {
      U.saveImage(storyBlob, storyName());   // แชร์ตรงไม่ได้ → บันทึกรูปแล้วนำไปลง Story เอง
    }
  });
  $('#btnDownload').addEventListener('click', () => storyBlob && U.saveImage(storyBlob, storyName()));

  // บันทึกการ์ด E-BIB เป็นรูป
  $('#btnSaveBib').addEventListener('click', async () => {
    const btn = $('#btnSaveBib');
    busy(btn, true, 'กำลังสร้างรูป…');
    loading(true, 'กำลังสร้างรูป E-BIB…');
    try {
      if (document.fonts) await document.fonts.ready;
      const el = $('#ebib');
      await Promise.all(Array.from(el.querySelectorAll('img')).map((im) => (im.complete && im.naturalWidth ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
      // จับภาพที่ขนาดคงที่ 420px (มือถือจอเล็กก็ได้รูปเท่ากัน) · scale 2 = คมชัด
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true, onclone: U.canvasifyImages(el), width: el.offsetWidth, height: el.offsetHeight, scrollX: 0, scrollY: -window.scrollY });
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('canvas empty');
      loading(false);
      await U.saveImage(blob, 'INSTHINK-' + runner.bib + '-EBIB.png');
    } catch (e) {
      console.error(e);
      toast('บันทึกไม่สำเร็จ ลองแคปหน้าจอแทน', 'err');
    } finally {
      loading(false);
      busy(btn, false);
    }
  });
})();
