const { prisma } = require('../../../../../../lib/prisma');

const findAuditSessionForItems = async ({ sessionId, client = prisma }) => client.stockAuditSession.findUnique({
  where: { id: sessionId },
  select: { id: true, branchId: true, mode: true },
});

const listAuditSnapshotItems = async ({ sessionId, scanned, q, page, pageSize, client = prisma }) => {
  const where = {
    auditSessionId: sessionId,
    ...(scanned === '0' ? { isScanned: false } : {}),
    ...(scanned === '1' ? { isScanned: true } : {}),
    ...(q
      ? {
          OR: [
            { barcode: { contains: q, mode: 'insensitive' } },
            { stockItem: { serialNumber: { contains: q, mode: 'insensitive' } } },
            { product: { name: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    client.stockAuditSnapshotItem.findMany({
      where,
      select: {
        id: true,
        barcode: true,
        isScanned: true,
        scannedAt: true,
        product: { select: { id: true, name: true } },
        stockItem: { select: { serialNumber: true } },
      },
      orderBy: [{ isScanned: 'asc' }, { id: 'asc' }],
      skip,
      take: pageSize,
    }),
    client.stockAuditSnapshotItem.count({ where }),
  ]);

  return { items, total };
};

module.exports = { findAuditSessionForItems, listAuditSnapshotItems };
