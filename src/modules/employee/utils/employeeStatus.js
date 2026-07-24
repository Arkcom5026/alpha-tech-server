const projectEmployeeStatus = (employee) => {
  if (!employee?.approved) return 'pending';
  return employee.active ? 'active' : 'inactive';
};

module.exports = {
  projectEmployeeStatus,
};
