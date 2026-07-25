const { createEmployee } = require('./createEmployeeRepository');
const { employeeProjection } = require('../shared/employeeMapper');
const { isStaffRole, resolveManagedBranchId, toInt } = require('../shared/employeeUtils');

const createEmployeeService = async ({ actor, payload }) => {
  if (!isStaffRole(actor.role) && !actor.isSuperAdmin) {
    const error = new Error('FORBIDDEN_ROLE');
    error.statusCode = 403;
    throw error;
  }

  const userId = toInt(payload?.userId);
  const positionId = toInt(payload?.positionId);
  const branchId = resolveManagedBranchId(actor, payload?.branchId);
  const name = String(payload?.name || '').trim();
  const phone = payload?.phone ? String(payload.phone).trim() : null;

  if (!userId || !positionId || !branchId || !name) {
    const error = new Error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
    error.statusCode = 400;
    throw error;
  }

  return employeeProjection(await createEmployee({ userId, name, phone, branchId, positionId }));
};

module.exports = { createEmployeeService };
