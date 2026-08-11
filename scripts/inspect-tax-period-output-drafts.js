const { prisma } = require('../src/lib/prisma');
const {
  isSaleTaxDocumentEligible,
} = require('../src/modules/tax/sources/sale/saleTaxDocumentEligibilityPolicy');

const parseBranchId = (value) => {
  const branchId = Number(value);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    throw new Error('branchId must be a positive integer');
  }
  return branchId;
};

const classifyIssuanceAuthority = ({ document, sale }) => {
  if (document.outputVatRecord) return 'STOP_OUTPUT_VAT_AUTHORITY_EXISTS';
  if (document.issuerProfileId || document.issuedDocumentNumber || document.taxInvoiceKind) {
    return 'STOP_DRAFT_HAS_ISSUANCE_METADATA';
  }
  if (document.candidate?.sourceType !== 'SALE') return 'STOP_NON_SALE_SOURCE';
  if (!sale) return 'STOP_SALE_NOT_FOUND';
  if (!isSaleTaxDocumentEligible(sale)) return 'STOP_SALE_PAYMENT_REQUIRED';
  return 'READY_FOR_ISSUANCE_REVIEW';
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
      issuerProfileId: true,
      issuedDocumentNumber: true,
      taxInvoiceKind: true,
      outputVatRecord: {
        select: {
          id: true,
          issuedDocumentNumber: true,
          taxPeriodId: true,
        },
      },
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

  const saleIds = [...new Set(
    documents
      .filter((document) => document.candidate?.sourceType === 'SALE')
      .map((document) => Number(document.candidate?.sourceId))
      .filter((id) => Number.isInteger(id) && id > 0),
  )];

  const sales = saleIds.length
    ? await prisma.sale.findMany({
        where: {
          branchId,
          id: { in: saleIds },
        },
        select: {
          id: true,
          status: true,
          statusPayment: true,
        },
      })
    : [];
  const saleById = new Map(sales.map((sale) => [Number(sale.id), sale]));

  const inspectionRows = documents.map((document) => {
    const saleId = Number(document.candidate?.sourceId);
    const sale = Number.isInteger(saleId) ? saleById.get(saleId) || null : null;
    return {
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
      saleStatus: sale?.status ?? null,
      salePaymentStatus: sale?.statusPayment ?? null,
      existingOutputVatAuthority: Boolean(document.outputVatRecord),
      issuanceMetadataPresent: Boolean(
        document.issuerProfileId || document.issuedDocumentNumber || document.taxInvoiceKind
      ),
      issuanceAuthority: classifyIssuanceAuthority({ document, sale }),
    };
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
  console.table(inspectionRows);

  const authoritySummary = inspectionRows.reduce((summary, row) => {
    summary[row.issuanceAuthority] = (summary[row.issuanceAuthority] || 0) + 1;
    return summary;
  }, {});

  console.log('\n=== ISSUANCE AUTHORITY SUMMARY ===');
  console.log(authoritySummary);
  console.log('\nREADY_FOR_ISSUANCE_REVIEW means the backend sale-payment authority passes; it does not choose SHORT/FULL or issue a tax number.');
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
