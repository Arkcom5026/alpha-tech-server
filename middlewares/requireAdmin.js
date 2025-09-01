// middlewares/requireAdmin.js
// ใช้ร่วมกับ JWT/Auth middleware ที่ตั้งค่า req.user ไว้แล้ว
// อนุญาต: admin, superadmin (เผื่อสะกดเดิม supperadmin)
// ข้ามการตรวจสิทธิ์สำหรับพรีไฟลท์ OPTIONS

module.exports = function requireAdmin(req, res, next) {
  try {
    // ✅ ปล่อยพรีไฟลท์ ไม่ตรวจสิทธิ์
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204); // หรือ next() ถ้ามี app.options('*', cors(...)) แล้ว
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const role = String(user.role || '').toLowerCase();
    const allowed = role === 'admin' || role === 'superadmin' || role === 'supperadmin'; // รองรับสะกดเดิม
    if (allowed) {
      return next();
    }

    return res.status(403).json({ message: 'Forbidden: admin/superadmin only' });
  } catch (err) {
    // ตามมาตรฐานโปรเจกต์: log แล้วตอบกลับแบบปลอดภัย
    // eslint-disable-next-line no-console
    console.error('[requireAdmin] error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
