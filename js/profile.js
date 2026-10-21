/**
 * =====================================================================
 *  หน้า "ของฉัน" (profile.html?bib=R0001)
 *  - ยืนยันตัวตน: token ในเครื่อง / ลิงก์อีเมล (?t=) / เบอร์โทร 4 ตัวท้าย
 *  - ชำระเงิน: PromptPay QR ตามยอดจริง + แนบสลิป (ย่อรูปก่อนส่ง)
 *  - นักวิ่ง: E-BIB (QR ใช้งานได้เมื่อชำระแล้ว) + เส้นทาง + IG Story
 *  - ออเดอร์ผ้าโพกหัว: สถานะการชำระ/จัดส่ง
 * =====================================================================
 */
(function () {
  const CFG = window.APP_CONFIG;
  const U = window.U;
  const { $, esc, toast, busy, myBibs, pkg, pkgByPrefix, delivery, money, PAY_LABEL, payPill, checkinLabel, fmtDate } = U;

  const params = new URLSearchParams(location.search);
  const bib = (params.get('bib') || '').toUpperCase();
  let auth = {};          // { token } หรือ { phone4 }
  let runner = null;
  let slipData = '';
  let storyBlob = null;

  /* ---------- ไม่มีเลขใน URL → รายการในเครื่อง ---------- */
  if (!bib) {
    $('#pickView').classList.remove('hidden');
    const list = myBibs.all();
    if (list.length) {
      $('#pickEmpty').classList.add('hidden');
      $('#myList').innerHTML = list.map((x) => {
        const p = pkgByPrefix(x.bib);
        return `<a class="result" href="profile.html?bib=${encodeURIComponent(x.bib)}">
          <span class="bib-tag ${p.runner ? '' : 'm'}">${esc(x.bib)}</span>
          <span class="who"><b>${esc(p.title)}</b><span>แตะเพื่อเปิด</span></span><span>→</span></a>`;
      }).join('');
    }
    return;
  }

  /* ---------- ยืนยันตัวตน + โหลดข้อมูล ---------- */
  async function load(a) {
    const { runner: r } = await API.call('get', Object.assign({ bib }, a));
    auth = a;
    runner = r;
    if (r.token) { myBibs.add(r.bib, r.token); auth = { token: r.token }; }
    render();
  }

  // ลิงก์จากอีเมล: ?t=TOKEN → ใช้แล้วลบออกจาก URL (ไม่ให้ติดไปเวลาแชร์ลิงก์)
  const urlToken = params.get('t');
  if (urlToken) {
    params.delete('t');
    history.replaceState(null, '', 'profile.html?' + params.toString());
  }
  const token = urlToken || myBibs.token(bib);
  if (token) load({ token }).catch((e) => { toast(e.message, 'err'); askPhone(); });
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
      ['ชำระเงิน', ['SLIP_UPLOADED', 'PAID'].includes(runner.paymentStatus)],
      ['ตรวจสอบ', paid],
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
      n.textContent = 'ได้รับสลิปแล้วเมื่อ ' + fmtDate(runner.slipAt, true) + ' · รอทีมงานตรวจสอบ (แนบใหม่ได้หากส่งผิด)';
    } else if (runner.paymentStatus === 'REJECTED') {
      n.className = 'notice bad';
      n.textContent = 'สลิปไม่ผ่านการตรวจสอบ: ' + (runner.payNote || '-') + ' — กรุณาแนบสลิปใหม่';
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
    $('#uploadLabel').textContent = runner.paymentStatus === 'SLIP_UPLOADED' ? '📎 แนบสลิปใหม่ (ถ้าต้องการ)' : '📎 แตะเพื่อเลือกรูปสลิป';
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
    if (p.runner) rows.push(['อาหาร', runner.food], ['เครื่องดื่ม', runner.drink + ' · หวาน ' + runner.sweetness]);
    $('#detail').innerHTML = rows.map(([k, v, wide]) => `<div class="${wide ? 'wide' : ''}"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
  }

  function renderBib(p, d, paid) {
    $('#bDist').textContent = CFG.EVENT.distanceKm + 'K';
    $('#bNum').textContent = runner.bib;
    $('#bName').textContent = runner.firstName + ' ' + runner.lastName;
    $('#bNick').textContent = runner.nickname ? '“' + runner.nickname + '”' : '';
    $('#bBandana').textContent = d.code === 'SHIP' ? 'จัดส่ง' : 'รับที่งาน';
    $('#bFood').textContent = runner.food;
    $('#bDrink').textContent = runner.drink + ' · ' + runner.sweetness;
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
      $('#bibHint').textContent = paid ? '' : 'E-BIB จะใช้งานได้หลังทีมงานยืนยันการชำระเงิน';
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
      const { runner: r } = await API.call('uploadSlip', Object.assign({ bib, image: slipData }, auth));
      runner = Object.assign(runner, r);
      slipData = '';
      $('#slipPreview').classList.add('hidden');
      $('#slipFile').value = '';
      btn.classList.add('hidden');
      toast('ส่งสลิปแล้ว รอทีมงานตรวจสอบ', 'ok');
      render();
    } catch (err) {
      toast(err.message, 'err');
    } finally {
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
    c.toBlob((b) => download(b, 'INSTHINK-' + runner.bib + '-PromptPay.png'), 'image/png');
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
      download(storyBlob, storyName());
      toast('อุปกรณ์นี้แชร์ตรงไม่ได้ — ดาวน์โหลดรูปให้แล้ว นำไปลง Story ได้เลย', 'ok');
    }
  });
  $('#btnDownload').addEventListener('click', () => storyBlob && download(storyBlob, storyName()));

  // บันทึกการ์ด E-BIB เป็นรูป
  $('#btnSaveBib').addEventListener('click', async () => {
    const btn = $('#btnSaveBib');
    busy(btn, true, 'กำลังบันทึก…');
    try {
      if (document.fonts) await document.fonts.ready;
      const canvas = await html2canvas($('#ebib'), { scale: 2, backgroundColor: '#ffffff', logging: false });
      canvas.toBlob((b) => download(b, 'INSTHINK-' + runner.bib + '-EBIB.png'), 'image/png');
    } catch (e) {
      toast('บันทึกไม่สำเร็จ ลองแคปหน้าจอแทน', 'err');
    } finally {
      busy(btn, false);
    }
  });

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
})();
