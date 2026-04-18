






// ✅ authController.js

const { prisma, Prisma } = require('../lib/prisma');
// Prefer native/fast bcrypt when available (minimal disruption)
let bcrypt;
let bcryptProvider = 'unknown';

try {
  // eslint-disable-next-line global-require
  bcrypt = require('@node-rs/bcrypt');
  bcryptProvider = '@node-rs/bcrypt';
  bcryptProvider = 'node-rs';
} catch (e1) {
  try {
    // eslint-disable-next-line global-require
    bcrypt = require('bcrypt');
    bcryptProvider = 'bcrypt';
    bcryptProvider = 'bcrypt';
  } catch (e2) {
    // eslint-disable-next-line global-require
    bcrypt = require('bcryptjs');
    bcryptProvider = 'bcryptjs';
    bcryptProvider = 'bcryptjs';
  }
}
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendMailAction } = require('../utils/mailSender');

// Normalize bcrypt API across providers (minimal disruption)
const bcryptHash = async (plain, rounds = 10) => {
  if (typeof bcrypt?.hash === 'function') return bcrypt.hash(plain, rounds);
  if (typeof bcrypt?.hashSync === 'function') return bcrypt.hashSync(plain, rounds);
  throw new Error('bcrypt hash function not available');
};

const bcryptCompare = async (plain, hashed) => {
  if (typeof bcrypt?.compare === 'function') return bcrypt.compare(plain, hashed);
  if (typeof bcrypt?.verify === 'function') {
    // @node-rs/bcrypt uses verify() (order may vary by version)
    try {
      return await bcrypt.verify(plain, hashed);
    } catch (e) {
      return await bcrypt.verify(hashed, plain);
    }
  }
  throw new Error('bcrypt compare/verify function not available');
};

// One-time runtime visibility: confirm which bcrypt provider is actually used
// eslint-disable-next-line no-console
console.log('[auth] bcrypt provider:', bcryptProvider, {
  hasCompare: typeof bcrypt?.compare === 'function',
  hasVerify: typeof bcrypt?.verify === 'function',
  hasHash: typeof bcrypt?.hash === 'function',
});

const normalize = (s) => (s === undefined || s === null ? '' : String(s).trim());
const normalizeEmail = (s) => normalize(s).toLowerCase();

const PASSWORD_RESET_TOKEN_EXPIRES_MINUTES = Number(process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES || 30);

const sha256 = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const createPasswordResetToken = () => crypto.randomBytes(32).toString('hex');
const getPasswordResetExpiresAt = () => new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRES_MINUTES * 60 * 1000);
const getAppBaseUrl = (req) => {
  const envBaseUrl = (process.env.APP_BASE_URL || process.env.CLIENT_URL || '').trim();
  if (envBaseUrl) return envBaseUrl;

  const originHeader = normalize(req?.headers?.origin);
  if (originHeader) return originHeader;

  const forwardedProto = normalize(req?.headers?.['x-forwarded-proto']);
  const forwardedHost = normalize(req?.headers?.['x-forwarded-host']);
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const protocol = normalize(req?.protocol);
  const host = normalize(req?.get?.('host'));
  if (protocol && host) {
    return `${protocol}://${host}`;
  }

  return '';
};

const buildPasswordResetUrl = (req, rawToken) => {
  const appBaseUrl = getAppBaseUrl(req);
  if (!appBaseUrl) return '';
  const base = appBaseUrl.endsWith('/') ? appBaseUrl.slice(0, -1) : appBaseUrl;
  return `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;
};
const sendPasswordResetEmail = async ({ toEmail, resetUrl }) => {
  if (!toEmail) {
    throw new Error('Recipient email is required for password reset');
  }

  if (!resetUrl) {
    throw new Error('Password reset URL is required');
  }

  const subject = 'ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ';
  const text = [
    'เราได้รับคำขอให้ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ',
    '',
    `ลิงก์สำหรับตั้งรหัสผ่านใหม่: ${resetUrl}`,
    '',
    `ลิงก์นี้จะหมดอายุใน ${PASSWORD_RESET_TOKEN_EXPIRES_MINUTES} นาที`,
    'หากคุณไม่ได้เป็นผู้ส่งคำขอนี้ คุณสามารถละเว้นอีเมลฉบับนี้ได้',
  ].join('
');

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #0f172a; max-width: 560px; margin: 0 auto;">
      <h2 style="margin-bottom: 12px;">ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ</h2>
      <p>เราได้รับคำขอให้ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ</p>
      <p style="margin: 24px 0;">
        <a
          href="${resetUrl}"
          style="display: inline-block; padding: 12px 20px; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600;"
        >
          ตั้งรหัสผ่านใหม่
        </a>
      </p>
      <p>หากปุ่มด้านบนไม่ทำงาน คุณสามารถคัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์ได้:</p>
      <p style="word-break: break-all; color: #2563eb;">${resetUrl}</p>
      <p>ลิงก์นี้จะหมดอายุใน ${PASSWORD_RESET_TOKEN_EXPIRES_MINUTES} นาที</p>
      <p style="color: #475569;">หากคุณไม่ได้เป็นผู้ส่งคำขอนี้ คุณสามารถละเว้นอีเมลฉบับนี้ได้</p>
    </div>
  `;

  return sendMailAction({
    to: toEmail,
    subject,
    text,
    html,
  });
};

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
    const phoneRaw = normalize(req.body?.phone);

    if (!email || !password) {
      return res.status(400).json({ message: 'กรุณาระบุอีเมลและรหัสผ่าน' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
    }

    // phone normalization (used for loginId only — CustomerProfile may not have phone field in current Prisma schema)
    const onlyDigits = (v) =>
      String(v || '')
        .split('')
        .filter((c) => c >= '0' && c <= '9')
        .join('');
    const toE164TH = (digits) => {
      if (!digits) return '';
      if (digits.startsWith('0') && digits.length === 10) return `+66${digits.slice(1)}`;
      if (digits.startsWith('66') && digits.length === 11) return `+${digits}`;
      if (digits.startsWith('+')) return digits;
      return digits;
    };

    const phoneDigits = onlyDigits(phoneRaw);
    const phoneE164 = toE164TH(phoneDigits);
    const loginId = phoneE164 || phoneDigits || '';

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'มีบัญชีนี้อยู่แล้ว' });
    }

    // Optional: prevent duplicate loginId if phone is provided
    if (loginId) {
      const existingLoginId = await prisma.user.findFirst({ where: { loginId } });
      if (existingLoginId) {
        return res.status(409).json({ message: 'มีบัญชีที่ใช้เบอร์โทรนี้อยู่แล้ว' });
      }
    }

    const hashedPassword = await bcryptHash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'CUSTOMER',
        enabled: true,
        ...(loginId ? { loginId } : {}),
        customerProfile: {
          create: {
            name,
            // NOTE: Prisma schema currently does NOT include CustomerProfile.phone (per error: Unknown argument `phone`).
            // Keep phone in User.loginId instead for lookup/login.
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
  // 🔐 bcrypt provider (log once per process)
  if (!global.__bcryptProviderLogged) {
    // eslint-disable-next-line no-console
    console.log('[auth] bcrypt provider:', bcryptProvider);
    global.__bcryptProviderLogged = true;
  }
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

  try {
    const identifier = normalize(req.body?.emailOrPhone ?? req.body?.identifier);
    const password = normalize(req.body?.password);

    if (!identifier || !password) {
      return res.status(400).json({ message: 'กรุณาระบุอีเมล/เบอร์โทร หรือไอดี และรหัสผ่าน' });
    }

    // helpers (อยู่ในฟังก์ชัน เพื่อไม่กระทบส่วนอื่น)
    const looksLikeEmail = (v) => String(v || '').indexOf('@') > 0;
    const onlyDigits = (v) =>
      String(v || '')
        .split('')
        .filter((c) => c >= '0' && c <= '9')
        .join('');
    const toE164TH = (digits) => {
      if (!digits) return '';
      if (digits.startsWith('0') && digits.length === 10) return `+66${digits.slice(1)}`;
      if (digits.startsWith('66') && digits.length === 11) return `+${digits}`;
      if (digits.startsWith('+')) return digits;
      return digits;
    };

    // ✅ ลด query หนัก: แยก lookup แบบ indexed ก่อน แล้วค่อย fallback ไปหาใน profile.phone
    const tFind0 = Date.now();

    const includeProfiles = {
      customerProfile: true,
      employeeProfile: { include: { branch: true, position: true } },
    };

    let user = null;

    if (looksLikeEmail(identifier)) {
      user = await prisma.user.findUnique({
        where: { email: normalizeEmail(identifier) },
        include: includeProfiles,
      });
    } else {
      // 1) หาใน loginId ก่อน (คาดว่า index/unique)
      user = await prisma.user.findFirst({
        where: { loginId: identifier },
        include: includeProfiles,
      });

      // 2) ถ้ายังไม่เจอ ให้ลองแปลงเป็น digits / E164 แล้วค่อยหา loginId อีกที
      if (!user) {
        const digits = onlyDigits(identifier);
        const e164 = toE164TH(digits);

        if (digits) {
          user = await prisma.user.findFirst({ where: { loginId: digits }, include: includeProfiles });
        }
        if (!user && e164 && e164 !== digits) {
          user = await prisma.user.findFirst({ where: { loginId: e164 }, include: includeProfiles });
        }

        // 3) fallback: หาใน customerProfile.phone / employeeProfile.phone ก่อน แล้วค่อยดึง user ตาม userId
        if (!user && (digits || e164)) {
          const phoneCandidates = [digits, e164].filter(Boolean);

          let foundUserId = null;

          for (const p of phoneCandidates) {
            const cp = await prisma.customerProfile.findFirst({
              where: { phone: p },
              select: { userId: true },
            });
            if (cp?.userId) {
              foundUserId = cp.userId;
              break;
            }

            const ep = await prisma.employeeProfile.findFirst({
              where: { phone: p },
              select: { userId: true },
            });
            if (ep?.userId) {
              foundUserId = ep.userId;
              break;
            }
          }

          if (foundUserId) {
            user = await prisma.user.findUnique({
              where: { id: foundUserId },
              include: includeProfiles,
            });
          }
        }
      }
    }

    timing.findUserMs = Date.now() - tFind0;

    if (!user) {
      timing.totalMs = Date.now() - t0;
      // eslint-disable-next-line no-console
      console.log('[auth.login] timing', {
        reqId: timing.reqId,
        totalMs: timing.totalMs,
        findUserMs: timing.findUserMs,
        bcryptMs: timing.bcryptMs,
        signJwtMs: timing.signJwtMs,
        note: 'user_not_found',
      });
      return res.status(401).json({ message: 'ไม่พบบัญชีผู้ใช้' });
    }

    if (!user.enabled) {
      timing.totalMs = Date.now() - t0;
      // eslint-disable-next-line no-console
      console.log('[auth.login] timing', {
        reqId: timing.reqId,
        totalMs: timing.totalMs,
        findUserMs: timing.findUserMs,
        bcryptMs: timing.bcryptMs,
        signJwtMs: timing.signJwtMs,
        note: 'user_disabled',
      });
      return res.status(403).json({ message: 'บัญชีนี้ถูกปิดใช้งาน' });
    }

    const tBcrypt0 = Date.now();
    const isMatch = await bcryptCompare(password, user.password);
    timing.bcryptMs = Date.now() - tBcrypt0;

    if (!isMatch) {
      timing.totalMs = Date.now() - t0;
      // eslint-disable-next-line no-console
      console.log('[auth.login] timing', {
        reqId: timing.reqId,
        totalMs: timing.totalMs,
        findUserMs: timing.findUserMs,
        bcryptMs: timing.bcryptMs,
        signJwtMs: timing.signJwtMs,
        note: 'password_mismatch',
      });
      return res.status(401).json({ message: 'รหัสผ่านไม่ถูกต้อง' });
    }

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
    // eslint-disable-next-line no-console
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
    timing.totalMs = Date.now() - t0;
    console.error('🔥 Login error:', error, {
      reqId: timing.reqId,
      totalMs: timing.totalMs,
      findUserMs: timing.findUserMs,
      bcryptMs: timing.bcryptMs,
      signJwtMs: timing.signJwtMs,
    });
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

// ✅ get current session (used by FE: verifySession)
const forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({ message: 'กรุณากรอกอีเมล' });
    }

    const genericSuccessMessage = 'หากข้อมูลของคุณมีอยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่แล้ว';

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        enabled: true,
      },
    });

    if (!user || !user.enabled) {
      return res.json({ message: genericSuccessMessage });
    }

    const rawToken = createPasswordResetToken();
    const tokenHash = sha256(rawToken);
    const expiresAt = getPasswordResetExpiresAt();    const resetUrl = buildPasswordResetUrl(req, rawToken);

    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });
    });

    try {
      await sendPasswordResetEmail({
        toEmail: user.email,
        resetUrl,
      });
    } catch (mailError) {
      console.error('❌ sendPasswordResetEmail error:', mailError);
      return res.status(500).json({ message: 'ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้' });
    }

    return res.json({ message: genericSuccessMessage });
  } catch (error) {
    console.error('❌ forgotPassword error:', error);
    return res.status(500).json({ message: 'ไม่สามารถดำเนินการลืมรหัสผ่านได้' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const rawToken = normalize(req.body?.token);
    const password = normalize(req.body?.password);
    const confirmPassword = normalize(req.body?.confirmPassword);

    if (!rawToken) {
      return res.status(400).json({ message: 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือไม่ครบถ้วน' });
    }

    if (!password || !confirmPassword) {
      return res.status(400).json({ message: 'กรุณากรอกรหัสผ่านใหม่และยืนยันรหัสผ่าน' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'ยืนยันรหัสผ่านไม่ตรงกัน' });
    }

    const tokenHash = sha256(rawToken);

    const resetRecord = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            enabled: true,
          },
        },
      },
    });

    if (!resetRecord || !resetRecord.user?.enabled) {
      return res.status(400).json({ message: 'ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอรีเซ็ตรหัสผ่านใหม่อีกครั้ง' });
    }

    const hashedPassword = await bcryptHash(password, 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetRecord.user.id },
        data: {
          password: hashedPassword,
        },
      });

      await tx.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: {
          usedAt: new Date(),
        },
      });

      await tx.passwordResetToken.updateMany({
        where: {
          userId: resetRecord.user.id,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });
    });

    return res.json({ message: 'ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบอีกครั้ง' });
  } catch (error) {
    console.error('❌ resetPassword error:', error);
    return res.status(500).json({ message: 'ไม่สามารถรีเซ็ตรหัสผ่านได้' });
  }
};

const getMe = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        customerProfile: true,
        employeeProfile: {
          include: {
            branch: true,
            position: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const profile = user.customerProfile || user.employeeProfile || null;
    const profileType = user.customerProfile
      ? 'customer'
      : user.employeeProfile
      ? 'employee'
      : null;

    return res.json({
      role: user.role,
      profileType,
      branchId: user.employeeProfile?.branchId || null,
      profile: {
        id: profile?.id || null,
        name: profile?.name || '',
        phone: profile?.phone || '',
        email: user.email || '',
        branch: user.employeeProfile?.branch || null,
        position: user.employeeProfile?.position || null,
        branchId: user.employeeProfile?.branchId || null,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('❌ getMe error:', error);
    return res.status(500).json({ message: 'Failed to verify session' });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  getMe,
  findUserByEmail,
};










