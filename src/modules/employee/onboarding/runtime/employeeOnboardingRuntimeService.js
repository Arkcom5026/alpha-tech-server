const bcrypt = require('bcryptjs');

const repository = require('./employeeOnboardingRuntimeRepository');
const {
  POSITION_CAPABILITIES,
  deriveCompatibilityRoleFromPosition,
  hasCapability,
} = require('../../authorization/employeePositionAuthority');

const normalize = (value) => String(value || '').trim();
const normalizeEmail = (value) => normalize(value).toLowerCase();
const normalizeUpper = (value) => normalize(value).toUpperCase();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const canCreateEmployee = (actor = {}) => (
  hasCapability(actor, POSITION_CAPABILITIES.EMPLOYEE_MANAGE)
);

const addSubEmployee = async (req, res) => {
  try {
    const actor = req.user || {};

    if (!canCreateEmployee(actor)) {
      return res.status(403).json({
        code: 'EMPLOYEE_ONBOARDING_FORBIDDEN',
        message: 'ตำแหน่งของบัญชีนี้ไม่มีสิทธิ์เพิ่มพนักงานใหม่',
      });
    }

    const branchId = toPositiveInt(actor.branchId || actor.employeeProfile?.branchId);
    if (!branchId) {
      return res.status(403).json({
        code: 'EMPLOYEE_ONBOARDING_BRANCH_REQUIRED',
        message: 'บัญชีผู้สร้างพนักงานไม่ได้ผูกกับสาขาที่ใช้งาน',
      });
    }

    const name = normalize(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    const password = normalize(req.body?.password);
    const phone = normalize(req.body?.phone) || null;
    const requestedV2Role = normalizeUpper(req.body?.v2Role);
    const positionId = toPositiveInt(req.body?.positionId);

    if (!name || !email || !password || !positionId) {
      return res.status(400).json({
        code: 'EMPLOYEE_ONBOARDING_FIELDS_REQUIRED',
        message: 'กรุณากรอกชื่อ อีเมล รหัสผ่าน และตำแหน่งงานให้ครบถ้วน',
      });
    }

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({
        code: 'EMPLOYEE_EMAIL_INVALID',
        message: 'กรุณากรอกอีเมลสำหรับเข้าสู่ระบบให้ถูกต้อง',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        code: 'EMPLOYEE_PASSWORD_TOO_SHORT',
        message: 'รหัสผ่านเริ่มต้นต้องมีความยาวอย่างน้อย 8 ตัวอักษร',
      });
    }

    const [existingUser, position] = await Promise.all([
      repository.findUserByEmail(email),
      repository.findPositionForBranch({ id: positionId, branchId }),
    ]);

    if (existingUser) {
      return res.status(409).json({
        code: 'EMPLOYEE_EMAIL_ALREADY_EXISTS',
        message: 'อีเมลนี้ถูกลงทะเบียนใช้งานในระบบแล้ว',
      });
    }

    if (!position) {
      return res.status(400).json({
        code: 'EMPLOYEE_POSITION_NOT_FOUND',
        message: 'ไม่พบตำแหน่งงานที่ใช้งานได้ในสาขาปัจจุบัน กรุณาโหลดรายการตำแหน่งใหม่',
      });
    }

    const positionDerivedRole = deriveCompatibilityRoleFromPosition(position);
    const v2Role = positionDerivedRole || requestedV2Role;
    if (!['MANAGER', 'CASHIER'].includes(v2Role)) {
      return res.status(400).json({
        code: 'EMPLOYEE_STORE_ROLE_INVALID',
        message: 'ตำแหน่งงานนี้ยังใช้ระบบสิทธิ์เดิม กรุณาระบุบทบาทเดิมเป็น MANAGER หรือ CASHIER',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const created = await repository.runTransaction(async (tx) => {
      const user = await repository.createUser({
        email,
        loginId: email,
        password: passwordHash,
        role: 'EMPLOYEE',
        loginType: 'EMAIL',
        enabled: true,
      }, tx);

      const employeeProfile = await repository.createEmployeeProfile({
        userId: user.id,
        branchId,
        positionId,
        name,
        phone,
        v2Role,
        approved: true,
        active: true,
      }, tx);

      await repository.createCustomerProfile({
        userId: user.id,
        name,
        type: 'INDIVIDUAL',
      }, tx);

      return { user, employeeProfile };
    });

    return res.status(201).json({
      ok: true,
      message: `สร้างบัญชีพนักงาน "${name}" สำเร็จและพร้อมใช้งานทันที`,
      data: {
        userId: created.user.id,
        employeeId: created.employeeProfile.id,
        name: created.employeeProfile.name,
        email: created.user.email,
        phone: created.employeeProfile.phone,
        v2Role: created.employeeProfile.v2Role,
        positionId: created.employeeProfile.positionId,
        position: created.employeeProfile.position,
        branchId: created.employeeProfile.branchId,
        branch: created.employeeProfile.branch,
        approved: created.employeeProfile.approved,
        active: created.employeeProfile.active,
        enabled: created.user.enabled,
      },
    });
  } catch (error) {
    if (repository.isUniqueConstraintError?.(error)) {
      return res.status(409).json({
        ok: false,
        code: 'EMPLOYEE_EMAIL_ALREADY_EXISTS',
        message: 'อีเมลนี้ถูกลงทะเบียนใช้งานในระบบแล้ว',
      });
    }

    console.error('❌ employee onboarding error:', error);
    return res.status(500).json({
      ok: false,
      code: 'EMPLOYEE_ONBOARDING_FAILED',
      message: 'ไม่สามารถสร้างบัญชีพนักงานได้ กรุณาลองใหม่อีกครั้ง',
    });
  }
};

module.exports = {
  addSubEmployee,
  canCreateEmployee,
};
