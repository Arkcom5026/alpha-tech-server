const { prisma, Prisma } = require('../../../../../lib/prisma');

const productInclude = (branchId) => ({
  branchPrice: {
    where: { branchId, isActive: true },
    take: 1,
  },
  brand: true,
  productType: true,
  productImages: {
    where: { active: true },
    orderBy: [{ isCover: 'desc' }, { id: 'asc' }],
    take: 1,
  },
});

const inventoryInclude = (branchId) => ({
  product: { include: productInclude(branchId) },
});

const findBarcodeAuthorityExact = async ({ branchId, query }) => prisma.barcodeReceiptItem.findFirst({
  where: {
    branchId,
    barcode: { equals: query, mode: 'insensitive' },
    status: { not: 'VOID' },
  },
  include: {
    stockItem: { include: inventoryInclude(branchId) },
    simpleLot: { include: inventoryInclude(branchId) },
  },
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
  include: inventoryInclude(branchId),
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
  include: inventoryInclude(branchId),
  orderBy: [{ status: 'asc' }, { receivedAt: 'asc' }, { id: 'asc' }],
  take,
});

const findTextStockItems = async ({ branchId, terms, take = 40 }) => prisma.stockItem.findMany({
  where: {
    branchId,
    status: 'IN_STOCK',
    product: {
      active: true,
      inventoryBehavior: 'TRACKED',
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
  include: inventoryInclude(branchId),
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
      inventoryBehavior: 'TRACKED',
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
  include: inventoryInclude(branchId),
  orderBy: [{ productId: 'asc' }, { receivedAt: 'asc' }, { id: 'asc' }],
  take,
});

const findProductAvailability = async ({ branchId, productIds }) => {
  const normalizedIds = [...new Set((productIds || [])
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0))];
  if (!normalizedIds.length) return [];

  return prisma.$queryRaw(Prisma.sql`
    SELECT "productId", "quantity", "reserved",
           GREATEST("quantity" - "reserved", 0)::INTEGER AS "availableToSell"
    FROM "StockBalance"
    WHERE "branchId" = ${branchId}
      AND "productId" IN (${Prisma.join(normalizedIds)})
  `);
};

module.exports = {
  findBarcodeAuthorityExact,
  findExactStockItems,
  findExactSimpleLots,
  findTextStockItems,
  findTextSimpleLots,
  findProductAvailability,
};
