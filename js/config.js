/**
 * =====================================================================
 *  INSTHINK RUN CLUB — Frontend Config
 *  แก้ไขไฟล์นี้ไฟล์เดียวเพื่อปรับข้อมูลงาน
 *  ราคา / prefix / ค่าส่ง / จำนวนรับ ต้องตรงกับ CONFIG ใน backend/Code.gs
 * =====================================================================
 */
window.APP_CONFIG = {
  /**
   * URL ของ Apps Script Web App (ลงท้ายด้วย /exec)
   * ปล่อยว่าง '' = โหมด DEMO (เก็บข้อมูลในเบราว์เซอร์ ใช้ทดลองหน้าตา)
   *   รหัส Demo:  admin = demo-admin   |   staff = demo-staff
   */
  API_URL: 'https://script.google.com/macros/s/AKfycbygBjYMGAH_a6iA87fdDCD3uuU7iw1R0TMBRwL7brJINR3-tl6JEFHKrkJm7fo1fyL4/exec',

  EVENT: {
    name: 'INSTHINK RUN CLUB',
    edition: 'INSTHINK RUN CLUB',
    dateLabel: 'COMING SOON',                // TODO: ได้วันแล้วค่อยแก้ เช่น '13 DEC 2026'
    startTime: '05:30',                      // TODO: เวลาปล่อยตัว
    location: 'รีแลกซ์ เขาญี่ปุ่น',
    distanceKm: 6,
    hashtag: '#INSTHINKRUNCLUB',
    instagram: '@insthink.runclub',          // TODO: IG ของงาน
  },

  /** แพ็กเกจ — prefix = ตัวอักษรนำหน้าเลข (R0001 นักวิ่ง / M0001 ออเดอร์ผ้าโพกหัว) */
  PACKAGES: [
    {
      code: 'RUN', prefix: 'R', price: 256, runner: true,
      label: 'RUNNER 6K', title: 'วิ่ง 6K + ผ้าโพกหัว',
      includes: ['สิทธิ์วิ่ง 6K + E-BIB', 'ผ้าโพกหัว Bandana', 'Finisher meal + เครื่องดื่ม'],
    },
    {
      code: 'MERCH', prefix: 'M', price: 190, runner: false,
      label: 'BANDANA ONLY', title: 'ซื้อผ้าโพกหัวอย่างเดียว',
      includes: ['ผ้าโพกหัว Bandana', 'ไม่รวมสิทธิ์วิ่ง'],
    },
  ],

  /** วิธีรับผ้าโพกหัว */
  DELIVERY: [
    { code: 'PICKUP', label: 'รับที่จุดลงทะเบียนวันงาน', fee: 0 },
    { code: 'SHIP', label: 'จัดส่งทางไปรษณีย์', fee: 50 },
  ],

  MAX_RUNNERS: 100,

  /** การชำระเงิน — PromptPay (เบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน 13 หลัก) */
  PAYMENT: {
    promptpayId: '2960500034182',
    payeeName: 'นายอามีร สาเมาะ',
  },

  FOODS: ['ข้าวมันไก่', 'ข้าวกะเพราไก่', 'ข้าวผัดอเมริกัน', 'สลัดอกไก่ (คลีน)', 'มังสวิรัติ / เจ'],
  DRINKS: ['ชาไทย', 'ชาเขียว', 'กาแฟเย็น', 'โกโก้', 'น้ำผลไม้'],
  SWEETNESS: ['0%', '25%', '50%', '100%', '120%'],

  /**
   * เส้นทางวิ่ง 6K (ใช้วาดในหน้าโปรไฟล์และรูป IG Story)
   * points = พิกัดบนกริด 0–100 (x ไปขวา, y ลงล่าง) — วาดตามแผนที่จริงคร่าว ๆ ได้
   */
  ROUTE: {
    name: 'INSTHINK LOOP',
    points: [[12, 84], [12, 52], [24, 30], [22, 14], [50, 12], [64, 28], [86, 26], [88, 54], [70, 66], [76, 86], [48, 88], [38, 72], [12, 84]],
    checkpoints: ['START/FINISH', 'WATER 2K', 'WATER 4K'],
  },

  /** หน้า Admin ดึงข้อมูลใหม่ทุก ๆ กี่วินาที */
  ADMIN_REFRESH_SEC: 15,
};
