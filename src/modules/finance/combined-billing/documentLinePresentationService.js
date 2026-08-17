'use strict';

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

const normalizeLineUpdates = (lines) => {
  if (!Array.isArray(lines)) return [];

  const byId = new Map();
  for (const line of lines) {
    const id = Number(line?.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    byId.set(id, {
      id,
      documentPrefix: normalizeDocumentText(line?.documentPrefix),
      documentDescription: normalizeDocumentText(line?.documentDescription),
      documentSuffix: normalizeDocumentText(line?.documentSuffix),
    });
  }
  return [...byId.values()];
};

const updateConsolidatedDocumentLines = async ({
  prisma,
  branchId,
  combinedBillingId,
  employeeId,
  lines,
}) => {
  const normalizedBranchId = Number(branchId);
  const normalizedDocumentId = Number(combinedBillingId);
  const normalizedEmployeeId = Number(employeeId) || null;

  if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
    fail('BRANCH_CONTEXT_REQUIRED', 'Branch context is required', 401);
  }
  if (!Number.isInteger(normalizedDocumentId) || normalizedDocumentId <= 0) {
    fail('CONSOLIDATED_DELIVERY_ID_INVALID', 'Document identity is invalid');
  }

  const document = await prisma.combinedBillingDocument.findFirst({
    where: {
      id: normalizedDocumentId,
      branchId: normalizedBranchId,
      documentLines: { some: {} },
    },
    select: { id: true },
  });
  if (!document) {
    fail('CONSOLIDATED_DELIVERY_NOT_FOUND', 'Consolidated delivery not found', 404);
  }

  const updates = normalizeLineUpdates(lines);
  if (updates.length === 0) {
    return { success: true, updated: { lines: 0 } };
  }

  const lineIds = updates.map((line) => line.id);
  const ownedLines = await prisma.consolidatedDeliveryLine.findMany({
    where: {
      id: { in: lineIds },
      combinedBillingId: normalizedDocumentId,
      branchId: normalizedBranchId,
    },
    select: { id: true },
  });
  if (ownedLines.length !== lineIds.length) {
    fail(
      'CONSOLIDATED_DELIVERY_LINE_NOT_FOUND',
      'One or more document lines do not belong to this consolidated delivery',
      404,
    );
  }

  const operations = updates.map((line) => prisma.consolidatedDeliveryLinePresentation.upsert({
    where: {
      branchId_consolidatedDeliveryLineId: {
        branchId: normalizedBranchId,
        consolidatedDeliveryLineId: line.id,
      },
    },
    create: {
      branchId: normalizedBranchId,
      combinedBillingId: normalizedDocumentId,
      consolidatedDeliveryLineId: line.id,
      documentPrefix: line.documentPrefix,
      documentDescription: line.documentDescription,
      documentSuffix: line.documentSuffix,
      updatedById: normalizedEmployeeId,
    },
    update: {
      documentPrefix: line.documentPrefix,
      documentDescription: line.documentDescription,
      documentSuffix: line.documentSuffix,
      updatedById: normalizedEmployeeId,
    },
  }));

  await prisma.$transaction(operations);
  return { success: true, updated: { lines: updates.length } };
};

module.exports = {
  normalizeDocumentText,
  normalizeLineUpdates,
  updateConsolidatedDocumentLines,
};
