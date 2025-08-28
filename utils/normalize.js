// CommonJS utility: normalize + slugify แบบเบา ๆ (ไม่พึ่ง lib ภายนอก)
const THAI_TONE_MARKS = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g; // ถ้าต้องการลบวรรณยุกต์ไทย (เลือกใช้หรือไม่ก็ได้)

const toSpaces = (s) => s.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
const stripPunct = (s) => s.replace(/[^\p{L}\p{N}\s\.]/gu, ''); // เก็บตัวอักษร/ตัวเลข/ช่องว่าง/จุด

function normalizeName(raw) {
  if (!raw) return '';
  let s = String(raw).normalize('NFC');         // คงรูปอักษร
  s = s.replace(THAI_TONE_MARKS, '');           // (ออปชัน) ลบเครื่องหมายวรรณยุกต์ไทย
  s = toSpaces(stripPunct(s)).toLowerCase();    // ยุบเว้นวรรค + เป็นตัวพิมพ์เล็ก
  return s;
}

function slugify(raw) {
  if (!raw) return '';
  const base = normalizeName(raw);
  return base
    .replace(/\./g, '')        // ตัดจุดออกจาก slug
    .replace(/\s+/g, '-')      // ช่องว่าง -> dash
    .replace(/-+/g, '-')       // ยุบ dash
    .replace(/^-|-$/g, '');    // ตัด dash ต้น-ท้าย
}

module.exports = { normalizeName, slugify };
