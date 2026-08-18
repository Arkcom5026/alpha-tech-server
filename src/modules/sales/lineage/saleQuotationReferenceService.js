'use strict';

const { prisma } = require('../../../../lib/prisma');

const fail = (status, code, message, details) => {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;
  error.code = code;
  if (details) error.details = details;
  throw error;
};

const positiveInt = (value, field) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    fail(400, 'SALE_QUOTATION_REFERENCE_INVALID', `${field} must be a positive integer`);
  }
  return number;
};

const resolveAcceptedQuotationReference = async ({ quotationId, branchId, customerId }, tx = prisma) => {
  const normalizedQuotationId = positiveInt(quotationId, 'quotationId');
  const normalizedBranchId = positiveInt(branchId, 'branchId');
  const normalizedCustomerId = positiveInt(customerId, 'customerId');
  const quotation = await tx.quotation.findFirst({
    where: { id: normalizedQuotationId, branchId: normalizedBranchId },
    select: {
      id: true,
      code: true,
      revisionNumber: true,
      status: true,
      customerId: true,
      issuedAt: true,
      issuedSnapshot: true,
      revisedFromId: true,
    },
  });

  if (!quotation) {
    fail(404, 'SALE_QUOTATION_REFERENCE_NOT_FOUND', 'Quotation revision was not found in this branch');
  }
  if (quotation.customerId !== normalizedCustomerId) {
    fail(409, 'SALE_QUOTATION_REFERENCE_CUSTOMER_MISMATCH', 'Quotation revision belongs to a different customer', {
      quotationId: quotation.id,
      quotationCustomerId: quotation.customerId,
      saleCustomerId: normalizedCustomerId,
    });
  }
  if (quotation.status !== 'ACCEPTED') {
    fail(409, 'SALE_QUOTATION_REFERENCE_NOT_ACCEPTED', 'Only an accepted quotation revision may be referenced by a sale', {
      quotationId: quotation.id,
      status: quotation.status,
    });
  }
  if (!quotation.issuedSnapshot) {
    fail(409, 'SALE_QUOTATION_REFERENCE_SNAPSHOT_REQUIRED', 'Accepted quotation revision is missing its issued snapshot');
  }

  const successor = await tx.quotation.findFirst({
    where: { branchId: normalizedBranchId, revisedFromId: quotation.id },
    select: { id: true, revisionNumber: true, status: true },
  });
  if (successor) {
    fail(409, 'SALE_QUOTATION_REFERENCE_SUPERSEDED', 'This accepted quotation revision has been superseded by a newer revision', {
      quotationId: quotation.id,
      successor,
    });
  }

  return Object.freeze({
    quotationId: quotation.id,
    quotationCode: quotation.code,
    quotationRevision: Number(quotation.revisionNumber || 0),
    quotationIssuedAt: quotation.issuedAt || null,
  });
};

const ensureSaleQuotationReference = async ({ saleId, quotationId, branchId, employeeId }) => {
  if (quotationId == null) return null;
  const normalizedSaleId = positiveInt(saleId, 'saleId');
  const normalizedBranchId = positiveInt(branchId, 'branchId');
  const normalizedEmployeeId = positiveInt(employeeId, 'employeeId');

  const sale = await prisma.sale.findFirst({
    where: { id: normalizedSaleId, branchId: normalizedBranchId },
    select: { id: true, branchId: true, customerId: true },
  });
  if (!sale) fail(404, 'SALE_QUOTATION_REFERENCE_SALE_NOT_FOUND', 'Sale was not found in this branch');

  const reference = await resolveAcceptedQuotationReference({
    quotationId,
    branchId: normalizedBranchId,
    customerId: sale.customerId,
  });

  const existing = await prisma.saleQuotationReference.findFirst({
    where: { saleId: normalizedSaleId },
  });
  if (existing) {
    if (existing.quotationId !== reference.quotationId) {
      fail(409, 'SALE_QUOTATION_REFERENCE_CONFLICT', 'Sale is already linked to a different quotation revision', {
        saleId: normalizedSaleId,
        quotationId: existing.quotationId,
      });
    }
    return existing;
  }

  return prisma.saleQuotationReference.create({
    data: {
      branchId: normalizedBranchId,
      saleId: normalizedSaleId,
      quotationId: reference.quotationId,
      quotationCode: reference.quotationCode,
      quotationRevision: reference.quotationRevision,
      quotationIssuedAt: reference.quotationIssuedAt,
      linkedById: normalizedEmployeeId,
    },
  });
};

const getSaleQuotationReference = async ({ saleId, branchId }) => {
  const normalizedSaleId = positiveInt(saleId, 'saleId');
  const normalizedBranchId = positiveInt(branchId, 'branchId');
  return prisma.saleQuotationReference.findFirst({
    where: { saleId: normalizedSaleId, branchId: normalizedBranchId },
  });
};

const getQuotationDocumentLineage = async ({ quotationId, branchId }) => {
  const normalizedQuotationId = positiveInt(quotationId, 'quotationId');
  const normalizedBranchId = positiveInt(branchId, 'branchId');
  const quotation = await prisma.quotation.findFirst({
    where: { id: normalizedQuotationId, branchId: normalizedBranchId },
    select: { id: true, code: true, revisionNumber: true },
  });
  if (!quotation) fail(404, 'QUOTATION_NOT_FOUND', 'Quotation not found');

  const references = await prisma.saleQuotationReference.findMany({
    where: { branchId: normalizedBranchId, quotationId: normalizedQuotationId },
    orderBy: { createdAt: 'asc' },
  });
  if (!references.length) return { quotation, sales: [] };

  const saleIds = references.map((row) => row.saleId);
  const sales = await prisma.sale.findMany({
    where: { branchId: normalizedBranchId, id: { in: saleIds } },
    select: {
      id: true,
      code: true,
      officialDocumentNumber: true,
      soldAt: true,
      status: true,
      isTaxInvoice: true,
    },
  });
  const candidates = await prisma.taxCandidate.findMany({
    where: { branchId: normalizedBranchId, sourceType: 'SALE', sourceId: { in: saleIds.map(String) } },
    select: {
      sourceId: true,
      document: {
        select: {
          id: true,
          documentType: true,
          documentNumber: true,
          issuedDocumentNumber: true,
          taxInvoiceKind: true,
          status: true,
        },
      },
    },
  });
  const taxBySaleId = new Map(candidates.map((row) => [Number(row.sourceId), row.document || null]));
  const saleById = new Map(sales.map((sale) => [sale.id, sale]));

  return {
    quotation,
    sales: references.map((reference) => {
      const sale = saleById.get(reference.saleId);
      return {
        reference,
        sale: sale || null,
        deliveryNote: sale?.officialDocumentNumber
          ? { documentNumber: sale.officialDocumentNumber, saleId: sale.id }
          : null,
        taxDocument: taxBySaleId.get(reference.saleId) || null,
      };
    }),
  };
};

module.exports = Object.freeze({
  ensureSaleQuotationReference,
  getSaleQuotationReference,
  getQuotationDocumentLineage,
  resolveAcceptedQuotationReference,
});
