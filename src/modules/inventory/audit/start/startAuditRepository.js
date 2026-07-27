const { prisma } = require('../../../../../lib/prisma');

const findOpenReadyAudit = async ({ branchId, client = prisma }) => client.stockAuditSession.findFirst({
  where: { branchId, mode: 'READY', confirmedAt: null },
  select: { id: true, expectedCount: true },
});

const listExpectedStockItems = async ({ branchId, client = prisma }) => client.stockItem.findMany({
  where: { branchId, status: 'IN_STOCK' },
  select: { id: true, productId: true, barcode: true },
});

const createReadyAudit = async ({ branchId, employeeId, expected, client = prisma }) => client.$transaction(async (tx) => {
  const session = await tx.stockAuditSession.create({
    data: {
      branchId,
      employeeId,
      mode: 'READY',
      status: 'DRAFT',
      expectedCount: expected.length,
      scannedCount: 0,
      startedAt: new Date(),
    },
  });

  if (expected.length > 0) {
    await tx.stockAuditSnapshotItem.createMany({
      data: expected.map((item) => ({
        auditSessionId: session.id,
        stockItemId: item.id,
        productId: item.productId,
        barcode: item.barcode,
        expectedStatus: 'IN_STOCK',
      })),
      skipDuplicates: true,
    });
  }

  return session;
});

module.exports = {
  findOpenReadyAudit,
  listExpectedStockItems,
  createReadyAudit,
};
