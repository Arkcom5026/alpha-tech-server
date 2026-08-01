const { prisma } = require('../../../../../lib/prisma');

const CATEGORY_SELECT = {
  id: true,
  name: true,
  active: true,
  isSystem: true,
};

const findMany = ({ where }) =>
  prisma.category.findMany({
    where,
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    select: CATEGORY_SELECT,
  });

const findByName = ({ name, excludeId }) =>
  prisma.category.findFirst({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      name: { equals: name, mode: 'insensitive' },
    },
    select: { id: true },
  });

const findById = ({ id }) =>
  prisma.category.findUnique({
    where: { id },
    select: CATEGORY_SELECT,
  });

const create = ({ name, active }) =>
  prisma.category.create({
    data: { name, active },
    select: CATEGORY_SELECT,
  });

const update = ({ id, data }) =>
  prisma.category.update({
    where: { id },
    data,
    select: CATEGORY_SELECT,
  });

module.exports = {
  findMany,
  findByName,
  findById,
  create,
  update,
};
