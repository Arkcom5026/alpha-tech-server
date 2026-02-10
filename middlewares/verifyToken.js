// server/middlewares/verifyToken.js
const jwt = require('jsonwebtoken');

const normalizeRole = (r) => {
  const v = (r || '').toString().trim().toLowerCase();
  if (v === 'supperadmin') return 'superadmin';
  return v;
};

const normalizeProfileType = (t) => {
  const v = (t || '').toString().trim().toLowerCase();
  return v; // "customer" | "employee" | ...
};

const deriveProfileTypeFromRole = (role, currentProfileType) => {
  const r = normalizeRole(role);
  const pt = normalizeProfileType(currentProfileType);

  // ✅ Role กลุ่มพนักงาน → ต้องเป็น employee context เสมอ
  if (['employee', 'admin', 'superadmin'].includes(r)) return 'employee';

  // ลูกค้า
  if (r === 'customer') return 'customer';

  // fallback: ใช้ค่าที่มี ถ้าไม่รู้จัก
  return pt || null;
};

const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.toString().startsWith('Bearer ')) {
      return res.status(401).json({ message: 'unauthorized' });
    }

    const token = authHeader.toString().slice('Bearer '.length).trim();
    if (!token) return res.status(401).json({ message: 'unauthorized' });

    const secret = process.env.JWT_SECRET || process.env.SECRET_KEY;
    if (!secret) {
      // production-grade: อย่าเงียบ
      console.error('[verifyToken] Missing JWT secret env (JWT_SECRET/SECRET_KEY)');
      return res.status(500).json({ message: 'server_misconfigured' });
    }

    const decoded = jwt.verify(token, secret);

    const role = normalizeRole(decoded?.role);
    const profileType = deriveProfileTypeFromRole(role, decoded?.profileType);

    // ✅ canonical req.user
    req.user = {
      id: decoded?.id ?? null,
      role, // 'customer' | 'employee' | 'admin' | 'superadmin'
      profileType, // 'customer' | 'employee'
      profileId: decoded?.profileId ?? null,

      // branch/employee context (P1 สำคัญมาก)
      branchId: decoded?.branchId ?? null,
      employeeId: decoded?.employeeId ?? null,
    };

    // guardrail: ถ้าเป็น employee context แต่ไม่มี branchId → แล้วแต่ระบบคุณ
    // (ใน P1 คุณย้ำว่า branch เป็น context สำคัญมาก)
    // แนะนำ: อย่าบังคับที่นี่ ให้ controller/route ตัดสินตาม endpoint
    return next();
  } catch (err) {
    // token invalid/expired
    return res.status(401).json({ message: 'unauthorized' });
  }
};

module.exports = verifyToken;