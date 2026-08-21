const prisma = require('../../../database/prisma/client');
const {
  resolveActorCapabilities,
} = require('../../employee/authorization/employeePositionAuthority');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');

const REPAIR_CAPABILITY = Object.freeze({
  READ: 'repair.read',
  INTAKE: 'repair.intake',
  WORKFLOW: 'repair.workflow',
  PARTS: 'repair.parts',
  ESTIMATE: 'repair.estimate',
  CLAIM: 'repair.claim',
  HANDOVER: 'repair.handover',
  CUSTOMER_ACCESS: 'repair.customer-access',
});

const ALL_REPAIR_CAPABILITIES = Object.freeze(Object.values(REPAIR_CAPABILITY));
const REPAIR_CAPABILITY_SET = new Set(ALL_REPAIR_CAPABILITIES);

// Legacy matrix is retained only for compatibility verification while old positions
// still have Position.capabilities = NULL. Runtime authority now resolves through
// employeePositionAuthority so migrated positions override v2Role completely.
const REPAIR_CAPABILITIES_BY_ROLE = Object.freeze({
  OWNER: ALL_REPAIR_CAPABILITIES,
  MANAGER: ALL_REPAIR_CAPABILITIES,
  CASHIER: Object.freeze([
    REPAIR_CAPABILITY.READ,
    REPAIR_CAPABILITY.INTAKE,
    REPAIR_CAPABILITY.ESTIMATE,
    REPAIR_CAPABILITY.CLAIM,
    REPAIR_CAPABILITY.CUSTOMER_ACCESS,
  ]),
  TECHNICIAN: Object.freeze([
    REPAIR_CAPABILITY.READ,
    REPAIR_CAPABILITY.WORKFLOW,
    REPAIR_CAPABILITY.PARTS,
  ]),
});

const normalizeRole = (role) =>
  String(role || '')
    .trim()
    .toUpperCase();

const resolveRepairCapabilities = (role) =>
  [...(REPAIR_CAPABILITIES_BY_ROLE[normalizeRole(role)] || [])];

const resolveRepairCapabilitiesForActor = (actor = {}) => {
  const authority = resolveActorCapabilities(actor);
  return {
    mode: authority.mode,
    capabilities: authority.capabilities.filter((capability) => REPAIR_CAPABILITY_SET.has(capability)),
  };
};

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
        position: {
          select: {
            id: true,
            capabilities: true,
          },
        },
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

    const v2Role = normalizeRole(employee.v2Role);
    const positionCapabilities = Array.isArray(employee.position?.capabilities)
      ? employee.position.capabilities
      : null;
    const repairAuthority = resolveRepairCapabilitiesForActor({
      ...req.user,
      employeeRole: v2Role,
      v2Role,
      positionCapabilities,
    });

    req.user = {
      ...req.user,
      employeeId: employee.id,
      branchId: employee.branchId,
      employeeRole: v2Role,
      v2Role,
      positionId: employee.position?.id || req.user?.positionId || null,
      positionCapabilities,
      positionAuthorityMode: repairAuthority.mode,
      repairCapabilities: repairAuthority.capabilities,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

const allowRepairCapabilities = (...capabilities) => {
  const requiredCapabilities = new Set(capabilities);

  return (req, res, next) => {
    const actualCapabilities = new Set(req.user?.repairCapabilities || []);
    const missingCapabilities = [...requiredCapabilities].filter(
      (capability) => !actualCapabilities.has(capability)
    );

    if (missingCapabilities.length) {
      return next(
        new RepairError(
          RepairFailureCode.FORBIDDEN,
          'คุณไม่มีสิทธิ์สำหรับการดำเนินการนี้',
          403,
          {
            requiredCapabilities: [...requiredCapabilities],
            missingCapabilities,
            actualCapabilities: [...actualCapabilities],
            authorityMode: req.user?.positionAuthorityMode || null,
            actualRole: normalizeRole(req.user?.v2Role) || null,
          }
        )
      );
    }

    return next();
  };
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
  ALL_REPAIR_CAPABILITIES,
  REPAIR_CAPABILITY,
  REPAIR_CAPABILITIES_BY_ROLE,
  allowRepairCapabilities,
  allowRepairRoles,
  loadRepairEmployeeContext,
  normalizeRole,
  resolveRepairCapabilities,
  resolveRepairCapabilitiesForActor,
};
