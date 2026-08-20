const { prisma, Prisma } = require('../../../../../lib/prisma');
const { measurePerformance } = require('../../../../../lib/performanceTiming');

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

const findBarcodeAuthorityExact = async ({ branchId, query }) => measurePerformance(
  'sales.items.search.repo.barcodeAuthorityExact',
  () => prisma.barcodeReceiptItem.findFirst({
    where: {
      branchId,
      barcode: { equals: query, mode: 'insensitive' },
      status: { not: 'VOID' },
    },
    include: {
      stockItem: { include: inventoryInclude(branchId) },
      simpleLot: { include: inventoryInclude(branchId) },
    },
  }),
);

const findExactStockItems = async ({ branchId, query, take = 20 }) => measurePerformance(
  'sales.items.search.repo.exactStockItems',
  () => prisma.stockItem.findMany({
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
  }),
);

const findExactSimpleLots = async ({ branchId, query, take = 20 }) => measurePerformance(
  'sales.items.search.repo.exactSimpleLots',
  () => prisma.simpleLot.findMany({
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
  }),
);

const findTextStockItems = async ({ branchId, terms, take = 40 }) => measurePerformance(
  'sales.items.search.repo.textStockItems',
  () => prisma.stockItem.findMany({
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
  }),
);

const findTextSimpleLots = async ({ branchId, terms, take = 40 }) => measurePerformance(
  'sales.items.search.repo.textSimpleLots',
  () => prisma.simpleLot.findMany({
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
  }),
);

const findProductAvailability = async ({ branchId, productIds }) => {
  const normalizedIds = [...new Set((productIds || [])
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0))];
  if (!normalizedIds.length) return [];

  return measurePerformance('sales.items.search.repo.productAvailability', () => prisma.$queryRaw(Prisma.sql`
    WITH requested_products AS (
      SELECT UNNEST(ARRAY[${Prisma.join(normalizedIds)}]::INTEGER[]) AS "productId"
    ),
    physical_inventory AS (
      SELECT inventory."productId", SUM(inventory.quantity)::INTEGER AS quantity
      FROM (
        SELECT "productId", COUNT(*)::INTEGER AS quantity
        FROM "StockItem"
        WHERE "branchId" = ${branchId}
          AND status = 'IN_STOCK'
          AND "productId" IN (${Prisma.join(normalizedIds)})
        GROUP BY "productId"

        UNION ALL

        SELECT "productId", SUM("qtyRemaining")::INTEGER AS quantity
        FROM "SimpleLot"
        WHERE "branchId" = ${branchId}
          AND status = 'ACTIVE'
          AND "qtyRemaining" > 0
          AND "productId" IN (${Prisma.join(normalizedIds)})
        GROUP BY "productId"
      ) inventory
      GROUP BY inventory."productId"
    )
    SELECT requested."productId",
           COALESCE(balance."quantity", physical.quantity, 0)::INTEGER AS quantity,
           COALESCE(balance."reserved", 0)::INTEGER AS reserved,
           GREATEST(
             COALESCE(balance."quantity", physical.quantity, 0)
             - COALESCE(balance."reserved", 0),
             0
           )::INTEGER AS "availableToSell",
           (balance."productId" IS NULL) AS "balanceMissing"
    FROM requested_products requested
    LEFT JOIN "StockBalance" balance
      ON balance."branchId" = ${branchId}
     AND balance."productId" = requested."productId"
    LEFT JOIN physical_inventory physical
      ON physical."productId" = requested."productId"
  `));
};

module.exports = {
  findBarcodeAuthorityExact,
  findExactStockItems,
  findExactSimpleLots,
  findTextStockItems,
  findTextSimpleLots,
  findProductAvailability,
};
