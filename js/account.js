/**
 * =====================================================================
 *  หน้าบัญชีของฉัน (account.html)
 *  แก้ข้อมูลส่วนตัว + รูปโปรไฟล์ · ดูรายการสมัครทุกอีเวนต์ · เปลี่ยนรหัสผ่าน · ออกจากระบบ
 * =====================================================================
 */
(function () {
  const CFG = window.APP_CONFIG;
  const { $, esc, toast, busy, normPhone, compressAvatar, avatarHtml, pkg, payPill, money } = window.U;
  const FIELDS = ['firstName', 'lastName', 'nickname', 'gender', 'birthDate', 'phone', 'emergencyName', 'emergencyPhone'];

  if (!Auth.loggedIn()) location.replace('login.html?next=account.html');

  let member = Auth.member() || {};
  let newPhoto = '';       // รูปใหม่ที่ยังไม่ได้บันทึก
  let removePhoto = false;

  function fill(m) {
    member = m;
    FIELDS.forEach((k) => { $('#' + k).value = m[k] || ''; });
    $('#aEmail').textContent = m.email || '';
    paint();
  }
  function paint() {
    const photo = removePhoto ? '' : (newPhoto || member.photo);
    $('#aAvatar').innerHTML = avatarHtml({ photo, firstName: $('#firstName').value || member.firstName, nickname: $('#nickname').value }, 'lg');
    $('#aRemove').classList.toggle('hidden', !photo);
  }
  fill(member);

  // ดึงข้อมูลล่าสุดจากเซิร์ฟเวอร์ (และตรวจว่า session ยังใช้ได้)
  API.call('me').then((r) => { Auth.setMember(r.member); fill(r.member); })
    .catch((e) => { toast(e.message, 'err'); if (!Auth.loggedIn()) location.replace('login.html?next=account.html'); });

  ['#phone', '#emergencyPhone'].forEach((s) => $(s).addEventListener('change', (e) => { e.target.value = normPhone(e.target.value); }));
  $('#firstName').addEventListener('input', paint);

  $('#aPhoto').addEventListener('change', async (e) => {
    try { newPhoto = await compressAvatar(e.target.files[0]); removePhoto = false; paint(); }
    catch (err) { toast(err.message, 'err'); }
  });
  $('#aRemove').addEventListener('click', () => { newPhoto = ''; removePhoto = true; paint(); });

  $('#acctForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = {};
    FIELDS.forEach((k) => { d[k] = $('#' + k).value.trim(); });
    d.phone = normPhone(d.phone); d.emergencyPhone = normPhone(d.emergencyPhone);
    if (!d.firstName || !d.lastName) return toast('กรอกชื่อและนามสกุล', 'err');
    if (!/^0\d{8,9}$/.test(d.phone)) return toast('เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก', 'err');
    if (newPhoto) d.photo = newPhoto;
    if (removePhoto) d.removePhoto = true;
    busy($('#aSave'), true, 'กำลังบันทึก…');
    try {
      const r = await API.call('updateMe', d);
      Auth.setMember(r.member); newPhoto = ''; removePhoto = false; fill(r.member);
      toast('บันทึกแล้ว', 'ok');
    } catch (err) { toast(err.message, 'err'); }
    finally { busy($('#aSave'), false); }
  });

  /* ---------- รายการสมัคร ---------- */
  API.call('myRegs').then(({ regs }) => {
    if (!regs.length) {
      $('#regs').innerHTML = '<p class="muted">ยังไม่มีรายการ — <a href="index.html">สมัครวิ่งเลย</a></p>';
      return;
    }
    $('#regs').innerHTML = regs.map((r) => {
      const p = pkg(r.package);
      // เก็บ token ไว้ในเครื่อง เพื่อเปิดหน้ารายการได้ทันที
      window.U.myBibs.add(r.bib, r.token);
      return `<a class="result" href="profile.html?bib=${encodeURIComponent(r.bib)}">
        <span class="bib-tag ${p.runner ? '' : 'm'}">${esc(r.bib)}</span>
        <span class="who"><b>${esc(p.title)}</b><span>${esc(r.eventId || '')} · ${money(r.amount)}</span></span>${payPill(r.paymentStatus)}</a>`;
    }).join('');
  }).catch((e) => { $('#regs').innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; });

  /* ---------- รหัสผ่าน / ออกจากระบบ ---------- */
  $('#pwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldPassword = $('#oldPw').value, newPassword = $('#newPw').value;
    if (newPassword.length < 8) return toast('รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร', 'err');
    busy($('#pwBtn'), true, '…');
    try {
      await API.call('updateMe', { oldPassword, newPassword });
      $('#pwForm').reset(); toast('เปลี่ยนรหัสผ่านแล้ว', 'ok');
    } catch (err) { toast(err.message, 'err'); }
    finally { busy($('#pwBtn'), false); }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    try { await API.call('logout'); } catch (e) { /* ออกจากเครื่องนี้ต่อไป */ }
    Auth.clear(); location.href = 'index.html';
  });
})();
