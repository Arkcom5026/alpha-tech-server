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
    const emailOrPhone = normalize(req.body?.emailOrPhone);
    const password = normalize(req.body?.password);
    if (!emailOrPhone || !password) {
      return res.status(400).json({ message: 'กรุณาระบุอีเมล/เบอร์โทร และรหัสผ่าน' });
    }

    const emailCandidate = normalizeEmail(emailOrPhone);

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailCandidate },
          { customerProfile: { phone: emailOrPhone } },
          // สามารถขยายให้รองรับ employeeProfile.phone ได้ในอนาคต
        ],
      },
      include: {
        customerProfile: true,
        employeeProfile: {
          include: { branch: true, position: true },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ message: 'ไม่พบบัญชีผู้ใช้' });
    }

    if (!user.enabled) {
      return res.status(401).json({ message: 'บัญชีนี้ถูกปิดใช้งาน' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    const profile = user.customerProfile || user.employeeProfile;
    const profileType = user.customerProfile ? 'customer' : 'employee';

    const token = buildToken(user);

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
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('🔥 Login error:', error);
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