
// middlewares/requireAdmin.js
// ใช้ร่วมกับ JWT/Auth middleware ที่ตั้งค่า req.user ไว้แล้ว
// โหมดปกติ: อนุญาต admin, superadmin (รองรับสะกดเดิม supperadmin)
// มี helper: requireAdmin.superadmin (อนุญาตเฉพาะ superadmin/supperadmin)

module.exports = (() => {
  const make = (allowedRoles = ['admin', 'superadmin', 'supperadmin']) => {
    const allowSet = new Set(allowedRoles.map(r => String(r || '').toLowerCase()));
    return function (req, res, next) {
      try {
        // ปล่อยพรีไฟลท์
        if (req.method === 'OPTIONS') return res.sendStatus(204);

        const role = String(req?.user?.role || '').toLowerCase();
        if (!role) return res.status(401).json({ message: 'Unauthorized' });

        if (allowSet.has(role)) return next();
        return res.status(403).json({ message: 'Forbidden' });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[requireAdmin] error:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }
    };
  };

  // ค่าเริ่มต้น: admin | superadmin (รวมสะกดเดิม)
  const mw = make();
  // โหมดเฉพาะ superadmin (เผื่อสะกดเดิม)
  mw.superadmin = make(['superadmin', 'supperadmin']);
  // โหมดกำหนดเอง (จะเติม 'supperadmin' ให้เสมอ เผื่อสะกดเดิม)
  mw.allow = (...roles) => make([...new Set([...roles.map(r => String(r || '').toLowerCase()), 'supperadmin'])]);

  return mw;
})();
