'use strict';

const positive = (value) => {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
};

const normalizeDescription = (value) => {
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

const updateConsolidatedDocumentLine = async ({ prisma, branchId, documentId, lineId, description }) => {
  const normalizedBranchId = positive(branchId);
  const normalizedDocumentId = positive(documentId);
  const normalizedLineId = positive(lineId);
  const normalizedDescription = normalizeDescription(description);

  if (!normalizedBranchId) fail('BRANCH_CONTEXT_REQUIRED', 'Branch context is required', 401);
  if (!normalizedDocumentId || !normalizedLineId) {
    fail('CONSOLIDATED_DOCUMENT_LINE_ID_INVALID', 'Document line identity is invalid');
  }
  if (!normalizedDescription) {
    fail('CONSOLIDATED_DOCUMENT_LINE_DESCRIPTION_REQUIRED', 'Document line description is required');
  }
  if (normalizedDescription.length > 1000) {
    fail('CONSOLIDATED_DOCUMENT_LINE_DESCRIPTION_TOO_LONG', 'Document line description is too long');
  }

  const document = await prisma.combinedBillingDocument.findFirst({
    where: { id: normalizedDocumentId, branchId: normalizedBranchId },
    select: { id: true },
  });
  if (!document) {
    fail('CONSOLIDATED_DELIVERY_NOT_FOUND', 'Consolidated delivery not found', 404);
  }

  const result = await prisma.consolidatedDeliveryLine.updateMany({
    where: {
      id: normalizedLineId,
      combinedBillingId: normalizedDocumentId,
      branchId: normalizedBranchId,
    },
    data: { description: normalizedDescription },
  });

  if (Number(result?.count || 0) !== 1) {
    fail('CONSOLIDATED_DOCUMENT_LINE_NOT_FOUND', 'Document line not found in this consolidated delivery', 404);
  }

  return {
    success: true,
    documentId: normalizedDocumentId,
    lineId: normalizedLineId,
    description: normalizedDescription,
  };
};

module.exports = {
  normalizeDescription,
  updateConsolidatedDocumentLine,
};
