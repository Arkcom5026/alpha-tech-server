const { projectEmployeeStatus } = require('../utils/employeeStatus');

const mapEmployeeSummary = (employee) => ({
  id: employee.id,
  userId: employee.userId,
  name: employee.name,
  phone: employee.phone,
  branchId: employee.branchId,
  positionId: employee.positionId,
  status: projectEmployeeStatus(employee),
  role: employee.user?.role ?? null,
  position: employee.position ?? null,
  branch: employee.branch ?? null,
});

module.exports = {
  mapEmployeeSummary,
};
