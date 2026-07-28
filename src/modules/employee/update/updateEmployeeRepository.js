const { prisma } = require('../../../lib/prisma');

const findEmployeeById = (id) => prisma.employeeProfile.findUnique({ where: { id } });

const updateEmployee = ({ id, data }) => prisma.employeeProfile.update({
  where: { id },
  data,
  include: { user: true, position: true, branch: true },
});

module.exports = { findEmployeeById, updateEmployee };
