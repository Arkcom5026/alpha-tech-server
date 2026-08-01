const { prisma, Prisma } = require('../../../../lib/prisma');

const isKnownRequestError = (error, code) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

const countCategories = (where) => prisma.category.count({ where });

const listCategories = ({ where, page, limit }) =>
  prisma.category.findMany({
    where,
    orderBy: { name: 'asc' },
    skip: (page - 1) * limit,
    take: limit,
  });

const findCategoryById = (id, select) =>
  prisma.category.findUnique({
    where: { id },
    ...(select ? { select } : {}),
  });

const createCategory = (data) => prisma.category.create({ data });

const updateCategory = (id, data) => prisma.category.update({ where: { id }, data });

const findGlobalProductTypeReference = (categoryId) =>
  prisma.globalProductType.findFirst({
    where: { categoryId },
    select: { id: true, name: true },
  });

const listCategoryDropdowns = () =>
  prisma.category.findMany({
    where: { active: true },
    select: { id: true, name: true, active: true, isSystem: true },
    orderBy: { name: 'asc' },
  });

module.exports = {
  isKnownRequestError,
  countCategories,
  listCategories,
  findCategoryById,
  createCategory,
  updateCategory,
  findGlobalProductTypeReference,
  listCategoryDropdowns,
};
