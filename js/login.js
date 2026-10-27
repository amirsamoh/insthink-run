/**
 * =====================================================================
 *  หน้าเข้าสู่ระบบ / สมัครสมาชิกแพลตฟอร์ม (login.html)
 *  - สมัครสมาชิก: ชื่อ เบอร์ อีเมล รหัสผ่าน + รูปโปรไฟล์ (ไม่บังคับ)
 *  - เข้าสู่ระบบ / ลืมรหัสผ่าน (ส่งรหัส 6 หลักทางอีเมล)
 *  - สำเร็จแล้วไปหน้า ?next= (ค่าเริ่มต้น: index.html)
 * =====================================================================
 */
(function () {
  const { $, $$, toast, busy, normPhone, compressAvatar, avatarHtml } = window.U;

  // ปลายทางหลังล็อกอิน — รับเฉพาะชื่อไฟล์ .html ในเว็บเรา (กัน open redirect)
  const next = (() => {
    const n = new URLSearchParams(location.search).get('next') || '';
    return /^[a-z0-9_-]+\.html(\?[\w=&%-]*)?$/i.test(n) ? n : 'register.html';
  })();

  if (Auth.loggedIn()) location.replace(next);

  /* ---------- สลับแท็บ ---------- */
  const forms = { login: $('#loginForm'), signup: $('#signupForm'), forgot: $('#forgotForm') };
  function show(name) {
    Object.keys(forms).forEach((k) => forms[k].classList.toggle('hidden', k !== name));
    $('#tabs').classList.toggle('hidden', name === 'forgot');
    $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  }
  $$('#tabs button').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
  $('#toForgot').addEventListener('click', (e) => { e.preventDefault(); $('#fEmail').value = $('#lEmail').value; show('forgot'); });
  $('#backLogin').addEventListener('click', (e) => { e.preventDefault(); show('login'); });
  if (location.hash === '#signup') show('signup');

  const done = (r, msg) => {
    Auth.set(r.session, r.member);
    if (msg) { toast(msg, 'ok'); setTimeout(() => { location.href = next; }, 1200); } else location.href = next;
  };
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  /* ---------- เข้าสู่ระบบ ---------- */
  forms.login.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#lEmail').value.trim(), password = $('#lPass').value;
    if (!emailOk(email) || !password) return toast('กรอกอีเมลและรหัสผ่านให้ครบ', 'err');
    busy($('#lBtn'), true, 'กำลังเข้าสู่ระบบ…');
    try { done(await API.call('login', { email, password })); }
    catch (err) { toast(err.message, 'err'); busy($('#lBtn'), false); }
  });

  /* ---------- สมัครสมาชิก ---------- */
  let photo = '';
  const paintAvatar = () => { $('#sAvatar').innerHTML = avatarHtml({ photo, firstName: $('#sFirst').value || '?' }, 'lg'); };
  paintAvatar();
  $('#sFirst').addEventListener('input', () => { if (!photo) paintAvatar(); });
  $('#sPhoto').addEventListener('change', async (e) => {
    try { photo = await compressAvatar(e.target.files[0]); paintAvatar(); }
    catch (err) { toast(err.message, 'err'); }
  });
  $('#sPhone').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^\d+ -]/g, ''); });

  forms.signup.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = {
      firstName: $('#sFirst').value.trim(), lastName: $('#sLast').value.trim(), nickname: $('#sNick').value.trim(), gender: $('#sGender').value,
      phone: normPhone($('#sPhone').value), email: $('#sEmail').value.trim(), password: $('#sPass').value, photo,
    };
    const bad = !d.firstName ? 'กรอกชื่อ' : !d.lastName ? 'กรอกนามสกุล'
      : !/^0\d{8,9}$/.test(d.phone) ? 'เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก'
      : !emailOk(d.email) ? 'อีเมลไม่ถูกต้อง' : d.password.length < 8 ? 'รหัสผ่านอย่างน้อย 8 ตัวอักษร' : '';
    if (bad) return toast(bad, 'err');
    busy($('#sBtn'), true, 'กำลังสมัคร…');
    try { done(await API.call('signup', d), 'สมัครสมาชิกสำเร็จ'); }
    catch (err) { toast(err.message, 'err'); busy($('#sBtn'), false); }
  });

  /* ---------- ลืมรหัสผ่าน ---------- */
  forms.forgot.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#fEmail').value.trim();
    if (!emailOk(email)) return toast('กรอกอีเมลให้ถูกต้อง', 'err');
    busy($('#fBtn'), true, 'กำลังส่ง…');
    try {
      await API.call('forgot', { email });
      toast('ถ้ามีบัญชีนี้ ระบบส่งรหัสไปที่อีเมลแล้ว (ตรวจกล่องสแปมด้วย)', 'ok');
      $('#resetBox').classList.remove('hidden');
    } catch (err) { toast(err.message, 'err'); }
    finally { busy($('#fBtn'), false); }
  });
  $('#rBtn').addEventListener('click', async () => {
    const email = $('#fEmail').value.trim(), code = $('#fCode').value.trim(), newPassword = $('#fNew').value;
    if (code.length !== 6 || newPassword.length < 8) return toast('กรอกรหัส 6 หลัก และรหัสผ่านใหม่ (8 ตัวขึ้นไป)', 'err');
    busy($('#rBtn'), true, '…');
    try { done(await API.call('reset', { email, code, newPassword })); }
    catch (err) { toast(err.message, 'err'); busy($('#rBtn'), false); }
  });
})();
