// ✅ authController.js — Prisma singleton, safer errors, consistent JWT payload

const { prisma, Prisma } = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const normalize = (s) => (s === undefined || s === null ? '' : String(s).trim());
const normalizeEmail = (s) => normalize(s).toLowerCase();

const buildToken = (user, opts = {}) => {
  const profile = user.customerProfile || user.employeeProfile || null;
  const profileType = user.customerProfile ? 'customer' : user.employeeProfile ? 'employee' : null;
  const payload = {
    id: user.id,
    role: user.role,
    profileType,
    profileId: profile?.id || null,
    branchId: user.employeeProfile?.branchId || null,
    employeeId: user.employeeProfile?.id || null,
    ...opts,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const register = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = normalize(req.body?.password);
    const name = normalize(req.body?.name);
    const phone = normalize(req.body?.phone);

    if (!email || !password) {
      return res.status(400).json({ message: 'กรุณาระบุอีเมลและรหัสผ่าน' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'มีบัญชีนี้อยู่แล้ว' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'customer',
        enabled: true,
        customerProfile: {
          create: {
            name,
            phone,
          },
        },
      },
      include: {
        customerProfile: true,
      },
    });

    const token = buildToken(newUser);

    return res.status(201).json({
      token,
      role: newUser.role,
      profileType: 'customer',
      profile: newUser.customerProfile,
    });
  } catch (error) {
    console.error('❌ Register error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ message: 'ข้อมูลซ้ำ (unique constraint)' });
    }
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' });
  }
};

const login = async (req, res) => {
  try {
    // ⏱️ Login timing (minimal disruption)
    const t0 = Date.now();
    const reqId = req?.id || req?.headers?.['x-request-id'] || null;
    const timing = {
      reqId,
      totalMs: 0,
      findUserMs: 0,
      bcryptMs: 0,
      signJwtMs: 0,
    };

    const identifier = normalize(req.body?.emailOrPhone ?? req.body?.identifier);
    const password = normalize(req.body?.password);
    if (!identifier || !password) {
      return res.status(400).json({ message: 'กรุณาระบุอีเมล/เบอร์โทร หรือไอดี และรหัสผ่าน' });
    }

    // helpers ภายในฟังก์ชัน
    const looksLikeEmail = (v) => String(v || '').indexOf('@') > 0;
    const onlyDigits = (v) => String(v || '').split('').filter((c) => c >= '0' && c <= '9').join('');
    const toE164TH = (digits) => {
      if (!digits) return '';
      if (digits.startsWith('0') && digits.length === 10) return `+66${digits.slice(1)}`;
      if (digits.startsWith('66') && digits.length === 11) return `+${digits}`;
      if (digits.startsWith('+')) return digits;
      return digits;
    };

    const OR = [];

    if (looksLikeEmail(identifier)) {
      OR.push({ email: { equals: normalizeEmail(identifier), mode: 'insensitive' } });
    } else {
      OR.push({ loginId: { equals: identifier, mode: 'insensitive' } });

      const digits = onlyDigits(identifier);
      const e164 = toE164TH(digits);

      if (digits) OR.push({ loginId: { equals: digits } });
      if (e164 && e164 !== digits) OR.push({ loginId: { equals: e164 } });

      if (digits) OR.push({ customerProfile: { is: { phone: digits } } });
      if (e164 && e164 !== digits) OR.push({ customerProfile: { is: { phone: e164 } } });
      if (digits) OR.push({ employeeProfile: { is: { phone: digits } } });
      if (e164 && e164 !== digits) OR.push({ employeeProfile: { is: { phone: e164 } } });
    }

    const tFind0 = Date.now();
    const user = await prisma.user.findFirst({
      where: { OR },
      include: {
        customerProfile: true,
        employeeProfile: { include: { branch: true, position: true } },
      },
    });
    timing.findUserMs = Date.now() - tFind0;

    if (!user) return res.status(401).json({ message: 'ไม่พบบัญชีผู้ใช้' });
    if (!user.enabled) return res.status(403).json({ message: 'บัญชีนี้ถูกปิดใช้งาน' });

    const tBcrypt0 = Date.now();
    const isMatch = await bcrypt.compare(password, user.password);
    timing.bcryptMs = Date.now() - tBcrypt0;

    if (!isMatch) return res.status(401).json({ message: 'รหัสผ่านไม่ถูกต้อง' });

    if (user.role !== 'customer' && user.employeeProfile) {
      if (user.employeeProfile.active === false) {
        return res.status(403).json({ message: 'พนักงานถูกปิดใช้งาน' });
      }
      if (user.employeeProfile.approved === false) {
        return res.status(403).json({ message: 'พนักงานยังไม่ผ่านการอนุมัติ' });
      }
    }

    const profile = user.customerProfile || user.employeeProfile || null;
    const profileType = user.customerProfile ? 'customer' : user.employeeProfile ? 'employee' : null;

    const tSign0 = Date.now();
    const token = buildToken(user);
    timing.signJwtMs = Date.now() - tSign0;

    timing.totalMs = Date.now() - t0;
    console.log('[auth.login] timing', {
      reqId: timing.reqId,
      totalMs: timing.totalMs,
      findUserMs: timing.findUserMs,
      bcryptMs: timing.bcryptMs,
      signJwtMs: timing.signJwtMs,
      userRole: user?.role || null,
      hasEmployeeProfile: !!user?.employeeProfile,
      hasCustomerProfile: !!user?.customerProfile,
    });

    return res.json({
      token,
      role: user.role,
      profileType,
      profile: {
        id: profile?.id || null,
        name: profile?.name || '',
        phone: profile?.phone || '',
        branch: user.employeeProfile?.branch || null,
        position: user.employeeProfile?.position || null,
        user: { id: user.id, email: user.email, role: user.role },
      },
    });
  } catch (error) {
    const reqId = req?.id || req?.headers?.['x-request-id'] || null;
    console.error('🔥 Login error:', error, { reqId });
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};


const findUserByEmail = async (req, res) => {
  try {
    const email = normalizeEmail(req.query?.email);
    if (!email) return res.status(400).json({ message: 'กรุณาระบุอีเมล' });

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        customerProfile: true,
        employeeProfile: true,
      },
    });

    if (!user) return res.status(404).json({ message: 'ไม่พบผู้ใช้อีเมลนี้' });

    return res.json({
      id: user.id,
      email: user.email,
      name: user.customerProfile?.name || '',
      phone: user.customerProfile?.phone || '',
      alreadyEmployee: !!user.employeeProfile,
    });
  } catch (error) {
    console.error('❌ findUserByEmail error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

module.exports = {
  register,
  login,
  findUserByEmail,
};





