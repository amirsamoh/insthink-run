/**
 * =====================================================================
 *  API Layer — ทุกหน้าเรียก backend ผ่าน API.call(action, payload)
 *  - มี API_URL  → ส่งไป Google Apps Script
 *  - ไม่มี API_URL → ใช้ DemoBackend (localStorage) ที่ทำงานเหมือนของจริง
 *    (ยกเว้นการส่งอีเมล และสลิปเก็บในเบราว์เซอร์แทน Google Drive)
 * =====================================================================
 */
(function () {
  const CFG = window.APP_CONFIG;

  /* ---------------- Remote (Google Apps Script) ---------------- */
  async function remote(action, payload) {
    const res = await fetch(CFG.API_URL, {
      method: 'POST',
      // text/plain = "simple request" → ไม่มี CORS preflight (Apps Script ไม่รองรับ OPTIONS)
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action }, payload || {})),
      redirect: 'follow',
    });
    if (!res.ok) throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (' + res.status + ')');
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'เกิดข้อผิดพลาด');
    return json.data;
  }

  /* ---------------- Demo backend (localStorage) ---------------- */
  const DB_KEY = 'irc_demo_db_v2';
  const KEYS = { 'demo-admin': 'admin', 'demo-staff': 'staff' };
  const pkgOf = (code) => CFG.PACKAGES.find((p) => p.code === code);
  const shipFee = (CFG.DELIVERY.find((d) => d.code === 'SHIP') || { fee: 0 }).fee;

  const db = {
    load() {
      try { return JSON.parse(localStorage.getItem(DB_KEY)) || { runners: [], seq: {}, slips: {} }; }
      catch (e) { return { runners: [], seq: {}, slips: {} }; }
    },
    save(d) {
      try { localStorage.setItem(DB_KEY, JSON.stringify(d)); }
      catch (e) { throw new Error('พื้นที่เก็บข้อมูล Demo เต็ม — กด "ล้างข้อมูล Demo" ในหน้า Admin'); }
    },
  };

  // ข้อมูลที่ส่งกลับให้เจ้าของ (เลียนแบบ full_() ใน Code.gs)
  const full = (r, priv) => {
    const o = Object.assign({}, r);
    ['phone', 'email', 'emergencyName', 'emergencyPhone', 'birthDate', 'gender', 'checkinBy', 'note'].forEach((k) => delete o[k]);
    if (!priv) { delete o.token; delete o.address; delete o.zipcode; }
    return o;
  };
  const role = (k) => KEYS[k] || null;
  const need = (k, roles) => { const r = role(k); if (!r || !roles.includes(r)) throw new Error('ไม่มีสิทธิ์เข้าถึง (รหัสไม่ถูกต้อง)'); return r; };
  const mask = (s) => (s ? s.charAt(0) + '•••' : '');
  const find = (d, bib) => d.runners.find((x) => x.bib === String(bib || '').toUpperCase());
  const owner = (d, b) => {
    const r = find(d, b.bib);
    const viaToken = !!(r && b.token && b.token === r.token);
    const viaPhone = !!(r && /^\d{4}$/.test(String(b.phone4 || '')) && r.phone.slice(-4) === String(b.phone4));
    if (!viaToken && !viaPhone) throw new Error('ไม่พบข้อมูล หรือข้อมูลยืนยันตัวตนไม่ถูกต้อง');
    return { r, viaToken };
  };

  const Demo = {
    register(b) {
      const d = db.load();
      const pkg = pkgOf(b.package);
      if (!pkg) throw new Error('กรุณาเลือกแพ็กเกจ');
      const phone = String(b.phone || '').replace(/\D/g, '');
      if (!b.firstName || !b.lastName) throw new Error('กรุณากรอกชื่อ-นามสกุล');
      if (!/^0\d{8,9}$/.test(phone)) throw new Error('เบอร์โทรศัพท์ไม่ถูกต้อง');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email || '')) throw new Error('กรุณากรอกอีเมลให้ถูกต้อง');
      if (b.delivery === 'SHIP' && (!b.address || !/^\d{5}$/.test(b.zipcode || ''))) throw new Error('กรุณากรอกที่อยู่จัดส่งให้ครบ');
      if (b.consent !== true) throw new Error('กรุณายอมรับเงื่อนไขการใช้ข้อมูลส่วนบุคคล');
      if (pkg.runner) {
        const runners = d.runners.filter((r) => r.package === 'RUN');
        if (runners.length >= CFG.MAX_RUNNERS) throw new Error('ขออภัย ที่นั่งนักวิ่งเต็มแล้ว (ยังสั่งซื้อผ้าโพกหัวได้)');
        const dup = runners.find((r) => r.phone === phone);
        if (dup) throw new Error('เบอร์นี้สมัครวิ่งแล้ว (BIB ' + dup.bib + ') ดูได้ที่หน้า "ค้นหา"');
      }
      d.seq[pkg.code] = (d.seq[pkg.code] || 0) + 1;
      const ship = b.delivery === 'SHIP';
      const r = Object.assign({}, b, {
        phone,
        email: String(b.email).toLowerCase(),
        food: pkg.runner ? b.food : '', drink: pkg.runner ? b.drink : '', sweetness: pkg.runner ? b.sweetness : '',
        delivery: ship ? 'SHIP' : 'PICKUP',
        address: ship ? b.address : '', zipcode: ship ? b.zipcode : '',
        bib: pkg.prefix + String(d.seq[pkg.code]).padStart(4, '0'),
        token: Math.random().toString(36).slice(2, 14),
        createdAt: new Date().toISOString(),
        amount: String(pkg.price + (ship ? shipFee : 0)),
        paymentStatus: 'UNPAID', slipAt: '', paidAt: '', payNote: '',
        shipStatus: ship ? 'PENDING' : '', trackingNo: '',
        status: 'REGISTERED', checkinAt: '', checkinBy: '',
      });
      delete r.action; delete r.consent;
      d.runners.push(r); db.save(d);
      return { runner: full(r, true) };
    },
    info() {
      const n = db.load().runners.filter((r) => r.package === 'RUN').length;
      return { open: true, maxRunners: CFG.MAX_RUNNERS, runnersLeft: Math.max(0, CFG.MAX_RUNNERS - n) };
    },
    search(b) {
      const q = String(b.q || '').trim().toLowerCase();
      if (q.length < 2) throw new Error('พิมพ์อย่างน้อย 2 ตัวอักษร');
      return {
        results: db.load().runners
          .filter((r) => r.bib.toLowerCase() === q || (r.firstName + ' ' + r.lastName + ' ' + (r.nickname || '')).toLowerCase().includes(q))
          .slice(0, 20)
          .map((r) => ({ bib: r.bib, package: r.package, name: r.firstName + ' ' + mask(r.lastName), nickname: r.nickname, paymentStatus: r.paymentStatus, status: r.status, shipStatus: r.shipStatus })),
      };
    },
    get(b) { const a = owner(db.load(), b); return { runner: full(a.r, a.viaToken) }; },
    uploadSlip(b) {
      const d = db.load();
      const a = owner(d, b);
      if (a.r.paymentStatus === 'PAID') throw new Error('รายการนี้ชำระเงินเรียบร้อยแล้ว');
      if (!/^data:image\/(jpeg|png);base64,/.test(b.image || '')) throw new Error('ไฟล์สลิปต้องเป็นรูป JPG หรือ PNG');
      d.slips[a.r.bib] = b.image;
      Object.assign(a.r, { paymentStatus: 'SLIP_UPLOADED', slipAt: new Date().toISOString(), payNote: '' });
      db.save(d);
      return { runner: full(a.r, a.viaToken) };
    },
    list(b) {
      need(b.key, ['admin']);
      const d = db.load();
      return d.runners.map((r) => { const o = Object.assign({}, r); o.hasSlip = !!d.slips[r.bib]; delete o.token; return o; });
    },
    slip(b) {
      need(b.key, ['admin']);
      const img = db.load().slips[b.bib];
      if (!img) throw new Error('ยังไม่มีสลิป');
      return { image: img, url: '' };
    },
    verify(b) {
      need(b.key, ['admin']);
      const d = db.load(); const r = find(d, b.bib);
      if (!r) throw new Error('ไม่พบ ' + b.bib);
      if (b.approve) Object.assign(r, { paymentStatus: 'PAID', paidAt: new Date().toISOString(), payNote: '' });
      else Object.assign(r, { paymentStatus: 'REJECTED', paidAt: '', payNote: b.reason || 'สลิปไม่ถูกต้อง' });
      db.save(d);
      return { runner: full(r) };
    },
    ship(b) {
      need(b.key, ['admin']);
      if (!b.trackingNo) throw new Error('กรุณากรอกเลขพัสดุ');
      const d = db.load(); const r = find(d, b.bib);
      if (!r) throw new Error('ไม่พบ ' + b.bib);
      if (r.delivery !== 'SHIP') throw new Error('รายการนี้ไม่ได้เลือกจัดส่ง');
      if (r.paymentStatus !== 'PAID') throw new Error('ยังไม่ได้ยืนยันการชำระเงิน');
      Object.assign(r, { shipStatus: 'SHIPPED', trackingNo: b.trackingNo });
      db.save(d);
      return { runner: full(r) };
    },
    checkin(b) {
      const by = need(b.key, ['admin', 'staff']);
      const d = db.load(); const r = find(d, b.bib);
      if (!r) throw new Error('ไม่พบเลข ' + b.bib);
      if (b.token && b.token !== r.token) throw new Error('QR Code ไม่ถูกต้อง (token ไม่ตรง)');
      if (r.paymentStatus !== 'PAID') throw new Error(r.bib + ' ยังไม่ได้ชำระเงิน / สลิปรอตรวจสอบ');
      if (!pkgOf(r.package).runner && r.delivery === 'SHIP') throw new Error(r.bib + ' เป็นออเดอร์แบบจัดส่ง ไม่ต้องรับที่งาน');
      if (r.status === 'CHECKED_IN') return { already: true, runner: full(r) };
      Object.assign(r, { status: 'CHECKED_IN', checkinAt: new Date().toISOString(), checkinBy: b.by || by });
      db.save(d);
      return { already: false, runner: full(r) };
    },
    update(b) {
      need(b.key, ['admin']);
      const d = db.load(); const r = find(d, b.bib);
      if (!r) throw new Error('ไม่พบ ' + b.bib);
      const f = Object.assign({}, b.fields || {});
      if (f.status === 'CHECKED_IN' && r.status !== 'CHECKED_IN') {
        if (r.paymentStatus !== 'PAID') throw new Error('ยังไม่ได้ชำระเงิน');
        Object.assign(f, { checkinAt: new Date().toISOString(), checkinBy: 'admin' });
      }
      if (f.status === 'REGISTERED') Object.assign(f, { checkinAt: '', checkinBy: '' });
      Object.assign(r, f);
      db.save(d);
      return { runner: full(r) };
    },
    remove(b) {
      need(b.key, ['admin']);
      const d = db.load();
      d.runners = d.runners.filter((x) => x.bib !== b.bib);
      delete d.slips[b.bib];
      db.save(d);
      return { removed: b.bib };
    },
    auth(b) { return { role: need(b.key, ['admin', 'staff']) }; },

    /** สร้างข้อมูลตัวอย่าง (ปุ่มในหน้า Admin ตอนโหมด Demo) */
    seed(n) {
      const first = ['สมชาย', 'อมีร', 'นภา', 'ฟาริดา', 'ธนา', 'กิตติ', 'มาลี', 'ซูไฮมี', 'ปิยะ', 'วรรณา', 'อาดิล', 'ศิริ'];
      const last = ['ใจดี', 'สาและ', 'บุญมี', 'ดือราแม', 'ศรีสุข', 'มะลิ', 'วงศ์ไทย', 'ยูโซะ'];
      const pick = (a) => a[Math.floor(Math.random() * a.length)];
      // สลิปตัวอย่างขนาดเล็ก
      const c = document.createElement('canvas'); c.width = 240; c.height = 400;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 240, 400);
      x.fillStyle = '#1B3B67'; x.fillRect(0, 0, 240, 60); x.fillStyle = '#111'; x.font = '20px sans-serif'; x.fillText('DEMO SLIP', 60, 200);
      const slip = c.toDataURL('image/jpeg', 0.6);
      for (let i = 0; i < n; i++) {
        try {
          const isRun = Math.random() < 0.8;
          const ship = Math.random() < (isRun ? 0.15 : 0.7);
          const res = Demo.register({
            package: isRun ? 'RUN' : 'MERCH',
            firstName: pick(first), lastName: pick(last), nickname: '',
            phone: '08' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0'),
            email: 'demo' + i + '@example.com',
            food: pick(CFG.FOODS), drink: pick(CFG.DRINKS), sweetness: pick(CFG.SWEETNESS),
            delivery: ship ? 'SHIP' : 'PICKUP', address: ship ? '99/1 ถ.สุขยางค์ อ.เมือง จ.ยะลา' : '', zipcode: ship ? '95000' : '',
            consent: true,
          });
          const bib = res.runner.bib; const roll = Math.random();
          if (roll < 0.15) continue;                                       // ยังไม่จ่าย
          Demo.uploadSlip({ bib, token: res.runner.token, image: slip });
          if (roll < 0.3) continue;                                        // รอตรวจ
          Demo.verify({ key: 'demo-admin', bib, approve: true });
          if (ship && Math.random() < 0.5) Demo.ship({ key: 'demo-admin', bib, trackingNo: 'EF' + Math.floor(Math.random() * 1e9) + 'TH' });
          if (!ship || isRun) { if (Math.random() < 0.45) Demo.checkin({ key: 'demo-staff', bib }); }
        } catch (e) { /* ข้ามรายการซ้ำ/เต็ม */ }
      }
    },
    reset() { localStorage.removeItem(DB_KEY); },
  };

  async function call(action, payload) {
    if (CFG.API_URL) return remote(action, payload);
    await new Promise((r) => setTimeout(r, 200)); // จำลอง latency
    const fn = Demo[action];
    if (!fn) throw new Error('ไม่รู้จัก action: ' + action);
    return fn(Object.assign({ action }, payload || {}));
  }

  window.API = { call, isDemo: !CFG.API_URL, demo: Demo };
})();
