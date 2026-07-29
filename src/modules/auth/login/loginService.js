const loginRepository = require('./loginRepository');
const { comparePassword } = require('../shared/passwordHasher');
const {
  normalize,
  normalizeEmail,
  onlyDigits,
  toE164TH,
  looksLikeEmail,
} = require('../shared/authNormalization');

const findUserByIdentifier = async (identifier) => {
  if (looksLikeEmail(identifier)) {
    return loginRepository.findByEmail(normalizeEmail(identifier));
  }

  let user = await loginRepository.findByLoginId(identifier);
  if (user) return user;

  const digits = onlyDigits(identifier);
  const e164 = toE164TH(digits);

  if (digits) {
    user = await loginRepository.findByLoginId(digits);
  }

  if (!user && e164 && e164 !== digits) {
    user = await loginRepository.findByLoginId(e164);
  }

  if (!user && (digits || e164)) {
    for (const phone of [digits, e164].filter(Boolean)) {
      const userId = await loginRepository.findEmployeeProfileUserIdByPhone(phone);
      if (userId) return loginRepository.findById(userId);
    }
  }

  return null;
};

const authenticate = async ({ identifier: rawIdentifier, password: rawPassword }) => {
  const identifier = normalize(rawIdentifier);
  const password = normalize(rawPassword);

  if (!identifier || !password) {
    return {
      ok: false,
      status: 400,
      body: { message: 'กรุณาระบุอีเมล/เบอร์โทร และรหัสผ่าน' },
    };
  }

  const user = await findUserByIdentifier(identifier);

  if (!user) {
    return { ok: false, status: 401, body: { message: 'ไม่พบบัญชีผู้ใช้ในระบบหลังบ้าน' } };
  }
  if (!user.employeeProfile) {
    return {
      ok: false,
      status: 403,
      body: { message: 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานระบบจัดการหลังบ้าน (เฉพาะเจ้าของร้านและพนักงานเท่านั้น)' },
    };
  }
  if (!user.enabled) {
    return { ok: false, status: 403, body: { message: 'บัญชีนี้ถูกปิดใช้งาน' } };
  }

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    return { ok: false, status: 401, body: { message: 'รหัสผ่านไม่ถูกต้อง' } };
  }
  if (user.employeeProfile.active === false) {
    return { ok: false, status: 403, body: { message: 'โปรไฟล์พนักงานของคุณถูกปิดใช้งาน' } };
  }
  if (user.employeeProfile.approved === false) {
    return {
      ok: false,
      status: 403,
      body: { message: 'โปรไฟล์พนักงานของคุณยังไม่ได้รับการอนุมัติจากผู้ดูแลระบบ' },
    };
  }

  return { ok: true, user };
};

module.exports = { authenticate, findUserByIdentifier };
