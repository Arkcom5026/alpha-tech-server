const { prisma } = require('../../../../../lib/prisma');

const findAuditSession = async ({ sessionId, client = prisma }) => client.stockAuditSession.findUnique({
  where: { id: sessionId },
  select: { id: true, branchId: true, status: true, mode: true, confirmedAt: true },
});

const cancelAuditSession = async ({ sessionId, confirmedAt = new Date(), client = prisma }) => client.stockAuditSession.update({
  where: { id: sessionId },
  data: { confirmedAt },
});

const confirmAuditSession = async ({ sessionId, targetStatus, confirmedAt = new Date(), client = prisma }) => client.$transaction(async (tx) => {
  const missing = await tx.stockAuditSnapshotItem.findMany({
    where: { auditSessionId: sessionId, isScanned: false },
    select: { stockItemId: true },
  });

  if (missing.length > 0) {
    await tx.stockItem.updateMany({
      where: { id: { in: missing.map((item) => item.stockItemId) } },
      data: { status: targetStatus },
    });
  }

  await tx.stockAuditSession.update({
    where: { id: sessionId },
    data: { confirmedAt },
  });

  return { missingCount: missing.length };
});

module.exports = {
  findAuditSession,
  cancelAuditSession,
  confirmAuditSession,
};
