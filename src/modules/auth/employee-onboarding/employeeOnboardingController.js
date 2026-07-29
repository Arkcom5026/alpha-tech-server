const { normalize, normalizeEmail } = require('../shared/authNormalization');
const employeeOnboardingService = require('./employeeOnboardingService');

const normalizeUpper = (value) => normalize(value).toUpperCase();
const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const canCreateEmployee = (actor = {}) => {
  const systemRole = normalizeUpper(actor.role);
  const employeeRole = normalizeUpper(actor.employeeRole || actor.v2Role);

  return Boolean(
    actor.isSuperAdmin
    || systemRole === 'SUPERADMIN'
    || systemRole === 'ADMIN'
    || employeeRole === 'OWNER'
    || employeeRole === 'MANAGER'
  );
};

const addSubEmployee = async (req, res) => {
  try {
    const actor = req.user || {};

    if (!canCreateEmployee(actor)) {
      return res.status(403).json({
        code: 'EMPLOYEE_ONBOARDING_FORBIDDEN',
        message: 'เฉพาะเจ้าของร้าน ผู้ดูแลระบบ หรือผู้จัดการร้านเท่านั้นที่เพิ่มพนักงานใหม่ได้',
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
    const v2Role = normalizeUpper(req.body?.v2Role);
    const positionId = toPositiveInt(req.body?.positionId);

    if (!name || !email || !password || !v2Role || !positionId) {
      return res.status(400).json({
        code: 'EMPLOYEE_ONBOARDING_FIELDS_REQUIRED',
        message: 'กรุณากรอกชื่อ อีเมล รหัสผ่าน บทบาทในร้าน และตำแหน่งงานให้ครบถ้วน',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        code: 'EMPLOYEE_PASSWORD_TOO_SHORT',
        message: 'รหัสผ่านเริ่มต้นต้องมีความยาวอย่างน้อย 6 ตัวอักษร',
      });
    }

    if (!['MANAGER', 'CASHIER'].includes(v2Role)) {
      return res.status(400).json({
        code: 'EMPLOYEE_STORE_ROLE_INVALID',
        message: 'บทบาทในร้านต้องเป็น MANAGER หรือ CASHIER',
      });
    }

    const result = await employeeOnboardingService.createEmployee({
      branchId,
      name,
      email,
      password,
      phone,
      v2Role,
      positionId,
    });

    if (result.conflict === 'EMAIL') {
      return res.status(409).json({
        code: 'EMPLOYEE_EMAIL_ALREADY_EXISTS',
        message: 'อีเมลนี้ถูกลงทะเบียนใช้งานในระบบแล้ว',
      });
    }

    if (result.invalid === 'POSITION') {
      return res.status(400).json({
        code: 'EMPLOYEE_POSITION_NOT_FOUND',
        message: 'ไม่พบตำแหน่งงานที่เลือก กรุณาโหลดรายการตำแหน่งใหม่',
      });
    }

    return res.status(201).json(result.response);
  } catch (error) {
    console.error('❌ employee onboarding error:', error);
    return res.status(500).json({
      ok: false,
      code: 'EMPLOYEE_ONBOARDING_FAILED',
      message: 'ไม่สามารถสร้างบัญชีพนักงานได้ กรุณาลองใหม่อีกครั้ง',
    });
  }
};

module.exports = { addSubEmployee };
