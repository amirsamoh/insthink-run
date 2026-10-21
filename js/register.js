/**
 * =====================================================================
 *  หน้าสมัคร (index.html)
 *  1) สร้างตัวเลือกจาก config   2) สลับฟอร์มตามแพ็กเกจ (วิ่ง / ผ้าโพกหัวอย่างเดียว)
 *  3) คำนวณยอด   4) ตรวจฟอร์ม   5) ส่ง register → ไปหน้าชำระเงิน
 * =====================================================================
 */
(function () {
  const CFG = window.APP_CONFIG;
  const { $, $$, esc, toast, busy, myBibs, pkg, delivery, money, starSvg } = window.U;
  const PROFILE_KEY = 'irc_profile';
  const PROFILE_FIELDS = ['firstName', 'lastName', 'nickname', 'gender', 'birthDate', 'phone', 'email', 'emergencyName', 'emergencyPhone', 'address', 'zipcode'];

  /* ---------- ข้อมูลงาน ---------- */
  $('#evEdition').textContent = CFG.EVENT.edition;
  $('#evDate').textContent = CFG.EVENT.dateLabel;
  $('#evTime').textContent = CFG.EVENT.startTime + ' น.';
  $('#evLoc').textContent = CFG.EVENT.location;
  $('#heroStars').innerHTML = starSvg() + starSvg() + starSvg();
  $('#bandanaIco').innerHTML = starSvg('#fff');

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
        ${p.runner ? '<span class="seats" id="seats">รับ ' + CFG.MAX_RUNNERS + ' คน</span>' : ''}
      </div>
    </label>`).join('');

  $('#deliveryList').innerHTML = CFG.DELIVERY.map((d, i) => `
    <label class="opt"><input type="radio" name="delivery" value="${esc(d.code)}" ${i === 0 ? 'checked' : ''}>
      <div class="box"><b>${esc(d.label)}</b><span>${d.fee ? '+' + money(d.fee) : 'ฟรี'}</span></div></label>`).join('');

  const chips = (name, items) => items.map((v) => `
    <label class="chip"><input type="radio" name="${name}" value="${esc(v)}"><span>${esc(v)}</span></label>`).join('');
  $('#foodList').innerHTML = chips('food', CFG.FOODS);
  $('#drinkList').innerHTML = chips('drink', CFG.DRINKS);
  $('#sweetList').innerHTML = chips('sweetness', CFG.SWEETNESS);

  /* ---------- ที่นั่งคงเหลือ ---------- */
  API.call('info').then((info) => {
    const el = $('#seats');
    if (!el) return;
    if (info.runnersLeft <= 0) {
      el.textContent = 'ที่นั่งเต็มแล้ว';
      el.classList.add('full');
      const r = $('input[name=package][value=RUN]');
      r.disabled = true; r.checked = false;
      update();
    } else {
      el.textContent = 'เหลือ ' + info.runnersLeft + ' / ' + info.maxRunners + ' ที่';
    }
  }).catch(() => { /* ไม่แสดงจำนวนถ้าโหลดไม่ได้ */ });

  /* ---------- เติมข้อมูลที่เคยบันทึก ---------- */
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    if (saved) PROFILE_FIELDS.forEach((k) => { if (saved[k] && $('#' + k)) $('#' + k).value = saved[k]; });
  } catch (e) { /* ignore */ }

  ['#phone', '#emergencyPhone', '#zipcode'].forEach((s) => $(s).addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); }));

  /* ---------- สลับฟอร์มตามแพ็กเกจ + คำนวณยอด ---------- */
  const radio = (name) => { const r = $(`input[name="${name}"]:checked`); return r ? r.value : ''; };

  function update() {
    const code = radio('package');
    const p = code ? pkg(code) : null;
    const isRunner = !p || p.runner;     // ยังไม่เลือก → แสดงฟอร์มนักวิ่ง
    $$('[data-runner]').forEach((el) => el.classList.toggle('hidden', !isRunner));
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
  update();

  /* ---------- ตรวจฟอร์ม ---------- */
  function collect() {
    const d = {};
    PROFILE_FIELDS.concat(['note']).forEach((k) => { d[k] = $('#' + k).value.trim(); });
    ['package', 'food', 'drink', 'sweetness', 'delivery'].forEach((k) => { d[k] = radio(k); });
    d.consent = $('#consent').checked;
    return d;
  }

  function validate(d) {
    const errs = [];
    $$('.input.invalid').forEach((el) => el.classList.remove('invalid'));
    $$('[data-err]').forEach((el) => el.classList.add('hidden'));
    const bad = (id) => { $('#' + id).classList.add('invalid'); errs.push($('#' + id)); };
    const badGroup = (k) => { const el = $(`[data-err="${k}"]`); el.classList.remove('hidden'); errs.push(el); };

    const p = d.package ? pkg(d.package) : null;
    if (!p) badGroup('package');
    if (!d.firstName) bad('firstName');
    if (!d.lastName) bad('lastName');
    if (!/^0\d{8,9}$/.test(d.phone)) bad('phone');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) bad('email');
    if (p && p.runner) ['food', 'drink', 'sweetness'].forEach((k) => { if (!d[k]) badGroup(k); });
    if (d.delivery === 'SHIP') {
      if (d.address.length < 10) bad('address');
      if (!/^\d{5}$/.test(d.zipcode)) bad('zipcode');
    }
    if (!d.consent) badGroup('consent');

    if (errs.length) {
      errs[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast('กรุณากรอกข้อมูลให้ครบ', 'err');
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
      if ($('#remember').checked) {
        const p = {}; PROFILE_FIELDS.forEach((k) => { p[k] = d[k]; });
        try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (err) { /* ignore */ }
      }
      myBibs.add(runner.bib, runner.token);   // เครื่องนี้เปิดหน้าได้โดยไม่ต้องยืนยัน
      location.href = 'profile.html?bib=' + encodeURIComponent(runner.bib) + '&new=1';
    } catch (err) {
      toast(err.message, 'err');
      busy(btn, false);
    }
  });
})();
