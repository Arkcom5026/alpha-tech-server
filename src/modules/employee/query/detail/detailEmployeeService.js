const { findEmployeeByScope } = require('./detailEmployeeRepository');
const { employeeProjection } = require('../../shared/employeeMapper');
const { isSuperAdmin, toInt } = require('../../shared/employeeUtils');

const getEmployeeProfileById = async ({ actor, employeeId }) => {
  const id = toInt(employeeId);
  if (!id) return { status: 400, body: { message: 'id ไม่ถูกต้อง' } };

  const employee = await findEmployeeByScope({
    id,
    branchId: toInt(actor.branchId) || -1,
    unrestricted: isSuperAdmin(actor),
  });

  if (!employee) {
    return { status: 404, body: { message: 'ไม่พบพนักงานในขอบเขตที่อนุญาต' } };
  }

  return { status: 200, body: employeeProjection(employee) };
};

module.exports = { getEmployeeProfileById };
