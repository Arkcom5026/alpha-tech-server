const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const repository = require('./sessionAuthRuntimeRepository');
const { sendMailAction } = require('../../../../../utils/mailSender');

const ACCESS_TOKEN_EXPIRES = String(process.env.ACCESS_TOKEN_EXPIRES || '1h');
const REFRESH_TOKEN_EXPIRES_DEFAULT = String(process.env.REFRESH_TOKEN_EXPIRES_DEFAULT || '1d');
const REFRESH_TOKEN_EXPIRES_REMEMBER_ME = String(process.env.REFRESH_TOKEN_EXPIRES_REMEMBER_ME || '30d');
const REFRESH_COOKIE_NAME = String(process.env.REFRESH_COOKIE_NAME || 'refreshToken');
const PASSWORD_RESET_TOKEN_EXPIRES_MINUTES = Number(
  process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES || 30
);

let bcrypt;
let bcryptProvider = 'unknown';
try {
  bcrypt = require('@node-rs/bcrypt');
  bcryptProvider = 'node-rs';
} catch (nodeRsError) {
  try {
    bcrypt = require('bcrypt');
    bcryptProvider = 'bcrypt';
  } catch (bcryptError) {
    bcrypt = require('bcryptjs');
    bcryptProvider = 'bcryptjs';
  }
}

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
    } catch (error) {
      return bcrypt.verify(hashed, plain);
    }
  }
  throw new Error('bcrypt compare/verify function not available');
};

const normalize = (value) => (
  value === undefined || value === null ? '' : String(value).trim()
);
const normalizeEmail = (value) => normalize(value).toLowerCase();
const sha256 = (value) => crypto
  .createHash('sha256')
  .update(String(value || ''))
  .digest('hex');
const createRawRefreshToken = () => crypto.randomBytes(48).toString('hex');
const createRawPasswordResetToken = () => crypto.randomBytes(32).toString('hex');
const parseRememberMe = (value) => (
  value === true || value === 'true' || value === 1 || value === '1'
);

const getRefreshTokenExpiresIn = (rememberMe = false) => (
  rememberMe ? REFRESH_TOKEN_EXPIRES_REMEMBER_ME : REFRESH_TOKEN_EXPIRES_DEFAULT
);

const getRefreshTokenExpiresAt = (rememberMe = false) => {
  const expiresIn = getRefreshTokenExpiresIn(rememberMe);
  if (/^[0-9]+d$/.test(expiresIn)) {
    return new Date(
      Date.now() + Number(expiresIn.replace('d', '')) * 24 * 60 * 60 * 1000
    );
  }
  if (/^[0-9]+h$/.test(expiresIn)) {
    return new Date(
      Date.now() + Number(expiresIn.replace('h', '')) * 60 * 60 * 1000
    );
  }
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
};

const getRefreshCookieOptions = (rememberMe = false) => ({
  httpOnly: true,
  secure: false,
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: rememberMe
    ? 7 * 24 * 60 * 60 * 1000
    : 24 * 60 * 60 * 1000,
});

const getRequestIpAddress = (req) => {
  const forwardedFor = normalize(req?.headers?.['x-forwarded-for']);
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return normalize(req?.ip || req?.socket?.remoteAddress || '');
};

const getRequestUserAgent = (req) => normalize(req?.headers?.['user-agent']);

const getAppBaseUrl = (req) => {
  const envBaseUrl = normalize(process.env.APP_BASE_URL || process.env.CLIENT_URL);
  if (envBaseUrl) return envBaseUrl;

  const originHeader = normalize(req?.headers?.origin);
  if (originHeader) return originHeader;

  const forwardedProto = normalize(req?.headers?.['x-forwarded-proto']);
  const forwardedHost = normalize(req?.headers?.['x-forwarded-host']);
  if (forwardedProto && forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  const protocol = normalize(req?.protocol);
  const host = normalize(req?.get?.('host'));
  if (protocol && host) return `${protocol}://${host}`;

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

const buildToken = (user) => {
  const profile = user.employeeProfile || null;
  return jwt.sign({
    id: user.id,
    role: user.role,
    profileType: 'employee',
    profileId: profile?.id || null,
    branchId: profile?.branchId || null,
    employeeId: profile?.id || null,
  }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
};

const setRefreshTokenCookie = (res, refreshToken, rememberMe = false) => {
  res.cookie(
    REFRESH_COOKIE_NAME,
    refreshToken,
    getRefreshCookieOptions(rememberMe)
  );
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  });
};

const createRefreshTokenRecord = async ({ userId, rememberMe = false, req, tx }) => {
  const rawToken = createRawRefreshToken();
  const tokenHash = sha256(rawToken);
  const expiresAt = getRefreshTokenExpiresAt(rememberMe);
  const refreshToken = await repository.createRefreshToken({
    userId,
    tokenHash,
    expiresAt,
    userAgent: getRequestUserAgent(req) || null,
    ipAddress: getRequestIpAddress(req) || null,
  }, tx);

  return { rawToken, tokenHash, expiresAt, rememberMe, refreshToken };
};

const revokeRefreshTokenFamilyChain = async ({ tokenId, tx, revokedAt = new Date() }) => {
  if (!tokenId) return;
  const visited = new Set();
  const queue = [tokenId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);
    const children = await repository.findRefreshTokenChildren(currentId, tx);
    queue.push(...children.map((item) => item.id));
  }

  if (visited.size > 0) {
    await repository.revokeRefreshTokensByIds({
      ids: Array.from(visited),
      revokedAt,
    }, tx);
  }
};

const register = async (req, res) => {
  try {
    const shopName = normalize(req.body?.shopName);
    const shopSlug = normalize(req.body?.shopSlug).toLowerCase();
    const email = normalizeEmail(req.body?.email);
    const categoryId = req.body?.categoryId ? Number(req.body.categoryId) : 1;
    const rawPassword = `${Math.random().toString(36).slice(-10)}A1!`;

    if (!shopName || !shopSlug || !email) {
      return res.status(400).json({
        message: 'กรุณาระบุชื่อร้านค้า, Shop Slug และอีเมลติดต่อหลักให้ครบถ้วน',
      });
    }

    const existingUser = await repository.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        message: 'อีเมลติดต่อหลักนี้ถูกลงทะเบียนในระบบแพลตฟอร์มแล้ว',
      });
    }

    const existingBranch = await repository.findBranchBySlug(shopSlug);
    if (existingBranch) {
      return res.status(409).json({
        message: 'ชื่อย่อลิงก์สาขา (Shop Slug) นี้ถูกใช้งานไปแล้ว กรุณาใช้ชื่ออื่น',
      });
    }

    const hashedPassword = await bcryptHash(rawPassword, 10);
    const transactionResult = await repository.runTransaction(async (tx) => {
      const branch = await repository.createBranch({
        name: shopName,
        slug: shopSlug,
        address: 'กรุณาอัปเดตที่อยู่ร้านค้า',
        categoryId,
        businessType: 'GENERAL',
      }, tx);

      const user = await repository.createUser({
        email,
        loginId: email,
        password: hashedPassword,
        role: 'ADMIN',
        loginType: 'EMAIL',
        enabled: true,
      }, tx);

      const employeeProfile = await repository.createEmployeeProfile({
        userId: user.id,
        branchId: branch.id,
        name: `${shopName} (Owner)`,
        v2Role: 'OWNER',
        approved: true,
        active: true,
      }, tx);

      const customerProfile = await repository.createCustomerProfile({
        userId: user.id,
        name: `${shopName} (พาร์ตเนอร์คู่ค้า)`,
        type: 'ORGANIZATION',
      }, tx);

      const rawToken = createRawPasswordResetToken();
      await repository.createPasswordResetToken({
        userId: user.id,
        tokenHash: sha256(rawToken),
        expiresAt: new Date(
          Date.now() + PASSWORD_RESET_TOKEN_EXPIRES_MINUTES * 60 * 1000
        ),
      }, tx);

      return { user, branch, employeeProfile, customerProfile, rawToken };
    });

    const resetUrl = buildPasswordResetUrl(req, transactionResult.rawToken);
    const subject = `🔑 ข้อมูลบัญชีและลิงก์ตั้งค่ารหัสผ่านสำหรับร้าน ${shopName}`;
    const text = [
      `ยินดีต้อนรับคุณพาร์ตเนอร์ ร้าน ${shopName} ได้เปิดระบบบนแพลตฟอร์มเรียบร้อยแล้ว`,
      '',
      `อีเมลเข้าใช้งาน: ${email}`,
      `รหัสผ่านชั่วคราวของคุณคือ: ${rawPassword}`,
      '',
      'กรุณาคลิกลิงก์ด้านล่างนี้เพื่อกำหนดรหัสผ่านส่วนตัวใหม่ก่อนเริ่มใช้งานระบบจัดการหลังบ้าน:',
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
      .catch((error) => console.error('❌ [Register Mail Failed]', error));

    const accessToken = buildToken({
      ...transactionResult.user,
      employeeProfile: transactionResult.employeeProfile,
    });

    return res.status(201).json({
      token: accessToken,
      accessToken,
      role: transactionResult.user.role,
      profileType: 'employee',
      profile: {
        id: transactionResult.employeeProfile.id,
        name: transactionResult.employeeProfile.name,
        branch: transactionResult.branch,
        customerProfileId: transactionResult.customerProfile.id,
      },
    });
  } catch (error) {
    console.error('❌ register error:', error);
    return res.status(500).json({
      ok: false,
      error: error?.message || 'ระบบหลังบ้านขัดข้อง กรุณาลองใหม่อีกครั้ง',
    });
  }
};

const login = async (req, res) => {
  if (!global.__bcryptProviderLogged) {
    console.log('[auth] bcrypt provider:', bcryptProvider);
    global.__bcryptProviderLogged = true;
  }

  try {
    const identifier = normalize(req.body?.emailOrPhone ?? req.body?.identifier);
    const password = normalize(req.body?.password);
    const rememberMe = parseRememberMe(req.body?.rememberMe);

    if (!identifier || !password) {
      return res.status(400).json({ message: 'กรุณาระบุอีเมล/เบอร์โทร และรหัสผ่าน' });
    }

    const looksLikeEmail = (value) => String(value || '').includes('@');
    const onlyDigits = (value) => String(value || '').replace(/\D/g, '');
    const toE164TH = (digits) => {
      if (!digits) return '';
      if (digits.startsWith('0') && digits.length === 10) return `+66${digits.slice(1)}`;
      return digits;
    };

    let user = null;
    if (looksLikeEmail(identifier)) {
      user = await repository.findLoginUserByEmail(normalizeEmail(identifier));
    } else {
      user = await repository.findLoginUserByLoginId(identifier);

      if (!user) {
        const digits = onlyDigits(identifier);
        const e164 = toE164TH(digits);

        if (digits) user = await repository.findLoginUserByLoginId(digits);
        if (!user && e164 && e164 !== digits) {
          user = await repository.findLoginUserByLoginId(e164);
        }

        if (!user && (digits || e164)) {
          const phoneCandidates = [digits, e164].filter(Boolean);
          let foundUserId = null;

          for (const phone of phoneCandidates) {
            const employee = await repository.findEmployeeUserIdByPhone(phone);
            if (employee?.userId) {
              foundUserId = employee.userId;
              break;
            }
          }

          if (foundUserId) user = await repository.findLoginUserById(foundUserId);
        }
      }
    }

    if (!user) return res.status(401).json({ message: 'ไม่พบบัญชีผู้ใช้ในระบบหลังบ้าน' });
    if (!user.employeeProfile) {
      return res.status(403).json({
        message: 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานระบบจัดการหลังบ้าน (เฉพาะเจ้าของร้านและพนักงานเท่านั้น)',
      });
    }
    if (!user.enabled) return res.status(403).json({ message: 'บัญชีนี้ถูกปิดใช้งาน' });

    const isMatch = await bcryptCompare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'รหัสผ่านไม่ถูกต้อง' });
    if (user.employeeProfile.active === false) {
      return res.status(403).json({ message: 'โปรไฟล์พนักงานของคุณถูกปิดใช้งาน' });
    }
    if (user.employeeProfile.approved === false) {
      return res.status(403).json({
        message: 'โปรไฟล์พนักงานของคุณยังไม่ได้รับการอนุมัติจากผู้ดูแลระบบ',
      });
    }

    const profile = user.employeeProfile;
    const accessToken = buildToken(user);
    const refreshTokenRecord = await createRefreshTokenRecord({
      userId: user.id,
      rememberMe,
      req,
    });
    setRefreshTokenCookie(res, refreshTokenRecord.rawToken, rememberMe);

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
    console.error('🔥 Login error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบเซิร์ฟเวอร์หลังบ้าน' });
  }
};

const refreshSession = async (req, res) => {
  const trace = (stage, payload = {}) => {
    if (process.env.AUTH_TRACE === '1') console.log('[refreshSession]', stage, payload);
  };

  try {
    const rawRefreshToken = normalize(req.cookies?.[REFRESH_COOKIE_NAME]);
    if (!rawRefreshToken) {
      trace('MISSING_COOKIE');
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Refresh token is required' });
    }

    const tokenHash = sha256(rawRefreshToken);
    const existingToken = await repository.findRefreshTokenByHash(tokenHash);
    if (!existingToken) {
      trace('TOKEN_NOT_FOUND');
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const now = new Date();
    if (existingToken.revokedAt) {
      trace('TOKEN_REUSE', { tokenId: existingToken.id });
      await repository.runTransaction(async (tx) => {
        await revokeRefreshTokenFamilyChain({ tokenId: existingToken.id, tx, revokedAt: now });
      });
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Refresh token reuse detected' });
    }

    if (existingToken.expiresAt <= now) {
      trace('TOKEN_EXPIRED', { tokenId: existingToken.id });
      await repository.updateRefreshToken({
        id: existingToken.id,
        data: { revokedAt: now },
      });
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Refresh token expired' });
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

    const rememberMe = (
      existingToken.expiresAt.getTime() - existingToken.createdAt.getTime()
      > 24 * 60 * 60 * 1000
    );

    const rotated = await repository.runTransaction(async (tx) => {
      const newTokenRecord = await createRefreshTokenRecord({
        userId: user.id,
        rememberMe,
        req,
        tx,
      });
      await repository.updateRefreshToken({
        id: existingToken.id,
        data: {
          revokedAt: now,
          replacedByTokenId: newTokenRecord.refreshToken.id,
        },
      }, tx);
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
      await repository.revokeRefreshTokenByHash({
        tokenHash: sha256(rawRefreshToken),
        revokedAt: new Date(),
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

    await repository.revokeActiveRefreshTokensByUserId({
      userId,
      revokedAt: new Date(),
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

    const user = await repository.findSessionUserById(userId);
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

const findUserByEmail = async (req, res) => {
  try {
    const email = normalizeEmail(req.query?.email);
    if (!email) return res.status(400).json({ message: 'กรุณาระบุอีเมล' });

    const user = await repository.findUserByEmail(email);
    if (!user) return res.status(404).json({ message: 'ไม่พบผู้ใช้อีเมลนี้' });

    return res.json({
      id: user.id,
      email: user.email,
      name: user.customerProfile?.name || '',
      phone: user.customerProfile?.phone || '',
      alreadyEmployee: Boolean(user.employeeProfile),
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
    const user = await repository.findPasswordResetEligibleUserByEmail(email);

    if (!user || !user.enabled) return res.json({ message: genericSuccessMessage });

    const rawToken = createRawPasswordResetToken();
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(
      Date.now() + PASSWORD_RESET_TOKEN_EXPIRES_MINUTES * 60 * 1000
    );
    const resetUrl = buildPasswordResetUrl(req, rawToken);

    await repository.runTransaction(async (tx) => {
      await repository.invalidateActivePasswordResetTokensByUserId({
        userId: user.id,
        usedAt: new Date(),
      }, tx);
      await repository.createPasswordResetToken({
        userId: user.id,
        tokenHash,
        expiresAt,
      }, tx);
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

    const resetRecord = await repository.findActivePasswordResetTokenByHash(
      sha256(rawToken)
    );

    if (!resetRecord || !resetRecord.user?.enabled) {
      return res.status(400).json({
        message: 'ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอรีเซ็ตรหัสผ่านใหม่อีกครั้ง',
      });
    }

    const hashedPassword = await bcryptHash(password, 10);
    const usedAt = new Date();

    await repository.runTransaction(async (tx) => {
      await repository.updateUser({
        id: resetRecord.user.id,
        data: { password: hashedPassword },
      }, tx);
      await repository.updatePasswordResetToken({
        id: resetRecord.id,
        data: { usedAt },
      }, tx);
      await repository.invalidateActivePasswordResetTokensByUserId({
        userId: resetRecord.user.id,
        usedAt,
      }, tx);
    });

    return res.json({ message: 'ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบอีกครั้ง' });
  } catch (error) {
    console.error('❌ resetPassword error:', error);
    return res.status(500).json({ message: 'ไม่สามารถรีเซ็ตรหัสผ่านได้' });
  }
};

module.exports = {
  login,
  register,
  refreshSession,
  logoutSession,
  getMe,
  forgotPassword,
  resetPassword,
  findUserByEmail,
  revokeSession,
};
