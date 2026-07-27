const { prisma } = require('../../../../../../lib/prisma');

const findActiveReadyAudit = ({ branchId, client = prisma }) =>
  client.stockAuditSession.findFirst({
    where: {
      branchId,
      mode: 'READY',
      confirmedAt: null,
    },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      expectedCount: true,
      scannedCount: true,
      startedAt: true,
    },
  });

module.exports = { findActiveReadyAudit };
