const projectEmployeeStatus = (employee) => {
  if (!employee?.approved) return 'pending';
  return employee.active ? 'active' : 'inactive';
};

const employeeProjection = (employee) => ({
  id: employee.id,
  userId: employee.userId,
  name: employee.name,
  phone: employee.phone,
  positionId: employee.positionId,
  branchId: employee.branchId,
  approved: employee.approved,
  active: employee.active,
  status: projectEmployeeStatus(employee),
  role: employee.user?.role ?? null,
  email: employee.user?.email ?? null,
  user: employee.user,
  position: employee.position,
  branch: employee.branch,
});

module.exports = { projectEmployeeStatus, employeeProjection };
