/**
 * =====================================================================
 *  API Layer — ทุกหน้าเรียก backend ผ่าน API.call(action, payload)
 *  - ส่งไป Google Apps Script (API_URL ใน config.js)
 *  - แนบ session ของสมาชิก (ถ้าล็อกอินอยู่) ไปกับทุกคำขอโดยอัตโนมัติ
 * =====================================================================
 */
(function () {
  const CFG = window.APP_CONFIG;
  const SESSION_KEY = 'irc_session';
  const MEMBER_KEY = 'irc_member';

  /* ---------------- บัญชีสมาชิกในเครื่องนี้ ---------------- */
  const Auth = {
    session() { try { return localStorage.getItem(SESSION_KEY) || ''; } catch (e) { return ''; } },
    member() { try { return JSON.parse(localStorage.getItem(MEMBER_KEY)) || null; } catch (e) { return null; } },
    set(session, member) {
      try {
        localStorage.setItem(SESSION_KEY, session);
        localStorage.setItem(MEMBER_KEY, JSON.stringify(member));
      } catch (e) { /* ignore */ }
    },
    setMember(member) { try { localStorage.setItem(MEMBER_KEY, JSON.stringify(member)); } catch (e) { /* ignore */ } },
    clear() { try { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(MEMBER_KEY); } catch (e) { /* ignore */ } },
    loggedIn() { return !!Auth.session(); },
  };

  /* ---------------- Remote (Google Apps Script) ---------------- */
  async function remote(action, payload) {
    if (!CFG.API_URL) throw new Error('ยังไม่ได้ตั้งค่า API_URL ใน js/config.js');
    const body = Object.assign({ action }, payload || {});
    if (body.session === undefined && Auth.session()) body.session = Auth.session();
    let res;
    try {
      res = await fetch(CFG.API_URL, {
        method: 'POST',
        // text/plain = "simple request" → ไม่มี CORS preflight (Apps Script ไม่รองรับ OPTIONS)
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        redirect: 'follow',
      });
    } catch (e) {
      // fetch ล้มเหลวทั้งที่มีเน็ต มักเกิดจาก Deploy ไม่ได้ตั้ง "Who has access: Anyone" หรือ API_URL ผิด
      throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจสอบอินเทอร์เน็ต และการ Deploy (Who has access ต้องเป็น Anyone)');
    }
    if (!res.ok) throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (' + res.status + ')');
    let json;
    try { json = await res.json(); }
    catch (e) { throw new Error('เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ — ตรวจว่า API_URL ลงท้ายด้วย /exec และ Deploy เป็น Web app แล้ว'); }
    if (!json.ok) {
      // เซสชันหมดอายุ/ถูกเพิกถอน → ล้างสถานะล็อกอินในเครื่อง
      if (/เข้าสู่ระบบ \(เซสชัน/.test(json.error || '')) Auth.clear();
      throw new Error(json.error || 'เกิดข้อผิดพลาด');
    }
    return json.data;
  }

  window.API = { call: remote, isDemo: false };
  window.Auth = Auth;
})();
