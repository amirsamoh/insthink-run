/**
 * =====================================================================
 *  หน้าแรก (index.html) — รายละเอียดงานอย่างเดียว ปุ่มสมัครพาไป register.html
 *  ข้อมูลทั้งหมดดึงจาก config.js → เปิดอีเวนต์ใหม่แค่แก้ config + รูปใน img/
 * =====================================================================
 */
(function () {
  const CFG = window.APP_CONFIG;
  const { $, $$ } = window.U;

  $('#evEdition').textContent = CFG.EVENT.edition;
  $('#evDate').textContent = CFG.EVENT.dateLabel;
  $('#evTime').textContent = CFG.EVENT.startTime + ' น.';
  $('#evLoc').textContent = CFG.EVENT.location;
  $('#stTime').textContent = CFG.EVENT.startTime;
  $('#heroStars').innerHTML = '<img src="img/stars-navy.png" alt="">';

  // เส้นทาง
  $('#homeRoute').innerHTML = window.U.routeSvg({ stroke: '#5FD3EE', dash: '#0A1430', start: '#0A1430', grid: 'rgba(255,255,255,.06)', width: 2.4 });
  $('#homeRouteName').textContent = CFG.ROUTE.name;
  $('#homeRouteLoc').textContent = '📍 ' + CFG.EVENT.location + ' · ปล่อยตัว ' + CFG.EVENT.startTime + ' น.';

  // ปุ่มเลื่อนสไลด์ของที่ได้รับ
  $$('[data-slide]').forEach((b) => b.addEventListener('click', () => {
    const sl = $('#goodsSlider');
    sl.scrollBy({ left: Number(b.dataset.slide) * (sl.firstElementChild.offsetWidth + 12), behavior: 'smooth' });
  }));
})();
