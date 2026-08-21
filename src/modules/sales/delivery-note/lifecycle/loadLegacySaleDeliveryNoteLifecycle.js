'use strict';

const {
  resolveLegacySaleBackedDeliveryNote,
} = require('./deliveryNoteLifecycleDomain');

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const positiveInt = (value, code, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail(code, `${field} must be a positive integer`);
  return parsed;
};

const findIssuedTaxAuthority = async (prisma, { branchId, saleId }) => {
  const directSaleTax = await prisma.taxCandidate.findFirst({
    where: {
      branchId,
      sourceType: 'SALE',
      sourceId: String(saleId),
      document: {
        is: {
          documentType: 'OUTPUT_TAX_INVOICE',
          status: 'REGISTERED',
          issuedDocumentNumber: { not: null },
        },
      },
    },
    select: {
      document: { select: { id: true, issuedDocumentNumber: true, taxInvoiceKind: true } },
    },
  });
  if (directSaleTax?.document) {
    return Object.freeze({ sourceType: 'SALE', document: directSaleTax.document });
  }

  const preparation = await prisma.saleDocumentPreparation.findUnique({
    where: {
      branchId_sourceType_sourceId: {
        branchId,
        sourceType: 'SALE',
        sourceId: String(saleId),
      },
    },
    select: { id: true },
  });
  if (!preparation) return null;

  const preparedTax = await prisma.taxCandidate.findFirst({
    where: {
      branchId,
      sourceType: 'DOCUMENT_PREPARATION',
      sourceId: { startsWith: `${preparation.id}:` },
      document: {
        is: {
          documentType: 'OUTPUT_TAX_INVOICE',
          status: 'REGISTERED',
          issuedDocumentNumber: { not: null },
        },
      },
    },
    select: {
      sourceId: true,
      document: { select: { id: true, issuedDocumentNumber: true, taxInvoiceKind: true } },
    },
  });
  return preparedTax?.document
    ? Object.freeze({ sourceType: 'DOCUMENT_PREPARATION', sourceId: preparedTax.sourceId, document: preparedTax.document })
    : null;
};

const loadLegacySaleDeliveryNoteLifecycle = async ({ prisma, branchId, saleId }) => {
  if (!prisma) fail('DELIVERY_NOTE_LIFECYCLE_PRISMA_REQUIRED', 'prisma is required');
  const normalizedBranchId = positiveInt(branchId, 'DELIVERY_NOTE_BRANCH_REQUIRED', 'branchId');
  const normalizedSaleId = positiveInt(saleId, 'DELIVERY_NOTE_SALE_REQUIRED', 'saleId');

  const sale = await prisma.sale.findFirst({
    where: { id: normalizedSaleId, branchId: normalizedBranchId },
    select: {
      id: true,
      code: true,
      officialDocumentNumber: true,
      status: true,
      totalAmount: true,
      items: {
        select: { id: true, price: true, returnedQuantity: true },
      },
      simpleItems: {
        select: { id: true, quantity: true, price: true, returnedQuantity: true },
      },
    },
  });
  if (!sale) fail('DELIVERY_NOTE_SOURCE_NOT_FOUND', 'Sale-backed Delivery Note source was not found', 404);
  if (!sale.officialDocumentNumber) {
    fail('DELIVERY_NOTE_NOT_ISSUED', 'Sale has no issued Delivery Note authority', 409);
  }

  const [activeConsolidation, issuedTaxAuthority] = await Promise.all([
    prisma.consolidatedDeliveryLine.findFirst({
      where: {
        branchId: normalizedBranchId,
        sourceSaleId: normalizedSaleId,
        status: 'DOCUMENTED',
        combinedBilling: { is: { status: { not: 'CANCELLED' } } },
      },
      select: { combinedBillingId: true },
    }),
    findIssuedTaxAuthority(prisma, {
      branchId: normalizedBranchId,
      saleId: normalizedSaleId,
    }),
  ]);

  const projection = resolveLegacySaleBackedDeliveryNote({
    sale,
    // Financial-lock SaleDocumentReplacement is intentionally not treated as
    // Delivery Note successor authority. A first-class revision relation will
    // supply this fact in the persistence wave.
    hasSuccessor: false,
    hasActiveConsolidation: Boolean(activeConsolidation),
    taxIssued: Boolean(issuedTaxAuthority),
  });

  return Object.freeze({
    ...projection,
    sourceSaleCode: sale.code,
    activeConsolidation: activeConsolidation
      ? Object.freeze({ combinedBillingId: Number(activeConsolidation.combinedBillingId) })
      : null,
    issuedTaxAuthority,
    compatibility: Object.freeze({
      legacySaleBacked: true,
      successorPersistenceAvailable: false,
      financialLockReplacementIsLifecycleSuccessor: false,
    }),
  });
};

module.exports = Object.freeze({
  findIssuedTaxAuthority,
  loadLegacySaleDeliveryNoteLifecycle,
});
