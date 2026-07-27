const { prisma } = require('../../../../../../lib/prisma');

const findAuditOverview = ({ sessionId, client = prisma }) =>
  client.stockAuditSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      branchId: true,
      employeeId: true,
      status: true,
      mode: true,
      expectedCount: true,
      scannedCount: true,
      startedAt: true,
      confirmedAt: true,
    },
  });

module.exports = { findAuditOverview };
