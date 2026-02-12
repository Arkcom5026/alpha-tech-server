
// server/middlewares/verifyToken.js
const jwt = require('jsonwebtoken');

const normalizeRole = (r) => {
  const v = (r || '').toString().trim().toLowerCase();
  if (v === 'supperadmin') return 'superadmin';
  return v;
};

const normalizeProfileType = (t) => {
  // profileType may come as: "customer" | "employee" | "customer,employee" | ["customer","employee"]
  // ✅ Priority: employee > customer
  if (Array.isArray(t)) {
    const arr = t
      .map((x) => (x || '').toString().trim().toLowerCase())
      .filter(Boolean);
    if (arr.includes('employee')) return 'employee';
    if (arr.includes('customer')) return 'customer';
    return arr[0] || null;
  }

  const v = (t || '').toString().trim().toLowerCase();
  if (!v) return null;

  // comma-separated or space-separated values
  const parts = v
    .split(/[\s,]+/)
    .map((x) => x.trim())
    .filter(Boolean);

  if (parts.includes('employee')) return 'employee';
  if (parts.includes('customer')) return 'customer';
  return parts[0] || null;
};

const deriveProfileTypeFromRole = (role, currentProfileType, decoded) => {
  const r = normalizeRole(role);
  const pt = normalizeProfileType(currentProfileType);

  // ✅ Priority rule (P1): If user can be both customer + employee, always prefer employee context.
  // 1) Role group that implies employee context
  if (['employee', 'admin', 'superadmin'].includes(r)) return 'employee';

  // 2) If token/profileType indicates employee (even if role is messy)
  if (pt === 'employee') return 'employee';

  // 3) If employeeId exists in token, prefer employee (acts as a strong signal)
  if (decoded?.employeeId) return 'employee';

  // Customer
  if (r === 'customer') return 'customer';

  // fallback
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
    const profileType = deriveProfileTypeFromRole(role, decoded?.profileType, decoded);

    // ✅ canonical req.user
    // NOTE: P1 allows a single User to be both Customer + Employee.
    // Therefore we must keep IDs explicit and also provide a canonical "activeProfileId" based on the resolved context.
    const customerProfileId = decoded?.profileId ?? null; // customer profile id (may exist even for employee users)
    const employeeId = decoded?.employeeId ?? null; // employee profile id (employee context)
    const activeProfileId = profileType === 'employee' ? employeeId : customerProfileId;

    req.user = {
      id: decoded?.id ?? null,
      role, // 'customer' | 'employee' | 'admin' | 'superadmin'
      profileType, // 'customer' | 'employee'

      // ✅ Canonical profile id for the CURRENT context (employee => employeeId, customer => customerProfileId)
      // This prevents controllers from accidentally using customerProfileId while in employee context.
      profileId: activeProfileId,
      activeProfileId,

      // ✅ Explicit IDs (recommended for new code)
      customerProfileId,
      employeeId,

      // branch context (P1 สำคัญมาก)
      branchId: decoded?.branchId ?? null,
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


