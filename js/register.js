/**
 * =====================================================================
 *  หน้าสมัครวิ่ง (index.html)
 *  1) ต้องเข้าสู่ระบบ (บัญชีสมาชิก) — ข้อมูลส่วนตัวมาจากบัญชี ไม่ต้องกรอกซ้ำ
 *  2) เลือกแพ็กเกจ / เครื่องดื่ม / แพ้อาหาร / รับผ้าโพกหัว
 *  3) คำนวณยอด → ตรวจฟอร์ม → register → ไปหน้าชำระเงิน
 * =====================================================================
 */
(function () {
  const CFG = window.APP_CONFIG;
  const { $, $$, esc, toast, busy, myBibs, pkg, delivery, money, starSvg, avatarHtml } = window.U;

  /* ---------- ข้อมูลงาน ---------- */
  $('#evEdition').textContent = CFG.EVENT.edition;
  $('#evDate').textContent = CFG.EVENT.dateLabel;
  $('#evTime').textContent = CFG.EVENT.startTime + ' น.';
  $('#evLoc').textContent = CFG.EVENT.location;
  $('#heroStars').innerHTML = '<img src="img/stars-navy.png" alt="">';
  $('#bandanaIco').innerHTML = starSvg('#fff');
  $('#stTime').textContent = CFG.EVENT.startTime;

  /* ---------- Landing: เส้นทาง + สไลด์ของที่ได้รับ ---------- */
  $('#homeRoute').innerHTML = window.U.routeSvg({ stroke: '#5FD3EE', dash: '#0A1430', start: '#0A1430', grid: 'rgba(255,255,255,.06)', width: 2.4 });
  $('#homeRouteName').textContent = CFG.ROUTE.name;
  $('#homeRouteLoc').textContent = '📍 ' + CFG.EVENT.location + ' · ปล่อยตัว ' + CFG.EVENT.startTime + ' น.';
  $$('[data-slide]').forEach((b) => b.addEventListener('click', () => {
    const sl = $('#goodsSlider');
    sl.scrollBy({ left: Number(b.dataset.slide) * (sl.firstElementChild.offsetWidth + 12), behavior: 'smooth' });
  }));

  /* ---------- ต้องล็อกอินก่อน ---------- */
  if (!Auth.loggedIn()) {
    $('#gate').classList.remove('hidden');
    return;
  }
  $('#regForm').classList.remove('hidden');

  let member = Auth.member() || {};
  function paintMember(m) {
    member = m;
    $('#whoCard').innerHTML = `${avatarHtml(m, 'lg')}
      <div class="meta"><b>${esc((m.firstName || '') + ' ' + (m.lastName || ''))}</b>
      ${m.nickname ? '<span class="muted">“' + esc(m.nickname) + '”</span><br>' : ''}
      <span class="muted small">${esc(m.phone || '')} · ${esc(m.email || '')}</span></div>`;
    $('#emgHint').classList.toggle('hidden', !!(m.emergencyName && m.emergencyPhone) || !isRunnerSelected());
  }
  // ดึงข้อมูลล่าสุด (รูป/เบอร์ที่เพิ่งแก้) — ถ้า session หมดอายุจะเด้งไปล็อกอิน
  API.call('me').then((r) => { Auth.setMember(r.member); paintMember(r.member); })
    .catch(() => { if (!Auth.loggedIn()) location.reload(); });

  /* ---------- สร้างตัวเลือก ---------- */
  $('#pkgList').innerHTML = CFG.PACKAGES.map((p) => `
    <label class="pkg">
      <input type="radio" name="package" value="${esc(p.code)}">
      <div class="box">
        <div class="top">
          <div><div class="lbl">${esc(p.label)}</div><div class="ttl">${esc(p.title)}</div></div>
          <div class="price">${p.price}<small>฿</small></div>
        </div>
        <ul>${p.includes.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      </div>
    </label>`).join('');

  $('#deliveryList').innerHTML = CFG.DELIVERY.map((d, i) => `
    <label class="opt"><input type="radio" name="delivery" value="${esc(d.code)}" ${i === 0 ? 'checked' : ''}>
      <div class="box"><b>${esc(d.label)}</b><span>${d.fee ? '+' + money(d.fee) : 'ฟรี'}</span></div></label>`).join('');

  $('#drinkList').innerHTML = CFG.DRINKS.map((v) => `
    <label class="chip"><input type="radio" name="drink" value="${esc(v)}"><span>${esc(v)}</span></label>`).join('');

  $('#zipcode').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });

  /* ---------- สลับฟอร์มตามแพ็กเกจ + คำนวณยอด ---------- */
  const radio = (name) => { const r = $(`input[name="${name}"]:checked`); return r ? r.value : ''; };
  const isRunnerSelected = () => { const c = radio('package'); return !c || pkg(c).runner; };

  function update() {
    const code = radio('package');
    const p = code ? pkg(code) : null;
    const isRunner = !p || p.runner;     // ยังไม่เลือก → แสดงฟอร์มนักวิ่ง
    $$('[data-runner]').forEach((el) => el.classList.toggle('hidden', !isRunner));
    $('#emgHint').classList.toggle('hidden', !isRunner || !!(member.emergencyName && member.emergencyPhone));
    $('#numDelivery').textContent = isRunner ? '04' : '03';
    $('#numSummary').textContent = isRunner ? '05' : '04';

    const d = delivery(radio('delivery'));
    $('#addressBox').classList.toggle('hidden', d.code !== 'SHIP');

    const price = p ? p.price : 0;
    $('#summary').innerHTML = `
      <div class="row"><span>${p ? esc(p.title) : '<span class="muted">ยังไม่ได้เลือกแพ็กเกจ</span>'}</span><span>${money(price)}</span></div>
      <div class="row"><span>${esc(d.label)}</span><span>${d.fee ? money(d.fee) : 'ฟรี'}</span></div>
      <div class="row total"><span>ยอดชำระ</span><b>${money(price + d.fee)}</b></div>`;
  }
  $('#regForm').addEventListener('change', update);
  paintMember(member);
  update();

  /* ---------- ตรวจฟอร์ม ---------- */
  function collect() {
    const d = { package: radio('package'), drink: radio('drink'), delivery: radio('delivery') };
    ['note', 'address', 'zipcode'].forEach((k) => { d[k] = $('#' + k).value.trim(); });
    d.consent = $('#consent').checked;
    return d;
  }

  function validate(d) {
    const errs = [];   // { el, label }
    $$('.input.invalid').forEach((el) => el.classList.remove('invalid'));
    $$('[data-err]').forEach((el) => el.classList.add('hidden'));
    $$('[data-dyn]').forEach((el) => el.remove());

    const bad = (id, label, msg) => {
      const el = $('#' + id);
      el.classList.add('invalid');
      const m = document.createElement('div');
      m.className = 'err-msg'; m.setAttribute('data-dyn', ''); m.textContent = msg;
      el.insertAdjacentElement('afterend', m);
      errs.push({ el, label });
    };
    const badGroup = (k, label) => { const el = $(`[data-err="${k}"]`); el.classList.remove('hidden'); errs.push({ el, label }); };

    const p = d.package ? pkg(d.package) : null;
    if (!p) badGroup('package', 'แพ็กเกจ');
    if (!member.firstName || !/^0\d{8,9}$/.test(member.phone || '')) {
      toast('ข้อมูลในบัญชีไม่ครบ กรุณาแก้ไขที่ "บัญชีของฉัน" ก่อน', 'err');
      return false;
    }
    if (p && p.runner && !d.drink) badGroup('drink', 'เครื่องดื่ม');
    if (d.delivery === 'SHIP') {
      if (d.address.length < 10) bad('address', 'ที่อยู่จัดส่ง', 'กรุณากรอกที่อยู่ให้ครบ (บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด)');
      if (!/^\d{5}$/.test(d.zipcode)) bad('zipcode', 'รหัสไปรษณีย์', 'รหัสไปรษณีย์ 5 หลัก');
    }
    if (!d.consent) badGroup('consent', 'ติ๊กยอมรับเงื่อนไข');

    if (errs.length) {
      errs[0].el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast('กรุณาตรวจสอบ: ' + errs.map((e) => e.label).join(', '), 'err');
    }
    return errs.length === 0;
  }

  /* ---------- ส่งข้อมูล ---------- */
  $('#regForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = collect();
    if (!validate(d)) return;

    const btn = $('#submitBtn');
    busy(btn, true, 'กำลังบันทึก…');
    try {
      const { runner } = await API.call('register', d);
      myBibs.add(runner.bib, runner.token);   // เครื่องนี้เปิดหน้าได้โดยไม่ต้องยืนยัน
      location.href = 'profile.html?bib=' + encodeURIComponent(runner.bib) + '&new=1';
    } catch (err) {
      toast(err.message, 'err');
      busy(btn, false);
    }
  });
})();
