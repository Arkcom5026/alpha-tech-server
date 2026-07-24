// @filename: src/modules/employee/controllers/employeeController.js
// Employee HTTP boundary.
// Legacy onboarding controller can migrate here without changing route contracts.

const employeeService = require('../services/employeeService');
const { prisma } = require('../../../../lib/prisma');

const addEmployee = async (req, res) => {
  try {
    const created = await employeeService.createEmployee({
      prisma,
      actor: req.user || {},
      input: req.body || {},
    });

    return res.status(201).json({
      ok: true,
      message: 'สร้างบัญชีพนักงานสำเร็จและพร้อมใช้งานทันที',
      data: {
        userId: created.user.id,
        employeeId: created.employeeProfile.id,
        name: created.employeeProfile.name,
        email: created.user.email,
        phone: created.employeeProfile.phone,
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
    const status = {
      EMPLOYEE_CREATE_FORBIDDEN: 403,
      EMPLOYEE_FIELDS_REQUIRED: 400,
      EMPLOYEE_PASSWORD_TOO_SHORT: 400,
      EMPLOYEE_EMAIL_ALREADY_EXISTS: 409,
      EMPLOYEE_POSITION_NOT_FOUND: 400,
    }[error.code] || 500;

    return res.status(status).json({
      ok: false,
      code: error.code || 'EMPLOYEE_CREATE_FAILED',
      message: 'ไม่สามารถสร้างบัญชีพนักงานได้',
    });
  }
};

module.exports = {
  addEmployee,
};
