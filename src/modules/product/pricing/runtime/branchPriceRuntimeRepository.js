const { prisma, Prisma } = require('../../../../../lib/prisma');

const D = (value) => (
  value instanceof Prisma.Decimal
    ? value
    : new Prisma.Decimal(value ?? 0)
);

const productSelect = {
  id: true,
  name: true,
  mode: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  templateProductId: true,
  productType: {
    select: {
      id: true,
      name: true,
      globalProductType: {
        select: {
          categoryId: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  },
  brand: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true } },
  templateProduct: { select: { id: true, name: true } },
};

const findActiveBranchPrice = ({ branchId, productId, now }) => prisma.branchPrice.findFirst({
  where: {
    branchId,
    productId,
    isActive: true,
    AND: [
      { OR: [{ effectiveDate: null }, { effectiveDate: { lte: now } }] },
      { OR: [{ expiredDate: null }, { expiredDate: { gte: now } }] },
    ],
  },
  orderBy: [{ effectiveDate: 'desc' }, { updatedAt: 'desc' }],
});

const upsertBranchPrice = ({ productId, branchId, employeeId, pricePatch, createData }) => (
  prisma.branchPrice.upsert({
    where: { productId_branchId: { productId, branchId } },
    update: { ...pricePatch, updatedBy: employeeId },
    create: { ...createData, productId, branchId, updatedBy: employeeId },
  })
);

const findProducts = ({ where, orderBy, skip, take }) => prisma.product.findMany({
  where,
  orderBy,
  select: productSelect,
  ...(skip !== undefined && take !== undefined ? { skip, take } : {}),
});

const countProducts = (where) => prisma.product.count({ where });

const findBranchPrices = ({ branchId, productIds }) => (
  productIds.length
    ? prisma.branchPrice.findMany({ where: { branchId, productId: { in: productIds } } })
    : Promise.resolve([])
);

const bulkUpsertBranchPrices = async ({ operations }) => {
  await prisma.$transaction(operations, { timeout: 30000 });
  return operations.length;
};

const buildUpsertOperation = ({ productId, branchId, employeeId, update, create }) => (
  prisma.branchPrice.upsert({
    where: { productId_branchId: { productId, branchId } },
    update: { ...update, updatedBy: employeeId },
    create: { ...create, productId, branchId, updatedBy: employeeId },
  })
);

module.exports = {
  Prisma,
  D,
  findActiveBranchPrice,
  upsertBranchPrice,
  findProducts,
  countProducts,
  findBranchPrices,
  bulkUpsertBranchPrices,
  buildUpsertOperation,
};
