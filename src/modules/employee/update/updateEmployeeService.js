const { findEmployeeById, updateEmployee } = require('./updateEmployeeRepository');
const { employeeProjection } = require('../shared/employeeMapper');
const { isSuperAdmin, toInt } = require('../shared/employeeUtils');

const updateEmployeeService = async ({ actor, employeeId, payload }) => {
  const id = toInt(employeeId);
  if (!id) {
    const error = new Error('id ไม่ถูกต้อง');
    error.statusCode = 400;
    throw error;
  }

  const current = await findEmployeeById(id);
  if (!current) {
    const error = new Error('ไม่พบพนักงาน');
    error.statusCode = 404;
    throw error;
  }

  if (!isSuperAdmin(actor) && toInt(current.branchId) !== toInt(actor.branchId)) {
    const error = new Error('FORBIDDEN_BRANCH');
    error.statusCode = 403;
    throw error;
  }

  const data = {
    name: payload?.name !== undefined ? String(payload.name).trim() : current.name,
    phone: payload?.phone !== undefined ? (payload.phone || null) : current.phone,
    positionId: payload?.positionId !== undefined ? toInt(payload.positionId) : current.positionId,
  };

  return employeeProjection(await updateEmployee({ id, data }));
};

module.exports = { updateEmployeeService };
