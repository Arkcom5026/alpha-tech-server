'use strict';

const positive = (value) => {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
};

const normalizeDocumentText = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const updateConsolidatedDocumentLine = async ({
  prisma,
  branchId,
  documentId,
  lineId,
  employeeId,
  documentPrefix,
  documentDescription,
  documentSuffix,
}) => {
  const normalizedBranchId = positive(branchId);
  const normalizedDocumentId = positive(documentId);
  const normalizedLineId = positive(lineId);
  const normalizedEmployeeId = positive(employeeId);
  const prefix = normalizeDocumentText(documentPrefix);
  const description = normalizeDocumentText(documentDescription);
  const suffix = normalizeDocumentText(documentSuffix);

  if (!normalizedBranchId) fail('BRANCH_CONTEXT_REQUIRED', 'Branch context is required', 401);
  if (!normalizedDocumentId || !normalizedLineId) {
    fail('CONSOLIDATED_DOCUMENT_LINE_ID_INVALID', 'Document line identity is invalid');
  }

  for (const [field, value] of [
    ['documentPrefix', prefix],
    ['documentDescription', description],
    ['documentSuffix', suffix],
  ]) {
    if (value && value.length > 1000) {
      fail('CONSOLIDATED_DOCUMENT_LINE_TEXT_TOO_LONG', `${field} is too long`);
    }
  }

  const document = await prisma.combinedBillingDocument.findFirst({
    where: { id: normalizedDocumentId, branchId: normalizedBranchId },
    select: { id: true },
  });
  if (!document) {
    fail('CONSOLIDATED_DELIVERY_NOT_FOUND', 'Consolidated delivery not found', 404);
  }

  const line = await prisma.consolidatedDeliveryLine.findFirst({
    where: {
      id: normalizedLineId,
      combinedBillingId: normalizedDocumentId,
      branchId: normalizedBranchId,
    },
    select: { id: true },
  });
  if (!line) {
    fail('CONSOLIDATED_DOCUMENT_LINE_NOT_FOUND', 'Document line not found in this consolidated delivery', 404);
  }

  const presentation = await prisma.consolidatedDeliveryLinePresentation.upsert({
    where: {
      branchId_consolidatedDeliveryLineId: {
        branchId: normalizedBranchId,
        consolidatedDeliveryLineId: normalizedLineId,
      },
    },
    create: {
      branchId: normalizedBranchId,
      combinedBillingId: normalizedDocumentId,
      consolidatedDeliveryLineId: normalizedLineId,
      documentPrefix: prefix,
      documentDescription: description,
      documentSuffix: suffix,
      updatedById: normalizedEmployeeId,
    },
    update: {
      combinedBillingId: normalizedDocumentId,
      documentPrefix: prefix,
      documentDescription: description,
      documentSuffix: suffix,
      updatedById: normalizedEmployeeId,
    },
    select: {
      documentPrefix: true,
      documentDescription: true,
      documentSuffix: true,
    },
  });

  return {
    success: true,
    documentId: normalizedDocumentId,
    lineId: normalizedLineId,
    presentation,
  };
};

module.exports = {
  normalizeDocumentText,
  updateConsolidatedDocumentLine,
};
