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
  const { $, $$, esc, toast, busy, loading, myBibs, pkg, pkgByPrefix, delivery, money, PAY_LABEL, payPill, checkinLabel, fmtDate } = U;

  const params = new URLSearchParams(location.search);
  const bib = (params.get('bib') || '').toUpperCase();
  let auth = {};          // { token } หรือ { phone4 }
  let runner = null;
  let slipData = '';
  let storyBlobs = [];    // รูป Story 3 หน้า
  let post = { on: false, feedback: null };   // โหมดหลังจบงาน

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
      const res = await API.call('get', Object.assign({ bib }, a));
      const r = res.runner;
      auth = a;
      runner = r;
      post = { on: !!res.postEvent, feedback: res.feedback || null };
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
    renderInvite();
    renderPost(p, paid);

    // นักวิ่ง: E-BIB / เส้นทาง / Story — ออเดอร์ผ้าโพกหัวไม่มีส่วนนี้
    $('#bibCol').classList.toggle('hidden', !p.runner);
    $('#routeCard').classList.toggle('hidden', !p.runner);
    $('#storyCard').classList.toggle('hidden', !p.runner);
    if (p.runner) renderBib(p, d, paid);
  }

  function renderPayment(p, d, paid) {
    $('#payCard').classList.toggle('hidden', paid);
    setTimeout(() => updateSlipBar(), 0);
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
    $('#bNumBack').textContent = runner.bib;
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
    if (CFG.EVENT.mapUrl) $('#pMapBtn').href = CFG.EVENT.mapUrl; else $('#pMapBtn').remove();
    $('#bibHint').textContent = paid && runner.token ? 'แตะการ์ดเพื่อพลิกดู QR · แสดงที่จุดลงทะเบียนเพื่อเช็คอินและรับผ้าโพกหัว' : $('#bibHint').textContent;
  }

  /* ---------- E-BIB พลิกการ์ด ---------- */
  const flipCard = () => {
    const el = $('#ebib');
    el.classList.toggle('is-back');
    el.setAttribute('aria-label', el.classList.contains('is-back') ? 'ด้านหลัง: QR เช็คอิน · แตะเพื่อกลับด้านหน้า' : 'แตะเพื่อพลิกดู QR');
  };
  $('#ebib').addEventListener('click', flipCard);
  $('#ebib').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipCard(); } });
  $('#btnFlip').addEventListener('click', flipCard);
  // เอียงการ์ดตามเมาส์เล็กน้อย (คอมพิวเตอร์)
  if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const wrap = $('#ebibFlip');
    wrap.addEventListener('pointermove', (e) => {
      const b = wrap.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
      wrap.style.setProperty('--rx', (-y * 6).toFixed(2) + 'deg'); wrap.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg');
      wrap.style.setProperty('--mx', ((x + 0.5) * 100).toFixed(1) + '%');
    });
    wrap.addEventListener('pointerleave', () => { wrap.style.setProperty('--rx', '0deg'); wrap.style.setProperty('--ry', '0deg'); });
  }

  /* ---------- ชวนเพื่อน ---------- */
  function renderInvite() {
    const url = U.inviteUrl(runner.bib);
    $('#inviteUrl').value = url;
    const n = Number(runner.invited || 0);
    $('#inviteCount').innerHTML = n ? 'ชวนแล้ว <b>' + n + '</b> คน' : '';
  }
  const inviteText = () => 'มาวิ่ง 6K ด้วยกันที่ ' + CFG.EVENT.name + ' · ' + CFG.EVENT.location + ' ได้ผ้าโพกหัว ริสแบน สติกเกอร์ และข้าวยำบุฟเฟ่ต์ สมัครผ่านลิงก์นี้ได้เลย';
  $('#btnCopyInvite').addEventListener('click', async () => {
    const inp = $('#inviteUrl');
    try { await navigator.clipboard.writeText(inp.value); }
    catch (e) { inp.select(); try { document.execCommand('copy'); } catch (e2) { /* ignore */ } }
    toast('คัดลอกลิงก์ชวนเพื่อนแล้ว', 'ok');
  });
  $('#btnShareInvite').addEventListener('click', async () => {
    const url = $('#inviteUrl').value;
    if (navigator.share) {
      try { await navigator.share({ title: CFG.EVENT.name, text: inviteText(), url }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(inviteText() + '\n' + url); toast('คัดลอกข้อความ + ลิงก์แล้ว นำไปวางในแชทได้เลย', 'ok'); }
    catch (e) { toast('กดค้างที่ลิงก์เพื่อคัดลอก', 'err'); }
  });

  /* ---------- หลังจบงาน: Finisher + แบบประเมิน ---------- */
  const FB_TEXT = ['', 'ต้องปรับปรุง', 'พอใช้', 'ดี', 'ดีมาก', 'ประทับใจสุดๆ'];
  let fbRating = 0;
  let finBlob = null;
  function paintStars() {
    $('#fbStars').innerHTML = [1, 2, 3, 4, 5].map((i) => `<button type="button" role="radio" aria-checked="${i === fbRating}" aria-label="${i} ดาว" data-star="${i}" class="${i <= fbRating ? 'on' : ''}">${U.starSvg()}</button>`).join('');
    $('#fbLabel').textContent = fbRating ? FB_TEXT[fbRating] : 'แตะดาวเพื่อให้คะแนน';
  }
  function renderPost(p, paid) {
    const box = $('#postEvent');
    box.classList.toggle('hidden', !(post.on && paid));
    if (!post.on || !paid) return;
    $('#finisherCard').classList.toggle('hidden', !p.runner);
    const finished = runner.status === 'CHECKED_IN';
    $('#finisherBody').classList.toggle('hidden', !finished);
    $('#finisherLocked').classList.toggle('hidden', finished);
    try { $('#finTime').value = localStorage.getItem('irc_fin_' + runner.bib) || ''; } catch (e) { /* ignore */ }
    if (post.feedback) {
      fbRating = post.feedback.rating; $('#fbComment').value = post.feedback.comment || '';
      $('#fbDone').classList.remove('hidden'); $('#fbSend').textContent = 'บันทึกการแก้ไข';
    }
    paintStars();
  }
  $('#fbStars').addEventListener('click', (e) => {
    const b = e.target.closest('[data-star]'); if (!b) return;
    fbRating = Number(b.dataset.star); paintStars();
  });
  $('#fbForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fbRating) { toast('แตะดาวเพื่อให้คะแนนก่อน', 'err'); return; }
    const btn = $('#fbSend');
    busy(btn, true, 'กำลังส่ง…');
    try {
      const { feedback } = await API.call('feedback', Object.assign({ bib, rating: fbRating, comment: $('#fbComment').value.trim() }, auth));
      post.feedback = feedback;
      $('#fbDone').classList.remove('hidden');
      btn.dataset.label = 'บันทึกการแก้ไข';
      toast('ขอบคุณสำหรับแบบประเมิน!', 'ok');
    } catch (err) { toast(err.message, 'err'); }
    finally { busy(btn, false); }
  });
  $('#btnFinisher').addEventListener('click', async () => {
    const btn = $('#btnFinisher');
    const t = $('#finTime').value.trim();
    if (t && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) { toast('รูปแบบเวลา เช่น 38:12 หรือ 1:02:30', 'err'); return; }
    try { localStorage.setItem('irc_fin_' + runner.bib, t); } catch (e) { /* ignore */ }
    busy(btn, true, 'กำลังสร้างรูป…');
    try {
      finBlob = await Finisher.build(runner, { time: t });
      const box = $('#finPreview');
      box.querySelector('img').src = URL.createObjectURL(finBlob);
      box.classList.remove('hidden');
      $('#btnFinSave').classList.remove('hidden');
      btn.dataset.label = 'สร้างใหม่';
    } catch (e) { console.error(e); toast('สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง', 'err'); }
    finally { busy(btn, false); }
  });
  $('#btnFinSave').addEventListener('click', () => finBlob && U.saveImage(finBlob, 'INSTHINK-' + runner.bib + '-FINISHER.png'));

  /* ---------- เตือนให้แนบสลิป ---------- */
  function remindSlip() {
    const box = $('#slipStep');
    if (!box || $('#payCard').classList.contains('hidden')) return;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
    toast('โอนเงินแล้ว อย่าลืมแนบสลิปตรงนี้นะ', 'ok');
  }
  $('#slipBar').addEventListener('click', remindSlip);
  // แถบล่างโผล่เมื่อยังไม่ชำระ และช่องแนบสลิปไม่อยู่ในจอ
  let slipInView = false;
  const updateSlipBar = () => {
    const unpaid = runner && runner.paymentStatus !== 'PAID' && !$('#payCard').classList.contains('hidden');
    $('#slipBar').classList.toggle('hidden', !unpaid || slipInView);
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { slipInView = en.isIntersecting; updateSlipBar(); }).observe($('#slipStep'));
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
    const c = document.createElement('canvas'); c.width = 600; c.height = 760;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 600, 760);
    x.fillStyle = '#113566'; x.fillRect(0, 0, 600, 80);
    x.fillStyle = '#fff'; x.font = 'bold 32px Kanit, sans-serif'; x.textAlign = 'center'; x.fillText('PromptPay', 300, 52);
    x.drawImage(cv, 80, 110, 440, 440);
    x.fillStyle = '#1B3B67'; x.font = 'italic 800 52px Kanit, sans-serif'; x.fillText(money(runner.amount), 300, 625);
    x.fillStyle = '#5E6573'; x.font = '24px Kanit, sans-serif'; x.fillText(runner.bib + ' · ' + (CFG.PAYMENT.payeeName || CFG.EVENT.name), 300, 668);
    // แถบเตือนในรูป QR เอง (คนมักเปิดรูปนี้ในแอปธนาคาร แล้วลืมกลับมาแนบสลิป)
    x.fillStyle = '#8CD43E'; x.fillRect(0, 690, 600, 70);
    x.fillStyle = '#0A1430'; x.font = 'bold 25px Kanit, sans-serif'; x.fillText('โอนแล้ว กลับมาแนบสลิปที่หน้าเว็บด้วย', 300, 735);
    c.toBlob((b) => U.saveImage(b, 'INSTHINK-' + runner.bib + '-PromptPay.png', remindSlip), 'image/png');
  });

  /* ---------- IG Story 3 หน้า ---------- */
  const storyName = (i) => 'INSTHINK-' + runner.bib + '-story-' + (i + 1) + '.png';
  let storyIdx = 0;
  const track = $('#storyTrack');
  const paintDots = () => { $('#storyDots').innerHTML = storyBlobs.map((_, i) => `<button type="button" class="${i === storyIdx ? 'on' : ''}" data-go="${i}" aria-label="รูปที่ ${i + 1}"></button>`).join(''); };
  track.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / Math.max(1, track.firstElementChild ? track.firstElementChild.offsetWidth + 14 : 1));
    if (i !== storyIdx) { storyIdx = Math.max(0, Math.min(storyBlobs.length - 1, i)); paintDots(); }
  }, { passive: true });
  $('#storyDots').addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]'); if (!b) return;
    const el = track.children[Number(b.dataset.go)];
    if (el) track.scrollTo({ left: el.offsetLeft - track.offsetLeft, behavior: 'smooth' });
  });

  $('#btnStory').addEventListener('click', async () => {
    if (!runner) return;
    const btn = $('#btnStory');
    busy(btn, true, 'กำลังสร้างรูป…');
    try {
      storyBlobs = await Story.buildAll(runner);
      track.innerHTML = storyBlobs.map((b, i) => `<figure><img src="${URL.createObjectURL(b)}" alt="รูป Story หน้า ${i + 1}"><figcaption>${i + 1} / ${storyBlobs.length}</figcaption></figure>`).join('');
      storyIdx = 0; track.scrollLeft = 0; paintDots();
      $('#storyPreview').classList.remove('hidden');
      $('#storyActions').classList.remove('hidden');
      btn.dataset.label = 'สร้างใหม่';
    } catch (e) {
      console.error(e);
      toast('สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง', 'err');
    } finally {
      busy(btn, false);
    }
  });

  // Web Share API: แชร์ทั้ง 3 รูปพร้อมกัน → เลือก Instagram → Story
  $('#btnShare').addEventListener('click', async () => {
    if (!storyBlobs.length) return;
    const files = storyBlobs.map((b, i) => new File([b], storyName(i), { type: 'image/png' }));
    if (navigator.canShare && navigator.canShare({ files })) {
      try { await navigator.share({ files, title: CFG.EVENT.name, text: CFG.EVENT.hashtag }); }
      catch (e) { if (e.name !== 'AbortError') toast('แชร์ไม่สำเร็จ ใช้ปุ่มบันทึกทีละรูปแทน', 'err'); }
    } else if (!U.isMobile()) {
      storyBlobs.forEach((b, i) => setTimeout(() => U.saveImage(b, storyName(i)), i * 400));   // คอมพิวเตอร์: ดาวน์โหลดทั้ง 3 ไฟล์
    } else {
      U.saveImage(storyBlobs[storyIdx], storyName(storyIdx));
    }
  });
  $('#btnDownload').addEventListener('click', () => storyBlobs[storyIdx] && U.saveImage(storyBlobs[storyIdx], storyName(storyIdx)));

  // บันทึกการ์ด E-BIB เป็นรูป
  $('#btnSaveBib').addEventListener('click', async () => {
    const btn = $('#btnSaveBib');
    busy(btn, true, 'กำลังสร้างรูป…');
    loading(true, 'กำลังสร้างรูป E-BIB…');
    try {
      if (document.fonts) await document.fonts.ready;
      const el = $('#ebib');
      await Promise.all(Array.from(el.querySelectorAll('img')).map((im) => (im.complete && im.naturalWidth ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
      const av = await U.avatarCanvas(runner, 112, 3, 2);   // วงกลมโปรไฟล์: วาดเอง ไม่ให้ html2canvas วาด
      // QR: คัดลอกพิกเซลจาก canvas ต้นฉบับใส่ canvas ใหม่ในฉากที่จับภาพ (บางเครื่อง html2canvas คัดลอก canvas ไม่ติด)
      const qrSrc = $('#bQr canvas');
      const swapQr = (doc) => {
        const t = doc.querySelector('#bQr');
        if (!t || !qrSrc || !qrSrc.width) return;
        const c2 = doc.createElement('canvas'); c2.width = qrSrc.width; c2.height = qrSrc.height;
        c2.getContext('2d').drawImage(qrSrc, 0, 0);
        c2.style.cssText = 'display:block;width:116px;height:116px';
        t.innerHTML = ''; t.appendChild(c2);
      };
      const swapAvatar = (doc) => { const t = doc.querySelector('#bAvatar'); if (t) { t.innerHTML = ''; const c2 = doc.createElement('canvas'); c2.width = av.width; c2.height = av.height; c2.getContext('2d').drawImage(av, 0, 0); c2.style.cssText = av.style.cssText; t.appendChild(c2); } };
      // จับภาพที่ขนาดคงที่ 420px (มือถือจอเล็กก็ได้รูปเท่ากัน) · scale 2 = คมชัด
      // ฉากที่จับภาพ: รวม 2 ด้านของการ์ดเป็นใบเดียว (ด้านหน้าบน + QR ล่าง) แบบเดิม
      const flat = (doc) => {
        const c = doc.querySelector('#ebib'); if (!c) return;
        c.classList.remove('flipcard', 'is-back'); c.classList.add('flat');
        const w = doc.querySelector('#ebibFlip'); if (w) w.style.cssText = 'transform:none;perspective:none';
      };
      const before = el.classList.contains('is-back');
      el.classList.remove('flipcard', 'is-back'); el.classList.add('flat');   // วัดขนาดจริงของแบบรวม
      const W = el.offsetWidth, H = el.offsetHeight;
      el.classList.remove('flat'); el.classList.add('flipcard'); if (before) el.classList.add('is-back');
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true, onclone: (doc) => { flat(doc); U.canvasifyImages(el)(doc); swapAvatar(doc); swapQr(doc); }, width: W, height: H, scrollX: 0, scrollY: -window.scrollY });
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
