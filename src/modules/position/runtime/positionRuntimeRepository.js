const { prisma, Prisma } = require('../../../../lib/prisma');

const findNameConflict = ({ branchId, name, excludeId = null }) =>
  prisma.position.findFirst({
    where: {
      branchId,
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });

const listPositions = ({ where, skip, take }) =>
  Promise.all([
    prisma.position.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { id: 'asc' }],
      skip,
      take,
    }),
    prisma.position.count({ where }),
  ]);

const listDropdowns = ({ where }) =>
  prisma.position.findMany({
    select: { id: true, name: true, capabilities: true },
    where,
    orderBy: { name: 'asc' },
  });

const findByIdForBranch = ({ id, branchId, select }) =>
  prisma.position.findFirst({
    where: { id, branchId },
    ...(select ? { select } : {}),
  });

const createPosition = (data) => prisma.position.create({ data });
const updatePosition = ({ id, data }) => prisma.position.update({ where: { id }, data });
const deletePosition = (id) => prisma.position.delete({ where: { id } });

const countEmployeesUsingPosition = ({ branchId, positionId }) =>
  prisma.employeeProfile.count({ where: { branchId, positionId } });

const isUniqueConstraintError = (error) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const isForeignKeyConstraintError = (error) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';

module.exports = {
  findNameConflict,
  listPositions,
  listDropdowns,
  findByIdForBranch,
  createPosition,
  updatePosition,
  deletePosition,
  countEmployeesUsingPosition,
  isUniqueConstraintError,
  isForeignKeyConstraintError,
};
