/**
 * =====================================================================
 *  Admin Dashboard (admin.html)
 *  - ดึงข้อมูลด้วย action "list" ทุก ADMIN_REFRESH_SEC วินาที (near real-time)
 *  - สถิติ: นักวิ่ง/โควตา, รอตรวจสลิป, รายได้, ผ้าโพกหัว (รับที่งาน/จัดส่ง), อาหาร
 *  - งานหลังบ้าน: ตรวจสลิป (verify), บันทึกเลขพัสดุ (ship), เช็คอิน, แก้ไข, ลบ, CSV
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
  const f = { text: '', pkg: '', pay: '', del: '', inn: '' };   // ตัวกรองตาราง

  /* ---------- Login ---------- */
  async function enter(k) {
    const { role } = await API.call('auth', { key: k });
    if (role !== 'admin') throw new Error('รหัสนี้เป็นของเจ้าหน้าที่ ใช้ได้เฉพาะหน้าเช็คอิน');
    key = k;
    sessionStorage.setItem(KEY, k);
    $('#gate').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#topActions').classList.remove('hidden');
    if (API.isDemo) $('#demoTools').classList.remove('hidden');
    setupFilters();
    await refresh();
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
  $('#refreshBtn').addEventListener('click', refresh);

  /* ---------- สถิติ ---------- */
  const isRun = (r) => pkg(r.package).runner;
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
    const runners = rows.filter(isRun);
    const paidRunners = runners.filter(isPaid);
    const pending = rows.filter((r) => r.paymentStatus === 'SLIP_UPLOADED').length;
    const revenue = rows.filter(isPaid).reduce((s, r) => s + Number(r.amount || 0), 0);
    const inRun = paidRunners.filter(isIn).length;

    $('#kRunners').innerHTML = runners.length + '<small> / ' + CFG.MAX_RUNNERS + '</small>';
    $('#kRunBar').style.width = Math.min(100, (runners.length / CFG.MAX_RUNNERS) * 100) + '%';
    $('#kPending').textContent = pending;
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

    hbars($('#foodBars'), CFG.FOODS, paidRunners, 'food');
    hbars($('#drinkBars'), CFG.DRINKS, paidRunners, 'drink', { colors: Object.fromEntries(CFG.DRINKS.map((d) => [d, 'var(--sky)'])) });
    hbars($('#sweetBars'), CFG.SWEETNESS, paidRunners, 'sweetness', { colors: Object.fromEntries(CFG.SWEETNESS.map((d) => [d, 'var(--ink)'])) });
  }

  /* ---------- ตัวกรอง ---------- */
  function setupFilters() {
    $('#fPkg').innerHTML = '<option value="">ทุกแพ็กเกจ</option>' + CFG.PACKAGES.map((p) => `<option value="${esc(p.code)}">${esc(p.label)}</option>`).join('');
    $('#fPay').innerHTML = '<option value="">ทุกสถานะชำระ</option>' + Object.keys(PAY_LABEL).map((k) => `<option value="${k}">${PAY_LABEL[k]}</option>`).join('');
    const opts = (arr) => arr.map((v) => `<option>${esc(v)}</option>`).join('');
    $('#editForm [name=food]').innerHTML = opts(CFG.FOODS);
    $('#editForm [name=drink]').innerHTML = opts(CFG.DRINKS);
    $('#editForm [name=sweetness]').innerHTML = opts(CFG.SWEETNESS);
  }

  $('#fText').addEventListener('input', (e) => { f.text = e.target.value.trim().toLowerCase(); renderTable(); });
  [['#fPkg', 'pkg'], ['#fPay', 'pay'], ['#fDel', 'del'], ['#fIn', 'inn']].forEach(([s, k]) =>
    $(s).addEventListener('change', (e) => { f[k] = e.target.value; renderTable(); }));

  const setPayFilter = (v) => { f.pay = v; $('#fPay').value = v; renderTable(); $('.table-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  $('#payBars').addEventListener('click', (e) => { const b = e.target.closest('[data-pay]'); if (b) setPayFilter(f.pay === b.dataset.pay ? '' : b.dataset.pay); });
  $('#kPendingBox').addEventListener('click', () => setPayFilter('SLIP_UPLOADED'));

  function filtered() {
    return rows.filter((r) => {
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
    $('#rowCount').textContent = list.length + ' / ' + rows.length + ' รายการ';
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
          ${r.hasSlip && !paid ? '<button class="btn btn-sm btn-dark" data-act="slip">ตรวจสลิป</button>' : ''}
          ${r.hasSlip && paid ? '<button class="btn btn-sm" data-act="slip">สลิป</button>' : ''}
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
    const paid = isPaid(r);
    $('#sApprove').classList.toggle('hidden', paid);
    $('#sReject').classList.toggle('hidden', paid);
    $('#sReason').classList.toggle('hidden', paid);
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
      toast(current.bib + (approve ? ' ยืนยันการชำระแล้ว · ส่งอีเมลแจ้งแล้ว' : ' แจ้งให้แนบสลิปใหม่แล้ว'), 'ok');
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
    const cols = ['bib', 'package', 'firstName', 'lastName', 'nickname', 'gender', 'phone', 'email', 'food', 'drink', 'sweetness',
      'delivery', 'address', 'zipcode', 'amount', 'paymentStatus', 'paidAt', 'shipStatus', 'trackingNo', 'status', 'checkinAt', 'checkinBy', 'note', 'createdAt'];
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

  /* ---------- Demo tools ---------- */
  $('#seedBtn').addEventListener('click', async () => { API.demo.seed(40); await refresh(); toast('เพิ่มข้อมูลตัวอย่างแล้ว', 'ok'); });
  $('#resetBtn').addEventListener('click', async () => { if (confirm('ล้างข้อมูล Demo ทั้งหมด?')) { API.demo.reset(); await refresh(); } });
})();
