// src/controllers/authController.js
// 🏛️ Advanced Multi-Tenant Auth Controller (Strict Back-Office Employee Edition)

const { prisma, Prisma } = require('../lib/prisma');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendMailAction } = require('../utils/mailSender');

// Prefer native/fast bcrypt when available (minimal disruption)
let bcrypt;
let bcryptProvider = 'unknown';

try {
  // eslint-disable-next-line global-require
  bcrypt = require('@node-rs/bcrypt');
  bcryptProvider = 'node-rs';
} catch (e1) {
  try {
    // eslint-disable-next-line global-require
    bcrypt = require('bcrypt');
    bcryptProvider = 'bcrypt';
  } catch (e2) {
    // eslint-disable-next-line global-require
    bcrypt = require('bcryptjs');
    bcryptProvider = 'bcryptjs';
  }
}

// Normalize bcrypt API across providers
const bcryptHash = async (plain, rounds = 10) => {
  if (typeof bcrypt?.hash === 'function') return bcrypt.hash(plain, rounds);
  if (typeof bcrypt?.hashSync === 'function') return bcrypt.hashSync(plain, rounds);
  throw new Error('bcrypt hash function not available');
};

const bcryptCompare = async (plain, hashed) => {
  if (typeof bcrypt?.compare === 'function') return bcrypt.compare(plain, hashed);
  if (typeof bcrypt?.verify === 'function') {
    try {
      return await bcrypt.verify(plain, hashed);
    } catch (e) {
      return await bcrypt.verify(hashed, plain);
    }
  }
  throw new Error('bcrypt compare/verify function not available');
};

if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line no-console
  console.log('[auth] bcrypt provider:', bcryptProvider, {
    hasCompare: typeof bcrypt?.compare === 'function',
    hasVerify: typeof bcrypt?.verify === 'function',
    hasHash: typeof bcrypt?.hash === 'function',
  });
}

const normalize = (s) => (s === undefined || s === null ? '' : String(s).trim());
const normalizeEmail = (s) => normalize(s).toLowerCase();

const PASSWORD_RESET_TOKEN_EXPIRES_MINUTES = Number(process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES || 30);
const ACCESS_TOKEN_EXPIRES = String(process.env.ACCESS_TOKEN_EXPIRES || '15m');
const REFRESH_TOKEN_EXPIRES_DEFAULT = String(process.env.REFRESH_TOKEN_EXPIRES_DEFAULT || '1d');
const REFRESH_TOKEN_EXPIRES_REMEMBER_ME = String(process.env.REFRESH_TOKEN_EXPIRES_REMEMBER_ME || '30d');
const REFRESH_COOKIE_NAME = String(process.env.REFRESH_COOKIE_NAME || 'refreshToken');

const sha256 = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const createPasswordResetToken = () => crypto.randomBytes(32).toString('hex');
const createRawRefreshToken = () => crypto.randomBytes(48).toString('hex');
const parseRememberMe = (value) => value === true || value === 'true' || value === 1 || value === '1';

const getRefreshTokenExpiresIn = (rememberMe = false) => (
  rememberMe ? REFRESH_TOKEN_EXPIRES_REMEMBER_ME : REFRESH_TOKEN_EXPIRES_DEFAULT
);

const getRefreshCookieOptions = (rememberMe = false) => ({
  httpOnly: true,
  secure: false,
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: rememberMe
    ? 7 * 24 * 60 * 60 * 1000
    : 24 * 60 * 60 * 1000,
});

const getRefreshTokenExpiresAt = (rememberMe = false) => {
  const expiresIn = getRefreshTokenExpiresIn(rememberMe);
  if (/^[0-9]+d$/.test(expiresIn)) {
    return new Date(Date.now() + Number(expiresIn.replace('d', '')) * 24 * 60 * 60 * 1000);
  }
  if (/^[0-9]+h$/.test(expiresIn)) {
    return new Date(Date.now() + Number(expiresIn.replace('h', '')) * 60 * 60 * 1000);
  }
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
};

const getRequestIpAddress = (req) => {
  const forwardedFor = normalize(req?.headers?.['x-forwarded-for']);
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return normalize(req?.ip || req?.socket?.remoteAddress || '');
};

const getRequestUserAgent = (req) => normalize(req?.headers?.['user-agent']);
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
  if (!toEmail) throw new Error('Recipient email is required for password reset');
  if (!resetUrl) throw new Error('Password reset URL is required');

  const subject = 'ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ';
  const text = [
    'เราได้รับคำขอให้ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ',
    '',
    `ลิงก์สำหรับตั้งรหัสผ่านใหม่: ${resetUrl}`,
    '',
    `ลิงก์นี้จะหมดอายุใน ${PASSWORD_RESET_TOKEN_EXPIRES_MINUTES} นาที`,
    'หากคุณไม่ได้เป็นผู้ส่งคำขอนี้ คุณสามารถละเว้นอีเมลฉบับนี้ได้',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #0f172a; max-width: 560px; margin: 0 auto;">
      <h2 style="margin-bottom: 12px;">ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ</h2>
      <p>เราได้รับคำขอให้ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 20px; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600;">ตั้งรหัสผ่านใหม่</a>
      </p>
      <p>หากปุ่มด้านบนไม่ทำงาน คุณสามารถคัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์ได้:</p>
      <p style="word-break: break-all; color: #2563eb;">${resetUrl}</p>
      <p>ลิงก์นี้จะหมดอายุใน ${PASSWORD_RESET_TOKEN_EXPIRES_MINUTES} นาที</p>
      <p style="color: #475569;">หากคุณไม่ได้เป็นผู้ส่งคำขอนี้ คุณสามารถละเว้นอีเมลฉบับนี้ได้</p>
    </div>
  `;

  return sendMailAction({ to: toEmail, subject, text, html });
};

const buildToken = (user, opts = {}) => {
  const profile = user.employeeProfile || null;
  return jwt.sign({
    id: user.id,
    role: user.role,
    profileType: 'employee',
    profileId: profile?.id || null,
    branchId: profile?.branchId || null,
    employeeId: profile?.id || null,
    ...opts,
  }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
};

const createRefreshTokenRecord = async ({ userId, rememberMe = false, req, tx = prisma }) => {
  const rawToken = createRawRefreshToken();
  const tokenHash = sha256(rawToken);
  const expiresAt = getRefreshTokenExpiresAt(rememberMe);

  const refreshToken = await tx.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: getRequestUserAgent(req) || null,
      ipAddress: getRequestIpAddress(req) || null,
    },
  });

  return { rawToken, tokenHash, expiresAt, rememberMe, refreshToken };
};

const setRefreshTokenCookie = (res, refreshToken, rememberMe = false) => {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions(rememberMe));
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  });
};

const revokeRefreshTokenFamilyChain = async ({ tokenId, tx = prisma, revokedAt = new Date() }) => {
  if (!tokenId) return;
  const visited = new Set();
  const queue = [tokenId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);

    const children = await tx.refreshToken.findMany({
      where: { replacedByTokenId: currentId },
      select: { id: true },
    });

    if (children.length > 0) {
      queue.push(...children.map((item) => item.id));
    }
  }

  if (visited.size > 0) {
    await tx.refreshToken.updateMany({
      where: { id: { in: Array.from(visited) } },
      data: { revokedAt },
    });
  }
};


const register = async (req, res) => {
  try {
    const shopName = normalize(req.body?.shopName);
    const shopSlug = normalize(req.body?.shopSlug).toLowerCase();
    const email = normalizeEmail(req.body?.email);
    
    // 🟢 1. เปิดท่อดักรับค่า categoryId พ่วงเพิ่มเข้ามาจาก Payload หน้าบ้าน
    const categoryId = req.body?.categoryId ? Number(req.body.categoryId) : 1;
    
    const rawPassword = Math.random().toString(36).slice(-10) + 'A1!';

    if (!shopName || !shopSlug || !email) {
      return res.status(400).json({ message: 'กรุณาระบุชื่อร้านค้า, Shop Slug และอีเมลติดต่อหลักให้ครบถ้วน' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'อีเมลติดต่อหลักนี้ถูกลงทะเบียนในระบบแพลตฟอร์มแล้ว' });
    }

    const existingBranch = await prisma.branch.findUnique({ where: { slug: shopSlug } });
    if (existingBranch) {
      return res.status(409).json({ message: 'ชื่อย่อลิงก์สาขา (Shop Slug) นี้ถูกใช้งานไปแล้ว กรุณาใช้ชื่ออื่น' });
    }

    const hashedPassword = await bcryptHash(rawPassword, 10);

    const transactionResult = await prisma.$transaction(async (tx) => {
      // 🟢 2. ยัดสลักล็อกความสัมพันธ์ categoryId เข้าสู่พิมพ์เขียวระดับกลุ่มธุรกิจสาขาตอนสมัครทันที
      const branch = await tx.branch.create({
        data: {
          name: shopName,
          slug: shopSlug,
          address: 'กรุณาอัปเดตที่อยู่ร้านค้า',
          categoryId: categoryId, // ➔ ผูกมัดเข้าหา Category สากล (1-6) 
          businessType: 'GENERAL'  // คงค่า Enum เดิมไว้ชั่วคราวเพื่อกันลอจิกสัดส่วนอื่นเอฟเฟกต์
        }
      });

      const user = await tx.user.create({
        data: {
          email,
          loginId: email,
          password: hashedPassword,
          role: 'ADMIN',
          loginType: 'EMAIL',
          enabled: true
        }
      });

      const employeeProfile = await tx.employeeProfile.create({
        data: {
          userId: user.id,
          branchId: branch.id,
          name: `${shopName} (Owner)`,
          v2Role: 'OWNER',
          approved: true,
          active: true
        }
      });

      const customerProfile = await tx.customerProfile.create({
        data: {
          userId: user.id,
          name: `${shopName} (พาร์ตเนอร์คู่ค้า)`,
          type: 'ORGANIZATION'
        }
      });

      const rawToken = createPasswordResetToken();
      const tokenHash = sha256(rawToken);
      const expiresAt = getPasswordResetExpiresAt();

      await tx.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      return { user, branch, employeeProfile, customerProfile, rawToken };
    });

    console.log(`[auth.register] Success: Branch ${shopSlug} and Dual-Profile created with Category ID: ${categoryId}.`);

    const resetUrl = buildPasswordResetUrl(req, transactionResult.rawToken);
    const subject = `🔑 ข้อมูลบัญชีและลิงก์ตั้งค่ารหัสผ่านสำหรับร้าน ${shopName}`;
    const text = [
      `ยินดีต้อนรับคุณพาร์ตเนอร์ ร้าน ${shopName} ได้เปิดระบบบนแพลตฟอร์มเรียบร้อยแล้ว`,
      '',
      `อีเมลเข้าใช้งาน: ${email}`,
      `รหัสผ่านชั่วคราวของคุณคือ: ${rawPassword}`,
      '',
      `กรุณาคลิกลิงก์ด้านล่างนี้เพื่อกำหนดรหัสผ่านส่วนตัวใหม่ก่อนเริ่มใช้งานระบบจัดการหลังบ้าน:`,
      `ลิงก์สำหรับตั้งรหัสผ่านใหม่: ${resetUrl}`,
      '',
      `ลิงก์ความปลอดภัยนี้จะหมดอายุภายใน ${PASSWORD_RESET_TOKEN_EXPIRES_MINUTES} นาที`,
    ].join('\n');

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #0f172a; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff;">
        <h2 style="color: #f97316; margin-bottom: 4px; font-weight: 900;">SADUAK<span style="color: #0f172a;">SABUY</span></h2>
        <p style="font-size: 11px; font-weight: bold; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin-top: 0;">Hyperlocal Market Platform</p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
        <h3 style="margin-bottom: 16px; font-size: 18px; color: #0f172a; font-weight: 800;">🎉 ยินดีต้อนรับร่วมเป็นพันธมิตรคู่ค้า!</h3>
        <p>ระบบร้านค้า <strong>${shopName}</strong> (Shop Slug: <span style="font-family: monospace; color: #f97316;">${shopSlug}</span>) ได้รับการลงทะเบียนเปิดสิทธิ์ในระบบพอร์ทัลกลางเรียบร้อยแล้วครับ</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>อีเมลล็อกอิน:</strong> ${email}</p>
          <p style="margin: 0; font-size: 13px;"><strong>รหัสผ่านชั่วคราว:</strong> <span style="font-family: monospace; background-color: #cbd5e1; padding: 2px 6px; border-radius: 4px; font-weight: bold; color: #0f172a;">${rawPassword}</span></p>
        </div>
        <p style="font-size: 13px; color: #475569;">เพื่อความปลอดภัยสูงสุดของข้อมูลคลังและระบบ POS หลังร้าน กรุณากดปุ่มด้านล่างนี้เพื่อทำการ <strong>กำหนดรหัสผ่านส่วนตัวใหม่</strong> ของคุณก่อนเริ่มเข้าเซสชันจัดการบัญชีร้านค้าครับ:</p>
        <p style="margin: 32px 0; text-align: center;">
          <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(to right, #f97316, #f59e0b); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 13px; box-shadow: 0 10px 15px -3px rgba(249, 115, 22, 0.3);">ตั้งรหัสผ่านใหม่และเปิดใช้งานร้านค้า</a>
        </p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <p style="font-size: 11px; color: #94a3b8; margin: 0;">* ลิงก์ความปลอดภัยนี้จะหมดอายุภายใน ${PASSWORD_RESET_TOKEN_EXPIRES_MINUTES} นาที หากคุณไม่ได้เป็นผู้ส่งคำขอลงทะเบียนเปิดร้านค้า สามารถปล่อยละเว้นอีเมลฉบับนี้ได้ทันทีครับ</p>
      </div>
    `;

    sendMailAction({ to: email, subject, text, html })
      .then(() => console.log(`✉️ [Register Mail] Sent welcome credentials successfully to: ${email}`))
      .catch((err) => console.error(`❌ [Register Mail Failed]`, err));

    const accessToken = buildToken(transactionResult.user);
    return res.status(201).json({
      token: accessToken,
      accessToken,
      role: transactionResult.user.role,
      profileType: 'employee',
      profile: {
        id: transactionResult.employeeProfile.id,
        name: transactionResult.employeeProfile.name,
        branch: transactionResult.branch,
        customerProfileId: transactionResult.customerProfile.id
      }
    });
  } catch (err) {
    console.error('❌ register error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'ระบบหลังบ้านขัดข้อง กรุณาลองใหม่อีกครั้ง' });
  }
};


const login = async (req, res, next) => {
  if (!global.__bcryptProviderLogged) {
    console.log('[auth] bcrypt provider:', bcryptProvider);
    global.__bcryptProviderLogged = true;
  }
  const t0 = Date.now();
  const reqId = req?.id || req?.headers?.['x-request-id'] || null;
  const timing = { reqId, totalMs: 0, findUserMs: 0, bcryptMs: 0, signJwtMs: 0 };

  try {
    const identifier = normalize(req.body?.emailOrPhone ?? req.body?.identifier);
    const password = normalize(req.body?.password);
    const rememberMe = parseRememberMe(req.body?.rememberMe);

    if (!identifier || !password) {
      return res.status(400).json({ message: 'กรุณาระบุอีเมล/เบอร์โทร และรหัสผ่าน' });
    }

    const looksLikeEmail = (v) => String(v || '').indexOf('@') > 0;
    const onlyDigits = (v) => String(v || '').split('').filter((c) => c >= '0' && c <= '9').join('');
    const toE164TH = (digits) => {
      if (!digits) return '';
      if (digits.startsWith('0') && digits.length === 10) return `+66${digits.slice(1)}`;
      return digits;
    };

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
      user = await prisma.user.findFirst({
        where: { loginId: identifier },
        include: includeProfiles,
      });

      if (!user) {
        const digits = onlyDigits(identifier);
        const e164 = toE164TH(digits);

        if (digits) {
          user = await prisma.user.findFirst({ where: { loginId: digits }, include: includeProfiles });
        }
        if (!user && e164 && e164 !== digits) {
          user = await prisma.user.findFirst({ where: { loginId: e164 }, include: includeProfiles });
        }

        if (!user && (digits || e164)) {
          const phoneCandidates = [digits, e164].filter(Boolean);
          let foundUserId = null;

          for (const p of phoneCandidates) {
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

    if (!user) return res.status(401).json({ message: 'ไม่พบบัญชีผู้ใช้ในระบบหลังบ้าน' });
    if (!user.employeeProfile) return res.status(403).json({ message: 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานระบบจัดการหลังบ้าน (เฉพาะเจ้าของร้านและพนักงานเท่านั้น)' });
    if (!user.enabled) return res.status(403).json({ message: 'บัญชีนี้ถูกปิดใช้งาน' });

    const tBcrypt0 = Date.now();
    const isMatch = await bcryptCompare(password, user.password);
    timing.bcryptMs = Date.now() - tBcrypt0;

    if (!isMatch) return res.status(401).json({ message: 'รหัสผ่านไม่ถูกต้อง' });
    if (user.employeeProfile.active === false) return res.status(403).json({ message: 'โปรไฟล์พนักงานของคุณถูกปิดใช้งาน' });
    if (user.employeeProfile.approved === false) return res.status(403).json({ message: 'โปรไฟล์พนักงานของคุณยังไม่ได้รับการอนุมัติจากผู้ดูแลระบบ' });

    const profile = user.employeeProfile;
    const tSign0 = Date.now();
    const accessToken = buildToken(user);
    timing.signJwtMs = Date.now() - tSign0;

    const refreshTokenRecord = await createRefreshTokenRecord({ userId: user.id, rememberMe, req });
    setRefreshTokenCookie(res, refreshTokenRecord.rawToken, rememberMe);
    timing.totalMs = Date.now() - t0;

    return res.json({
      token: accessToken,
      accessToken,
      role: user.role,
      profileType: 'employee',
      profile: {
        id: profile.id,
        name: profile.name || '',
        phone: profile.phone || '',
        branch: profile.branch || null,
        position: profile.position || null,
        user: { id: user.id, email: user.email, role: user.role },
      },
      session: {
        rememberMe,
        accessTokenExpiresIn: ACCESS_TOKEN_EXPIRES,
        refreshTokenExpiresIn: getRefreshTokenExpiresIn(rememberMe),
      },
    });
  } catch (error) {
    timing.totalMs = Date.now() - t0;
    console.error('🔥 Login error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบเซิร์ฟเวอร์หลังบ้าน' });
  }
};

/**
 * 👥 [SUB-EMPLOYEE CREATION]: ฟังก์ชันสำหรับเจ้าของร้าน (OWNER) กดเพิ่มบัญชีพนักงานย่อยในสาขาตนเอง
 * แก้ไข: นำฟิลด์ phone ออกจากโมเดล CustomerProfile เพื่อให้สอดคล้องตามโครงสร้าง schema.prisma ของระบบ
 */
const addSubEmployee = async (req, res) => {
  try {
    const ownerBranchId = req.user?.branchId || req.user?.employeeProfile?.branchId;
    if (!ownerBranchId) {
      return res.status(403).json({ message: 'สิทธิ์ของคุณไม่ถูกต้อง หรือบัญชีนี้ไม่ได้ถูกผูกเข้ากับสาขาหลัก' });
    }

    const employeeName = normalize(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    const rawPassword = normalize(req.body?.password);
    const subRole = req.body?.v2Role;
    const phone = normalize(req.body?.phone);

    if (!employeeName || !email || !rawPassword || !subRole) {
      return res.status(400).json({ message: 'กรุณากรอกชื่อ, อีเมล, รหัสผ่าน และสิทธิ์ตำแหน่งให้ครบถ้วน' });
    }

    if (subRole !== 'MANAGER' && subRole !== 'CASHIER') {
      return res.status(400).json({ message: 'ระดับตำแหน่งพนักงานไม่ถูกต้อง (ต้องเลือกเป็น MANAGER หรือ CASHIER)' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'อีเมลนี้ถูกลงทะเบียนใช้งานในระบบแพลตฟอร์มแล้ว' });
    }

    const hashedPassword = await bcryptHash(rawPassword, 10);

    // 🏛️ ATOMIC TRANSACTION COMMIT (สร้างโมเดลร่วมสาขา)
    const newEmployee = await prisma.$transaction(async (tx) => {
      // 1. สร้าง Identity หลักในตารางผู้ใช้งาน
      const user = await tx.user.create({
        data: {
          email,
          loginId: email,
          password: hashedPassword,
          role: 'EMPLOYEE',
          loginType: 'EMAIL',
          enabled: true
        }
      });

      // 2. สวมสิทธิ์พนักงานลงตาราง EmployeeProfile (รองรับฟิลด์ phone ถูกต้อง)
      const employeeProfile = await tx.employeeProfile.create({
        data: {
          userId: user.id,
          branchId: ownerBranchId,
          name: employeeName,
          phone: phone || null, // ตารางพนักงานบันทึกเบอร์โทรศัพท์ได้ปกติ
          v2Role: subRole,
          approved: true,
          active: true
        }
      });

      // 3. สวมหมวกลูกค้าคู่ขนาน (Dual-Profile Matrix)
      await tx.customerProfile.create({
        data: {
          userId: user.id,
          name: employeeName,
          // 🟢 FIXED: ตัดฟิลด์ phone ออกแล้ว เพื่อไม่ให้ Prisma เกิดข้อผิดพลาดตอนคอมมิตข้อมูล
          type: 'INDIVIDUAL'
        }
      });

      return { user, employeeProfile };
    });

    console.log(`👥 [Sub-Employee Created] "${employeeName}" added to Branch ID: ${ownerBranchId} successfully.`);

    return res.status(201).json({
      ok: true,
      message: `ลงทะเบียนเพิ่มพนักงาน "${employeeName}" เข้าสู่ระบบร้านค้าสำเร็จ`,
      data: {
        userId: newEmployee.user.id,
        employeeId: newEmployee.employeeProfile.id,
        name: newEmployee.employeeProfile.name,
        email: newEmployee.user.email,
        v2Role: newEmployee.employeeProfile.v2Role,
        branchId: newEmployee.employeeProfile.branchId
      }
    });
  } catch (err) {
    console.error('❌ addSubEmployee error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'เซิร์ฟเวอร์หลังบ้านขัดข้อง ไม่สามารถเพิ่มบัญชีพนักงานได้' });
  }
};

const findUserByEmail = async (req, res) => {
  try {
    const email = normalizeEmail(req.query?.email);
    if (!email) return res.status(400).json({ message: 'กรุณาระบุอีเมล' });

    const user = await prisma.user.findUnique({
      where: { email },
      include: { customerProfile: true, employeeProfile: true },
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

const forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ message: 'กรุณากรอกอีเมล' });

    const genericSuccessMessage = 'หากข้อมูลของคุณมีอยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่แล้ว';
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, enabled: true },
    });

    if (!user || !user.enabled) return res.json({ message: genericSuccessMessage });

    const rawToken = createPasswordResetToken();
    const tokenHash = sha256(rawToken);
    const expiresAt = getPasswordResetExpiresAt();
    const resetUrl = buildPasswordResetUrl(req, rawToken);

    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });
    });

    try {
      await sendPasswordResetEmail({ toEmail: user.email, resetUrl });
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

    if (!rawToken) return res.status(400).json({ message: 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือไม่ครบถ้วน' });
    if (!password || !confirmPassword) return res.status(400).json({ message: 'กรุณากรอกรหัสผ่านใหม่และยืนยันรหัสผ่าน' });
    if (password.length < 6) return res.status(400).json({ message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
    if (password !== confirmPassword) return res.status(400).json({ message: 'ยืนยันรหัสผ่านไม่ตรงกัน' });

    const tokenHash = sha256(rawToken);
    const resetRecord = await prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, enabled: true } } },
    });

    if (!resetRecord || !resetRecord.user?.enabled) {
      return res.status(400).json({ message: 'ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอรีเซ็ตรหัสผ่านใหม่อีกครั้ง' });
    }

    const hashedPassword = await bcryptHash(password, 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetRecord.user.id },
        data: { password: hashedPassword },
      });
      await tx.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: resetRecord.user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
    });

    return res.json({ message: 'ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบอีกครั้ง' });
  } catch (error) {
    console.error('❌ resetPassword error:', error);
    return res.status(500).json({ message: 'ไม่สามารถรีเซ็ตรหัสผ่านได้' });
  }
};

const refreshSession = async (req, res) => {
  try {
    const rawRefreshToken = normalize(req.cookies?.[REFRESH_COOKIE_NAME]);
    if (!rawRefreshToken) return res.status(401).json({ message: 'Refresh token not found' });

    const tokenHash = sha256(rawRefreshToken);
    const existingToken = await prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: {
        user: {
          include: {
            employeeProfile: { include: { branch: true, position: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!existingToken) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    if (existingToken.revokedAt) {
      await revokeRefreshTokenFamilyChain({ tokenId: existingToken.id });
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Refresh token reuse detected. Please log in again.' });
    }

    if (existingToken.expiresAt <= new Date()) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Session expired' });
    }

    const user = existingToken.user;
    if (!user || !user.enabled || !user.employeeProfile) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Session expired or not allowed' });
    }

    if (user.employeeProfile.active === false || user.employeeProfile.approved === false) {
      clearRefreshTokenCookie(res);
      return res.status(403).json({ message: 'Session is no longer allowed' });
    }

    const rememberMe = existingToken.expiresAt.getTime() - existingToken.createdAt.getTime() > 24 * 60 * 60 * 1000;
    const rotated = await prisma.$transaction(async (tx) => {
      const newTokenRecord = await createRefreshTokenRecord({ userId: user.id, rememberMe, req, tx });
      await tx.refreshToken.update({
        where: { id: existingToken.id },
        data: { revokedAt: new Date(), replacedByTokenId: newTokenRecord.refreshToken.id },
      });
      return newTokenRecord;
    });

    const profile = user.employeeProfile;
    const accessToken = buildToken(user);
    setRefreshTokenCookie(res, rotated.rawToken, rememberMe);

    return res.json({
      token: accessToken,
      accessToken,
      role: user.role,
      profileType: 'employee',
      profile: {
        id: profile.id,
        name: profile.name || '',
        phone: profile.phone || '',
        branch: profile.branch || null,
        position: profile.position || null,
        user: { id: user.id, email: user.email, role: user.role },
      },
      session: {
        rememberMe,
        accessTokenExpiresIn: ACCESS_TOKEN_EXPIRES,
        refreshTokenExpiresIn: getRefreshTokenExpiresIn(rememberMe),
      },
    });
  } catch (error) {
    clearRefreshTokenCookie(res);
    console.error('❌ refreshSession error:', error);
    return res.status(401).json({ message: 'Unable to refresh session' });
  }
};

const logoutSession = async (req, res) => {
  try {
    const rawRefreshToken = normalize(req.cookies?.[REFRESH_COOKIE_NAME]);
    if (rawRefreshToken) {
      const tokenHash = sha256(rawRefreshToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    clearRefreshTokenCookie(res);
    return res.json({ message: 'ออกจากระบบเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('❌ logoutSession error:', error);
    return res.status(500).json({ message: 'ไม่สามารถออกจากระบบได้' });
  }
};

const revokeSession = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Unauthorized' });
    }
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    clearRefreshTokenCookie(res);
    return res.json({ message: 'ออกจากระบบทุกอุปกรณ์เรียบร้อยแล้ว' });
  } catch (error) {
    console.error('❌ revokeSession error:', error);
    return res.status(500).json({ message: 'ไม่สามารถออกจากระบบทุกอุปกรณ์ได้' });
  }
};

const getMe = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        employeeProfile: { include: { branch: true, position: true } },
      },
    });

    if (!user || !user.employeeProfile) {
      return res.status(404).json({ message: 'User or EmployeeProfile not found' });
    }

    const profile = user.employeeProfile;
    return res.json({
      role: user.role,
      profileType: 'employee',
      branchId: profile.branchId || null,
      profile: {
        id: profile.id || null,
        name: profile.name || '',
        phone: profile.phone || '',
        email: user.email || '',
        branch: profile.branch || null,
        position: profile.position || null,
        branchId: profile.branchId || null,
        user: { id: user.id, email: user.email, role: user.role },
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
  addSubEmployee,
  refreshSession,
  logoutSession,
  revokeSession,
  forgotPassword,
  resetPassword,
  getMe,
  findUserByEmail,
};