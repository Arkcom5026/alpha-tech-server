const { prisma } = require('../../../../lib/prisma');

const listEmployees = ({ where, skip, take }) => Promise.all([
  prisma.employeeProfile.findMany({
    where,
    include: { user: true, position: true, branch: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    skip,
    take,
  }),
  prisma.employeeProfile.count({ where }),
]);

module.exports = { listEmployees };
