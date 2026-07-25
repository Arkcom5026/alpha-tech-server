const { toPrismaRole } = require('../../../shared/employeeUtils');
const { findUsersByRole } = require('./usersByRoleRepository');

const listUsersByRole = async (requestedRole) => {
  const role = toPrismaRole(requestedRole || 'customer') || 'CUSTOMER';
  const users = await findUsersByRole(role);

  return users.map((user) => ({
    ...user,
    name: user.employeeProfile?.name ?? null,
  }));
};

module.exports = { listUsersByRole };
