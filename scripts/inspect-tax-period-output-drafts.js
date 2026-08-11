const { prisma } = require('../src/lib/prisma');

const parseBranchId = (value) => {
  const branchId = Number(value);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    throw new Error('branchId must be a positive integer');
  }
  return branchId;
};

const main = async () => {
  const [taxPeriodId, branchIdValue] = process.argv.slice(2);
  if (!taxPeriodId || !branchIdValue) {
    throw new Error('Usage: node scripts/inspect-tax-period-output-drafts.js <taxPeriodId> <branchId>');
  }

  const branchId = parseBranchId(branchIdValue);
  const period = await prisma.taxPeriod.findFirst({
    where: { id: taxPeriodId, branchId },
    select: {
      id: true,
      periodCode: true,
      status: true,
      startDate: true,
      endDate: true,
    },
  });

  if (!period) throw new Error('Tax period not found for branch');

  const documents = await prisma.taxDocument.findMany({
    where: {
      branchId,
      documentType: 'OUTPUT_TAX_INVOICE',
      status: 'DRAFT',
      occurredAt: {
        gte: period.startDate,
        lte: period.endDate,
      },
    },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      documentNumber: true,
      occurredAt: true,
      subtotalAmount: true,
      taxAmount: true,
      totalAmount: true,
      candidateId: true,
      candidate: {
        select: {
          sourceType: true,
          sourceId: true,
          sourceDocumentNo: true,
          status: true,
        },
      },
    },
  });

  console.log('\n=== TAX PERIOD ===');
  console.log({
    id: period.id,
    periodCode: period.periodCode,
    status: period.status,
    startDate: period.startDate.toISOString(),
    endDate: period.endDate.toISOString(),
  });

  console.log('\n=== OUTPUT TAX DRAFTS BLOCKING CLOSE ===');
  console.table(
    documents.map((document) => ({
      id: document.id,
      documentNumber: document.documentNumber,
      occurredAt: document.occurredAt.toISOString(),
      subtotalAmount: document.subtotalAmount.toString(),
      taxAmount: document.taxAmount.toString(),
      totalAmount: document.totalAmount.toString(),
      sourceType: document.candidate?.sourceType ?? null,
      sourceId: document.candidate?.sourceId ?? null,
      sourceDocumentNo: document.candidate?.sourceDocumentNo ?? null,
      candidateStatus: document.candidate?.status ?? null,
    })),
  );

  console.log(`\nCOUNT = ${documents.length}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
