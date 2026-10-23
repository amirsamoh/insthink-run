/**
 * =====================================================================
 *  Admin Dashboard (admin.html)
 *  - ดึงข้อมูลด้วย action "list" ทุก ADMIN_REFRESH_SEC วินาที (near real-time)
 *  - สถิติ: นักวิ่ง, ยังไม่ชำระ, รายได้, ผ้าโพกหัว (รับที่งาน/จัดส่ง), เครื่องดื่ม, แพ้อาหาร (กรองตามอีเวนต์ได้)
 *  - การชำระเงินยืนยันอัตโนมัติเมื่อแนบสลิป · แอดมินดูสลิป/ปฏิเสธได้ (verify), บันทึกเลขพัสดุ (ship), เช็คอิน, แก้ไข, ลบ, CSV
 * =====================================================================
 */
(function () {
  const CFG = window.APP_CONFIG;
  const { $, $$, esc, toast, busy, pkg, money, PAY_LABEL, payPill, fmtDate } = window.U;
  const KEY = 'irc_admin_key';

  let key = sessionStorage.getItem(KEY) || '';
  let rows = [];
  let timer = null;
  let loading = false;
  const f = { text: '', pkg: '', pay: '', del: '', inn: '', event: CFG.EVENT.id };   // ตัวกรองตาราง

  /* ---------- Login ---------- */
  async function enter(k) {
    const { role } = await API.call('auth', { key: k });
    if (role !== 'admin') throw new Error('รหัสนี้เป็นของเจ้าหน้าที่ ใช้ได้เฉพาะหน้าเช็คอิน');
    key = k;
    sessionStorage.setItem(KEY, k);
    $('#gate').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#topActions').classList.remove('hidden');
    setupFilters();
    await refresh();
    loadFeedback();
    schedule();
  }

  $('#gate').addEventListener('submit', async (e) => {
    e.preventDefault();
    busy($('#gateBtn'), true, 'ตรวจสอบ…');
    try { await enter($('#adminKey').value.trim()); }
    catch (err) { toast(err.message, 'err'); }
    finally { busy($('#gateBtn'), false); }
  });
  $('#logoutBtn').addEventListener('click', () => { sessionStorage.removeItem(KEY); location.reload(); });
  if (key) enter(key).catch(() => sessionStorage.removeItem(KEY));

  /* ---------- ดึงข้อมูล + อัปเดตอัตโนมัติ ---------- */
  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      rows = await API.call('list', { key });
      eventOptions();
      $('#updated').textContent = 'อัปเดต ' + new Date().toLocaleTimeString('th-TH');
      renderStats();
      renderTable();
    } catch (err) {
      $('#updated').textContent = 'เชื่อมต่อไม่ได้';
      toast(err.message, 'err');
    } finally {
      loading = false;
    }
  }

  function schedule() {
    clearInterval(timer);
    const on = $('#auto').checked;
    $('#live').classList.toggle('off', !on);
    // ไม่ดึงข้อมูลตอนแท็บถูกซ่อน (ประหยัดโควตา Apps Script) / ไม่ดึงตอนเปิดหน้าต่างแก้ไขอยู่
    if (on) timer = setInterval(() => { if (!document.hidden && !$$('.modal:not(.hidden)').length) refresh(); }, CFG.ADMIN_REFRESH_SEC * 1000);
  }
  $('#auto').addEventListener('change', schedule);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && $('#auto').checked && key) refresh(); });
  $('#refreshBtn').addEventListener('click', () => { refresh(); loadFeedback(); });

  /* ---------- หลังจบงาน: สวิตช์ + ผลแบบประเมิน ---------- */
  async function loadFeedback() {
    try {
      const d = await API.call('feedbackList', { key });
      $('#postToggle').checked = !!d.postEvent;
      const list = d.list.filter((x) => !f.event || x.eventId === f.event);
      const avg = list.length ? list.reduce((s, x) => s + x.rating, 0) / list.length : 0;
      const dist = [5, 4, 3, 2, 1].map((n) => [n, list.filter((x) => x.rating === n).length]);
      $('#fbSum').innerHTML = list.length
        ? `<div class="fb-avg"><b>${avg.toFixed(1)}</b><span>${'★'.repeat(Math.round(avg))}${'☆'.repeat(5 - Math.round(avg))}</span><small>${list.length} คนตอบ</small></div>
           <div class="hbars">${dist.map(([n, c]) => `<div class="hbar"><span class="lbl">${n} ดาว</span><div class="track"><div class="fill" style="width:${(c / list.length) * 100}%;background:var(--lime)"></div></div><span class="val">${c}</span></div>`).join('')}</div>`
        : '<p class="muted small" style="margin:12px 0 0">ยังไม่มีผลแบบประเมิน</p>';
      $('#fbList').innerHTML = list.filter((x) => x.comment).slice(0, 30).map((x) => `<div class="fb-item"><div><b>${esc(x.bib)}</b> ${esc(x.name)} <span class="fb-st">${'★'.repeat(x.rating)}</span></div><p>${esc(x.comment)}</p></div>`).join('');
    } catch (err) { $('#fbSum').innerHTML = '<p class="muted small">โหลดผลแบบประเมินไม่ได้: ' + esc(err.message) + '</p>'; }
  }
  $('#postToggle').addEventListener('change', async (e) => {
    const on = e.target.checked;
    if (!confirm(on ? 'เปิดโหมดหลังจบงาน?\nผู้สมัครจะเห็นรูป Finisher และแบบประเมินทันที' : 'ปิดโหมดหลังจบงาน?')) { e.target.checked = !on; return; }
    try {
      const d = await API.call('setFlag', { key, name: 'POST_EVENT', value: on });
      e.target.checked = d.postEvent;
      toast(d.postEvent ? 'เปิดโหมดหลังจบงานแล้ว' : 'ปิดโหมดหลังจบงานแล้ว', 'ok');
    } catch (err) { e.target.checked = !on; toast(err.message, 'err'); }
  });

  /* ---------- สถิติ ---------- */
  const isRun = (r) => pkg(r.package).runner;
  // รายการของอีเวนต์ที่เลือก (ข้อมูลเก่าที่ไม่มี eventId นับเป็นรอบแรก)
  const evOf = (r) => r.eventId || CFG.EVENT.id;
  const scoped = () => (f.event ? rows.filter((r) => evOf(r) === f.event) : rows);
  const isPaid = (r) => r.paymentStatus === 'PAID';
  const isIn = (r) => r.status === 'CHECKED_IN';

  function hbars(el, labels, list, field, opts) {
    const o = opts || {};
    const counts = list.reduce((m, r) => { m[r[field]] = (m[r[field]] || 0) + 1; return m; }, {});
    const max = Math.max(1, ...labels.map((l) => counts[l] || 0));
    el.innerHTML = labels.map((l) => {
      const n = counts[l] || 0;
      return `<div class="hbar ${o.click ? 'click' : ''}" ${o.click ? `data-pay="${esc(l)}"` : ''}>
        <span class="lbl" title="${esc((o.names && o.names[l]) || l)}">${esc((o.names && o.names[l]) || l)}</span>
        <div class="track"><div class="fill" style="width:${(n / max) * 100}%;${o.colors ? 'background:' + o.colors[l] : ''}"></div></div>
        <span class="val">${n}</span></div>`;
    }).join('');
  }

  function renderStats() {
    const rows = scoped();
    const runners = rows.filter(isRun);
    const paidRunners = runners.filter(isPaid);
    const unpaid = rows.filter((r) => r.paymentStatus === 'UNPAID').length;
    const revenue = rows.filter(isPaid).reduce((s, r) => s + Number(r.amount || 0), 0);
    const inRun = paidRunners.filter(isIn).length;

    $('#kRunners').innerHTML = runners.length + '<small> คน</small>';
    $('#kPending').textContent = unpaid;
    $('#kRevenue').textContent = money(revenue);
    $('#kBandana').innerHTML = rows.filter(isPaid).length + '<small> ผืน</small>';
    $('#kIn').innerHTML = inRun + '<small> / ' + paidRunners.length + '</small>';
    $('#kInBar').style.width = (paidRunners.length ? (inRun / paidRunners.length) * 100 : 0) + '%';

    hbars($('#payBars'), Object.keys(PAY_LABEL), rows, 'paymentStatus', {
      click: true, names: PAY_LABEL,
      colors: { UNPAID: 'var(--warn)', SLIP_UPLOADED: 'var(--info)', PAID: 'var(--ok)', REJECTED: 'var(--bad)' },
    });

    // ผ้าโพกหัว: นับเฉพาะรายการที่ชำระแล้ว
    const paid = rows.filter(isPaid);
    const pickup = paid.filter((r) => r.delivery !== 'SHIP');
    const ship = paid.filter((r) => r.delivery === 'SHIP');
    const shipped = ship.filter((r) => r.shipStatus === 'SHIPPED').length;
    $('#bandanaStats').innerHTML = `
      <div><span>รับที่งาน · มอบแล้ว</span><b>${pickup.filter(isIn).length} / ${pickup.length}</b></div>
      <div><span>จัดส่ง · รอส่ง</span><b style="color:var(--warn)">${ship.length - shipped}</b></div>
      <div><span>จัดส่ง · ส่งแล้ว</span><b>${shipped}</b></div>
      <div><span>ซื้อผ้าโพกหัวอย่างเดียว</span><b>${paid.filter((r) => !isRun(r)).length}</b></div>`;

    hbars($('#drinkBars'), CFG.DRINKS, paidRunners, 'drink', { colors: Object.fromEntries(CFG.DRINKS.map((d) => [d, 'var(--sky)'])) });
    // ชวนเพื่อน: นับรายการที่มี ref (ทุกแพ็กเกจ) แยกตามคนชวน
    const byRef = {};
    rows.forEach((r) => { if (r.ref) byRef[r.ref] = (byRef[r.ref] || 0) + 1; });
    const top = Object.entries(byRef).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const who = (b) => rows.find((x) => x.bib === b) || {};
    $('#inviteTop').innerHTML = top.length
      ? '<ol class="rank">' + top.map(([b, n], i) => `<li><i>${i + 1}</i><span><b>${esc(b)}</b> ${esc(who(b).nickname || who(b).firstName || '')}</span><em>${n} คน</em></li>`).join('') + '</ol><p class="muted small" style="margin:8px 0 0">สมัครผ่านลิงก์ชวนเพื่อนรวม ' + rows.filter((r) => r.ref).length + ' รายการ</p>'
      : '<p class="muted small" style="margin:12px 0 0">ยังไม่มีใครสมัครผ่านลิงก์ชวนเพื่อน</p>';

    const allergy = paidRunners.filter((r) => r.note && !/^(ไม่แพ้|ไม่มี|-|no)/i.test(r.note));
    $('#allergyList').innerHTML = allergy.length
      ? allergy.map((r) => `<div><b>${esc(r.bib)}</b> ${esc(r.nickname || r.firstName)} — ${esc(r.note)}</div>`).join('')
      : '<span class="muted">ไม่มีผู้แจ้งแพ้อาหาร</span>';
  }

  /* ---------- ตัวกรอง ---------- */
  function setupFilters() {
    $('#fPkg').innerHTML = '<option value="">ทุกแพ็กเกจ</option>' + CFG.PACKAGES.map((p) => `<option value="${esc(p.code)}">${esc(p.label)}</option>`).join('');
    $('#fPay').innerHTML = '<option value="">ทุกสถานะชำระ</option>' + Object.keys(PAY_LABEL).map((k) => `<option value="${k}">${PAY_LABEL[k]}</option>`).join('');
    const opts = (arr) => arr.map((v) => `<option>${esc(v)}</option>`).join('');
    $('#editForm [name=drink]').innerHTML = opts(CFG.DRINKS);
  }

  // ตัวเลือกอีเวนต์: รวมทุกรอบที่มีในข้อมูล + รอบปัจจุบัน
  function eventOptions() {
    const ids = Array.from(new Set([CFG.EVENT.id].concat(rows.map(evOf))));
    const sel = $('#fEvent');
    sel.innerHTML = '<option value="">ทุกอีเวนต์</option>' + ids.map((v) => `<option value="${esc(v)}">${esc(v)}${v === CFG.EVENT.id ? ' (รอบนี้)' : ''}</option>`).join('');
    sel.value = f.event;
  }
  $('#fEvent').addEventListener('change', (e) => { f.event = e.target.value; renderStats(); renderTable(); loadFeedback(); });

  $('#fText').addEventListener('input', (e) => { f.text = e.target.value.trim().toLowerCase(); renderTable(); });
  [['#fPkg', 'pkg'], ['#fPay', 'pay'], ['#fDel', 'del'], ['#fIn', 'inn']].forEach(([s, k]) =>
    $(s).addEventListener('change', (e) => { f[k] = e.target.value; renderTable(); }));

  const setPayFilter = (v) => { f.pay = v; $('#fPay').value = v; renderTable(); $('.table-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  $('#payBars').addEventListener('click', (e) => { const b = e.target.closest('[data-pay]'); if (b) setPayFilter(f.pay === b.dataset.pay ? '' : b.dataset.pay); });
  $('#kPendingBox').addEventListener('click', () => setPayFilter('UNPAID'));

  function filtered() {
    return scoped().filter((r) => {
      if (f.pkg && r.package !== f.pkg) return false;
      if (f.pay && r.paymentStatus !== f.pay) return false;
      if (f.inn && r.status !== f.inn) return false;
      if (f.del === 'PICKUP' && r.delivery === 'SHIP') return false;
      if (f.del === 'SHIP_PENDING' && !(r.delivery === 'SHIP' && r.shipStatus !== 'SHIPPED')) return false;
      if (f.del === 'SHIP_SHIPPED' && r.shipStatus !== 'SHIPPED') return false;
      if (f.text && ![r.bib, r.firstName, r.lastName, r.nickname, r.phone, r.email].join(' ').toLowerCase().includes(f.text)) return false;
      return true;
    });
  }

  /* ---------- ตาราง ---------- */
  function deliveryCell(r) {
    if (r.delivery !== 'SHIP') return '<span class="muted">รับที่งาน</span>';
    return r.shipStatus === 'SHIPPED'
      ? `<span class="pill ok">ส่งแล้ว</span> <span class="muted small">${esc(r.trackingNo)}</span>`
      : '<span class="pill warn">รอส่ง</span>';
  }

  function renderTable() {
    const list = filtered().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    $('#rowCount').textContent = list.length + ' / ' + scoped().length + ' รายการ';
    $('#tbody').innerHTML = list.length ? list.map((r) => {
      const p = pkg(r.package);
      const paid = isPaid(r);
      const canIn = paid && (p.runner || r.delivery !== 'SHIP');
      return `<tr data-bib="${esc(r.bib)}">
        <td><span class="bib ${p.runner ? '' : 'm'}">${esc(r.bib)}</span></td>
        <td>${esc(r.firstName)} ${esc(r.lastName)}${r.nickname ? ' <span class="muted">(' + esc(r.nickname) + ')</span>' : ''}</td>
        <td>${esc(r.phone)}</td>
        <td>${esc(p.label)}</td>
        <td>${money(r.amount)}</td>
        <td>${payPill(r.paymentStatus)}</td>
        <td>${deliveryCell(r)}</td>
        <td>${canIn ? (isIn(r) ? '<span class="pill ok">แล้ว</span> <span class="muted small">' + esc(fmtDate(r.checkinAt, true)) + '</span>' : '<span class="muted">ยัง</span>') : '<span class="muted">–</span>'}</td>
        <td><div class="actions">
          ${r.hasSlip ? '<button class="btn btn-sm" data-act="slip">ดูสลิป</button>' : ''}
          ${paid && r.delivery === 'SHIP' && r.shipStatus !== 'SHIPPED' ? '<button class="btn btn-sm btn-dark" data-act="ship">จัดส่ง</button>' : ''}
          ${canIn ? `<button class="btn btn-sm" data-act="toggle">${isIn(r) ? 'ยกเลิกเช็คอิน' : 'เช็คอิน'}</button>` : ''}
          <button class="btn btn-sm" data-act="edit">แก้ไข</button>
          <button class="btn btn-sm btn-danger" data-act="del">ลบ</button>
        </div></td></tr>`;
    }).join('') : '<tr><td colspan="9" class="center muted" style="padding:30px">ไม่มีข้อมูล</td></tr>';
  }

  /* ---------- Actions ในตาราง (event delegation) ---------- */
  $('#tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const bib = btn.closest('tr').dataset.bib;
    const r = rows.find((x) => x.bib === bib);
    if (!r) return;
    const act = btn.dataset.act;

    if (act === 'edit') return openEdit(r);
    if (act === 'slip') return openSlip(r);
    if (act === 'ship') return openShip(r);
    if (act === 'del' && !confirm(`ลบ ${bib} (${r.firstName}) ถาวร?\nเลขนี้จะไม่ถูกนำกลับมาใช้อีก`)) return;

    busy(btn, true, '…');
    try {
      if (act === 'toggle') {
        await API.call('update', { key, bib, fields: { status: isIn(r) ? 'REGISTERED' : 'CHECKED_IN' } });
        toast(bib + (isIn(r) ? ' ยกเลิกเช็คอินแล้ว' : ' เช็คอินแล้ว'), 'ok');
      } else if (act === 'del') {
        await API.call('remove', { key, bib });
        toast('ลบ ' + bib + ' แล้ว', 'ok');
      }
      await refresh();
    } catch (err) {
      toast(err.message, 'err');
      busy(btn, false);
    }
  });

  // ปุ่มปิด modal ทุกอัน
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('.modal').classList.add('hidden')));

  /* ---------- ตรวจสลิป ---------- */
  let current = null;
  async function openSlip(r) {
    current = r;
    $('#sBib').textContent = r.bib;
    $('#sInfo').innerHTML = `
      <div class="row"><span>${esc(r.firstName)} ${esc(r.lastName)}</span><span>${esc(pkg(r.package).label)}</span></div>
      <div class="row"><span>ส่งสลิปเมื่อ ${esc(fmtDate(r.slipAt, true))}</span><span>${payPill(r.paymentStatus)}</span></div>
      <div class="row total"><span>ยอดที่ต้องได้รับ</span><b>${money(r.amount)}</b></div>`;
    $('#sImg').removeAttribute('src');
    $('#sImg').alt = 'กำลังโหลดสลิป…';
    $('#sLink').classList.add('hidden');
    $('#sReason').value = '';
    // ระบบอนุมัติให้อัตโนมัติแล้ว: แอดมินใช้หน้านี้ดูสลิป และ "ปฏิเสธ" ได้เฉพาะกรณีสลิปผิดปกติ
    const paid = isPaid(r);
    $('#sApprove').classList.toggle('hidden', paid);
    $('#slipModal').classList.remove('hidden');
    try {
      const s = await API.call('slip', { key, bib: r.bib });
      $('#sImg').src = s.image;
      if (s.url) { $('#sLink').href = s.url; $('#sLink').classList.remove('hidden'); }
    } catch (err) {
      $('#sImg').alt = err.message;
    }
  }

  async function verify(approve) {
    if (!approve && !$('#sReason').value.trim()) { $('#sReason').focus(); return toast('กรุณาระบุเหตุผล', 'err'); }
    const btn = approve ? $('#sApprove') : $('#sReject');
    busy(btn, true, '…');
    try {
      await API.call('verify', { key, bib: current.bib, approve, reason: $('#sReason').value.trim() });
      $('#slipModal').classList.add('hidden');
      toast(current.bib + (approve ? ' ยืนยันการชำระแล้ว' : ' ปฏิเสธสลิปแล้ว · ผู้สมัครแนบใหม่ได้'), 'ok');
      await refresh();
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      busy(btn, false);
    }
  }
  $('#sApprove').addEventListener('click', () => verify(true));
  $('#sReject').addEventListener('click', () => verify(false));

  /* ---------- จัดส่ง ---------- */
  function openShip(r) {
    current = r;
    $('#shBib').textContent = r.bib;
    $('#shAddr').textContent = `${r.firstName} ${r.lastName} · ${r.phone}\n${r.address || ''} ${r.zipcode || ''}`;
    $('#shAddr').style.whiteSpace = 'pre-line';
    $('#shTrack').value = '';
    $('#shipModal').classList.remove('hidden');
    setTimeout(() => $('#shTrack').focus(), 50);
  }
  $('#shipForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = $('#shTrack').value.trim().toUpperCase();
    if (!t) return toast('กรอกเลขพัสดุ', 'err');
    busy($('#shSave'), true, '…');
    try {
      await API.call('ship', { key, bib: current.bib, trackingNo: t });
      $('#shipModal').classList.add('hidden');
      toast(current.bib + ' บันทึกการจัดส่งแล้ว', 'ok');
      await refresh();
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      busy($('#shSave'), false);
    }
  });

  /* ---------- แก้ไขข้อมูล ---------- */
  function openEdit(r) {
    current = r;
    $('#eBib').textContent = r.bib;
    $$('#editForm [data-run]').forEach((el) => el.classList.toggle('hidden', !isRun(r)));
    $$('#editForm [data-ship]').forEach((el) => el.classList.toggle('hidden', r.delivery !== 'SHIP'));
    $$('#editForm [name]').forEach((el) => { el.value = r[el.name] || ''; });
    $('#editModal').classList.remove('hidden');
  }
  $('#editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fields = {};
    $$('#editForm [name]').forEach((el) => { if (!el.closest('.hidden')) fields[el.name] = el.value.trim(); });
    busy($('#eSave'), true, 'บันทึก…');
    try {
      await API.call('update', { key, bib: current.bib, fields });
      $('#editModal').classList.add('hidden');
      toast('บันทึกแล้ว', 'ok');
      await refresh();
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      busy($('#eSave'), false);
    }
  });

  /* ---------- ส่งออก CSV (เปิดใน Excel ภาษาไทยได้ เพราะใส่ BOM) ---------- */
  $('#csvBtn').addEventListener('click', () => {
    const cols = ['bib', 'package', 'firstName', 'lastName', 'nickname', 'gender', 'phone', 'email', 'drink', 'sweetness',
      'delivery', 'address', 'zipcode', 'amount', 'paymentStatus', 'paidAt', 'shipStatus', 'trackingNo', 'status', 'checkinAt', 'checkinBy', 'note', 'ref', 'eventId', 'createdAt'];
    const cell = (v) => {
      let s = String(v == null ? '' : v);
      if (/^[=+\-@]/.test(s)) s = "'" + s;   // กันสูตรใน Excel
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const csv = '﻿' + [cols.join(',')].concat(filtered().map((r) => cols.map((c) => cell(r[c])).join(','))).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'insthink-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

})();
