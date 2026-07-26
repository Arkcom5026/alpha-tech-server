const prisma = require('../../../database/prisma/client');

function createError(status, code, message, details) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details) error.details = details;
  return error;
}

const normalizeRole = (role) => String(role || '').trim().toUpperCase();

async function loadDeviceIntakeEmployeeContext(req, _res, next) {
  try {
    const employeeId = Number(req.user?.employeeId);
    const tokenBranchId = Number(req.user?.branchId);
    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return next(createError(403, 'DEVICE_INTAKE_EMPLOYEE_CONTEXT_REQUIRED', 'บัญชีนี้ไม่มีข้อมูลพนักงานสำหรับรับอุปกรณ์'));
    }

    const employee = await prisma.employeeProfile.findUnique({
      where: { id: employeeId },
      select: { id: true, branchId: true, v2Role: true, active: true, approved: true },
    });

    if (!employee || !employee.active || !employee.approved || !employee.branchId) {
      return next(createError(403, 'DEVICE_INTAKE_EMPLOYEE_CONTEXT_REQUIRED', 'สิทธิ์พนักงานยังไม่พร้อมใช้งานหรือถูกระงับ'));
    }

    if (Number.isInteger(tokenBranchId) && tokenBranchId > 0 && Number(employee.branchId) !== tokenBranchId) {
      return next(createError(403, 'DEVICE_INTAKE_CROSS_BRANCH_FORBIDDEN', 'ไม่อนุญาตให้รับอุปกรณ์ข้ามสาขา'));
    }

    req.user = {
      ...req.user,
      employeeId: employee.id,
      branchId: employee.branchId,
      v2Role: normalizeRole(employee.v2Role),
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

function allowDeviceIntakeRoles(...roles) {
  const allowed = new Set(roles.map(normalizeRole));
  return (req, _res, next) => {
    const role = normalizeRole(req.user?.v2Role);
    if (!allowed.has(role)) {
      return next(createError(403, 'DEVICE_INTAKE_FORBIDDEN', 'คุณไม่มีสิทธิ์ดำเนินการรับอุปกรณ์', {
        requiredRoles: Array.from(allowed),
        actualRole: role || null,
      }));
    }
    return next();
  };
}

module.exports = {
  loadDeviceIntakeEmployeeContext,
  allowDeviceIntakeRoles,
};
