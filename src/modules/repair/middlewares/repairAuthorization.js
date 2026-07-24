const prisma = require('../../../database/prisma/client');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');

const normalizeRole = (role) =>
  String(role || '')
    .trim()
    .toUpperCase();

const loadRepairEmployeeContext = async (req, res, next) => {
  try {
    const employeeId = Number(req.user?.employeeId);
    const tokenBranchId = Number(req.user?.branchId);

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return next(
        new RepairError(
          RepairFailureCode.EMPLOYEE_CONTEXT_REQUIRED,
          'บัญชีผู้ใช้งานนี้ไม่มีข้อมูลพนักงานสำหรับดำเนินการรับซ่อมหรือรับเคลม',
          403
        )
      );
    }

    const employee = await prisma.employeeProfile.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        branchId: true,
        v2Role: true,
        active: true,
        approved: true,
      },
    });

    if (!employee || !employee.active || !employee.approved) {
      return next(
        new RepairError(
          RepairFailureCode.EMPLOYEE_CONTEXT_REQUIRED,
          'สิทธิ์พนักงานยังไม่พร้อมใช้งานหรือถูกระงับ',
          403
        )
      );
    }

    if (
      Number.isInteger(tokenBranchId) &&
      tokenBranchId > 0 &&
      Number(employee.branchId) !== tokenBranchId
    ) {
      return next(
        new RepairError(
          RepairFailureCode.FORBIDDEN,
          'ไม่อนุญาตให้ดำเนินการข้ามสาขา',
          403
        )
      );
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
};

const allowRepairRoles = (...roles) => {
  const allowedRoles = new Set(roles.map(normalizeRole));

  return (req, res, next) => {
    const role = normalizeRole(req.user?.v2Role);

    if (!role || !allowedRoles.has(role)) {
      return next(
        new RepairError(
          RepairFailureCode.FORBIDDEN,
          'คุณไม่มีระดับสิทธิ์เพียงพอสำหรับการดำเนินการนี้',
          403,
          {
            requiredRoles: Array.from(allowedRoles),
            actualRole: role || null,
          }
        )
      );
    }

    return next();
  };
};

module.exports = {
  loadRepairEmployeeContext,
  allowRepairRoles,
};
