const prismaModule = require('../../../../../lib/prisma');

const prisma = prismaModule?.prisma || prismaModule;

const productInclude = (branchId) => ({
  branchPrice: {
    where: { branchId, isActive: true },
    take: 1,
  },
  brand: true,
  productType: true,
});

const findExactStockItems = async ({ branchId, query, take = 20 }) => prisma.stockItem.findMany({
  where: {
    branchId,
    OR: [
      { barcode: { equals: query, mode: 'insensitive' } },
      { serialNumber: { equals: query, mode: 'insensitive' } },
      { product: { saleBarcode: { equals: query, mode: 'insensitive' } } },
    ],
  },
  include: { product: { include: productInclude(branchId) } },
  orderBy: [{ status: 'asc' }, { id: 'asc' }],
  take,
});

const findExactSimpleLots = async ({ branchId, query, take = 20 }) => prisma.simpleLot.findMany({
  where: {
    branchId,
    OR: [
      { barcode: { equals: query, mode: 'insensitive' } },
      { product: { saleBarcode: { equals: query, mode: 'insensitive' } } },
    ],
  },
  include: { product: { include: productInclude(branchId) } },
  orderBy: [{ status: 'asc' }, { receivedAt: 'asc' }, { id: 'asc' }],
  take,
});

const findTextStockItems = async ({ branchId, terms, take = 40 }) => prisma.stockItem.findMany({
  where: {
    branchId,
    status: 'IN_STOCK',
    product: {
      active: true,
      AND: terms.map((term) => ({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { saleBarcode: { contains: term, mode: 'insensitive' } },
          { codeType: { contains: term, mode: 'insensitive' } },
          { brand: { name: { contains: term, mode: 'insensitive' } } },
          { productType: { name: { contains: term, mode: 'insensitive' } } },
        ],
      })),
    },
  },
  include: { product: { include: productInclude(branchId) } },
  orderBy: [{ productId: 'asc' }, { id: 'asc' }],
  take,
});

const findTextSimpleLots = async ({ branchId, terms, take = 40 }) => prisma.simpleLot.findMany({
  where: {
    branchId,
    status: 'ACTIVE',
    qtyRemaining: { gt: 0 },
    product: {
      active: true,
      mode: 'SIMPLE',
      AND: terms.map((term) => ({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { saleBarcode: { contains: term, mode: 'insensitive' } },
          { codeType: { contains: term, mode: 'insensitive' } },
          { brand: { name: { contains: term, mode: 'insensitive' } } },
          { productType: { name: { contains: term, mode: 'insensitive' } } },
        ],
      })),
    },
  },
  include: { product: { include: productInclude(branchId) } },
  orderBy: [{ productId: 'asc' }, { receivedAt: 'asc' }, { id: 'asc' }],
  take,
});

module.exports = {
  findExactStockItems,
  findExactSimpleLots,
  findTextStockItems,
  findTextSimpleLots,
};
