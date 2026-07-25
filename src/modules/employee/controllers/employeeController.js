// @filename: src/modules/employee/controllers/employeeController.js
// Employee HTTP boundary.

const employeeService = require('../services/employeeService');

const failureResponses = Object.freeze({
  EMPLOYEE_CREATE_FORBIDDEN: {
    status: 403,
    message: 'เฉพาะเจ้าของร้าน ผู้ดูแลระบบ หรือผู้จัดการร้านเท่านั้นที่เพิ่มพนักงานใหม่ได้',
  },
  EMPLOYEE_BRANCH_REQUIRED: {
    status: 403,
    message: 'บัญชีผู้สร้างพนักงานไม่ได้ผูกกับสาขาที่ใช้งาน',
  },
  EMPLOYEE_FIELDS_REQUIRED: {
    status: 400,
    message: 'กรุณากรอกชื่อ อีเมล รหัสผ่าน และตำแหน่งงานให้ครบถ้วน',
  },
  EMPLOYEE_PASSWORD_TOO_SHORT: {
    status: 400,
    message: 'รหัสผ่านเริ่มต้นต้องมีความยาวอย่างน้อย 6 ตัวอักษร',
  },
  EMPLOYEE_EMAIL_ALREADY_EXISTS: {
    status: 409,
    message: 'อีเมลนี้ถูกลงทะเบียนใช้งานในระบบแล้ว',
  },
  EMPLOYEE_POSITION_NOT_FOUND: {
    status: 400,
    message: 'ไม่พบตำแหน่งงานของสาขาที่เลือก กรุณาโหลดรายการตำแหน่งใหม่',
  },
});

const addEmployee = async (req, res) => {
  try {
    const created = await employeeService.createEmployee({
      actor: req.user || {},
      input: req.body || {},
    });

    return res.status(201).json({
      ok: true,
      message: `สร้างบัญชีพนักงาน "${created.employeeProfile.name}" สำเร็จและพร้อมใช้งานทันที`,
      data: {
        userId: created.user.id,
        employeeId: created.employeeProfile.id,
        name: created.employeeProfile.name,
        email: created.user.email,
        phone: created.employeeProfile.phone,
        role: created.user.role,
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
    const failure = failureResponses[error.code] || {
      status: 500,
      message: 'ไม่สามารถสร้างบัญชีพนักงานได้ กรุณาลองใหม่อีกครั้ง',
    };

    console.error('❌ employee creation error:', error);

    return res.status(failure.status).json({
      ok: false,
      code: error.code || 'EMPLOYEE_CREATE_FAILED',
      message: failure.message,
    });
  }
};

module.exports = {
  addEmployee,
};
