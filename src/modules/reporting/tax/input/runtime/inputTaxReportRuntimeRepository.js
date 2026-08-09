const { prisma } = require('../../../../../../lib/prisma');

const findInputVatRecords = ({ branchId, startDate, endDate }) =>
  prisma.inputVatRecord.findMany({
    where: {
      branchId,
      documentDate: { gte: startDate, lte: endDate },
      ledgerType: { in: ['INPUT_VAT', 'INPUT_VAT_ADJUSTMENT'] },
    },
    include: {
      branch: { select: { id: true, name: true } },
      taxDocument: { select: { id: true, status: true } },
    },
    orderBy: [{ documentDate: 'asc' }, { documentNumber: 'asc' }],
  });

module.exports = { findInputVatRecords };
