const {
  findExistingUserAndPosition,
  hashPassword,
  createOnboardedEmployee,
} = require('./onboardEmployeeRepository');
const { toPositiveInt } = require('../shared/employeeUtils');
const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../authorization/employeePositionAuthority');

const normalize = (value) => String(value || '').trim();
const normalizeEmail = (value) => normalize(value).toLowerCase();
const normalizeUpper = (value) => normalize(value).toUpperCase();

const canCreateEmployee = (actor = {}) => (
  hasCapability(actor, POSITION_CAPABILITIES.EMPLOYEE_MANAGE)
);

const onboardEmployee = async ({ actor = {}, input = {} }) => {
  if (!canCreateEmployee(actor)) {
    return {
      status: 403,
      body: {
        code: 'EMPLOYEE_ONBOARDING_FORBIDDEN',
        message: 'เฉพาะผู้ที่ได้รับสิทธิ์จัดการพนักงานเท่านั้นที่เพิ่มพนักงานใหม่ได้',
      },
    };
  }

  const branchId = toPositiveInt(actor.branchId || actor.employeeProfile?.branchId);
  if (!branchId) {
    return {
      status: 403,
      body: {
        code: 'EMPLOYEE_ONBOARDING_BRANCH_REQUIRED',
        message: 'บัญชีผู้สร้างพนักงานไม่ได้ผูกกับสาขาที่ใช้งาน',
      },
    };
  }

  const name = normalize(input.name);
  const email = normalizeEmail(input.email);
  const password = normalize(input.password);
  const phone = normalize(input.phone) || null;
  const v2Role = normalizeUpper(input.v2Role);
  const positionId = toPositiveInt(input.positionId);

  if (!name || !email || !password || !v2Role || !positionId) {
    return {
      status: 400,
      body: {
        code: 'EMPLOYEE_ONBOARDING_FIELDS_REQUIRED',
        message: 'กรุณากรอกชื่อ อีเมล รหัสผ่าน บทบาทในร้าน และตำแหน่งงานให้ครบถ้วน',
      },
    };
  }

  if (password.length < 6) {
    return {
      status: 400,
      body: {
        code: 'EMPLOYEE_PASSWORD_TOO_SHORT',
        message: 'รหัสผ่านเริ่มต้นต้องมีความยาวอย่างน้อย 6 ตัวอักษร',
      },
    };
  }

  if (!['MANAGER', 'CASHIER'].includes(v2Role)) {
    return {
      status: 400,
      body: {
        code: 'EMPLOYEE_STORE_ROLE_INVALID',
        message: 'บทบาทในร้านต้องเป็น MANAGER หรือ CASHIER',
      },
    };
  }

  const [existingUser, position] = await findExistingUserAndPosition({ email, positionId });
  if (existingUser) {
    return {
      status: 409,
      body: {
        code: 'EMPLOYEE_EMAIL_ALREADY_EXISTS',
        message: 'อีเมลนี้ถูกลงทะเบียนใช้งานในระบบแล้ว',
      },
    };
  }

  if (!position) {
    return {
      status: 400,
      body: {
        code: 'EMPLOYEE_POSITION_NOT_FOUND',
        message: 'ไม่พบตำแหน่งงานที่เลือก กรุณาโหลดรายการตำแหน่งใหม่',
      },
    };
  }

  const passwordHash = await hashPassword(password);
  const created = await createOnboardedEmployee({
    email,
    passwordHash,
    branchId,
    positionId,
    name,
    phone,
    v2Role,
  });

  return {
    status: 201,
    body: {
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
    },
  };
};

module.exports = { onboardEmployee, canCreateEmployee };
