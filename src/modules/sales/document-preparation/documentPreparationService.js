'use strict';

const {
  buildLockedPreparationSnapshot,
  buildPreparationTaxProjection,
} = require('./documentPreparationPolicy');

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const positiveInt = (value, code, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail(code, `${field} must be a positive integer`);
  return parsed;
};

const requiredText = (value, code, field, maxLength = 500) => {
  const normalized = String(value || '').trim();
  if (!normalized) fail(code, `${field} is required`);
  if (normalized.length > maxLength) fail(code, `${field} is too long`);
  return normalized;
};

const optionalText = (value, maxLength = 100) => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) fail('DOCUMENT_PREPARATION_LINE_INVALID', 'unitName is too long');
  return normalized;
};

const nonNegativeNumber = (value, field) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    fail('DOCUMENT_PREPARATION_LINE_INVALID', `${field} must be a non-negative number`);
  }
  return parsed;
};

const positiveNumber = (value, field) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    fail('DOCUMENT_PREPARATION_LINE_INVALID', `${field} must be greater than zero`);
  }
  return parsed;
};

const normalizeManualLines = (lines) => {
  if (!Array.isArray(lines)) fail('DOCUMENT_PREPARATION_LINES_REQUIRED', 'lines must be an array');
  if (lines.length > 200) fail('DOCUMENT_PREPARATION_LINES_LIMIT', 'A draft cannot contain more than 200 lines');

  return lines.map((line, index) => {
    const quantity = positiveNumber(line?.quantity, `lines[${index}].quantity`);
    const unitPrice = nonNegativeNumber(line?.unitPrice, `lines[${index}].unitPrice`);
    return Object.freeze({
      description: requiredText(
        line?.description,
        'DOCUMENT_PREPARATION_LINE_INVALID',
        `lines[${index}].description`,
      ),
      quantity,
      unitName: optionalText(line?.unitName),
      unitPrice: roundMoney(unitPrice),
      amount: roundMoney(quantity * unitPrice),
      sortOrder: index,
    });
  });
};

const buildAgencyContext = (customer) => {
  if (!customer) return null;
  return Object.freeze({
    customerId: Number(customer.id),
    customerType: customer.type || null,
    organizationName: customer.companyName || null,
    departmentName: customer.departmentName || null,
    contactName: customer.name || null,
    taxId: customer.taxId || null,
    address: customer.addressDetail || null,
  });
};

const selectSourceSale = (prisma, { branchId, saleId }) => prisma.sale.findFirst({
  where: { id: saleId, branchId },
  select: {
    id: true,
    code: true,
    status: true,
    officialDocumentNumber: true,
    totalAmount: true,
    vat: true,
    vatRate: true,
    customer: {
      select: {
        id: true,
        type: true,
        name: true,
        companyName: true,
        departmentName: true,
        taxId: true,
        addressDetail: true,
      },
    },
  },
});

const findPreparation = (prisma, { branchId, saleId }) => prisma.saleDocumentPreparation.findUnique({
  where: {
    branchId_sourceType_sourceId: {
      branchId,
      sourceType: 'SALE',
      sourceId: String(saleId),
    },
  },
  include: { lines: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
});

const presentPreparation = (preparation) => {
  if (!preparation) return null;
  const lines = Array.isArray(preparation.lines) ? preparation.lines : [];
  const projection = buildPreparationTaxProjection({
    sourceTotal: Number(preparation.sourceTotal || 0),
    lines,
  });
  return Object.freeze({
    ...preparation,
    sourceTotal: projection.sourceTotal,
    documentTotal: projection.documentTotal,
    inBudgetTotal: projection.documentTotal,
    outOfBudgetTotal: projection.outOfBudgetTotal,
    taxProjection: projection.projections,
  });
};

const getSaleDocumentPreparation = async ({ prisma, branchId, saleId }) => {
  const normalizedBranchId = positiveInt(branchId, 'DOCUMENT_PREPARATION_BRANCH_REQUIRED', 'branchId');
  const normalizedSaleId = positiveInt(saleId, 'DOCUMENT_PREPARATION_SALE_REQUIRED', 'saleId');
  const preparation = await findPreparation(prisma, {
    branchId: normalizedBranchId,
    saleId: normalizedSaleId,
  });
  if (!preparation) fail('DOCUMENT_PREPARATION_NOT_FOUND', 'Document preparation draft not found', 404);
  return presentPreparation(preparation);
};

const createSaleDocumentPreparation = async ({ prisma, branchId, saleId, actorEmployeeId }) => {
  const normalizedBranchId = positiveInt(branchId, 'DOCUMENT_PREPARATION_BRANCH_REQUIRED', 'branchId');
  const normalizedSaleId = positiveInt(saleId, 'DOCUMENT_PREPARATION_SALE_REQUIRED', 'saleId');
  const normalizedActorId = actorEmployeeId == null
    ? null
    : positiveInt(actorEmployeeId, 'DOCUMENT_PREPARATION_ACTOR_INVALID', 'actorEmployeeId');

  const sale = await selectSourceSale(prisma, {
    branchId: normalizedBranchId,
    saleId: normalizedSaleId,
  });
  if (!sale) fail('DOCUMENT_PREPARATION_SOURCE_NOT_FOUND', 'Sale source not found in this branch', 404);
  if (String(sale.status || '').toUpperCase() === 'CANCELLED') {
    fail('DOCUMENT_PREPARATION_SOURCE_CANCELLED', 'A cancelled sale cannot create a document preparation', 409);
  }
  if (!sale.officialDocumentNumber) {
    fail('DOCUMENT_PREPARATION_DELIVERY_NOTE_REQUIRED', 'Issue the delivery note before creating its preparation draft', 409);
  }

  const existing = await findPreparation(prisma, {
    branchId: normalizedBranchId,
    saleId: normalizedSaleId,
  });
  if (existing) return Object.freeze({ replayed: true, preparation: presentPreparation(existing) });

  try {
    const created = await prisma.saleDocumentPreparation.create({
      data: {
        branchId: normalizedBranchId,
        sourceType: 'SALE',
        sourceId: String(sale.id),
        status: 'DRAFT',
        sourceTotal: roundMoney(Number(sale.totalAmount || 0)),
        documentTotal: 0,
        agencyContext: buildAgencyContext(sale.customer),
        createdById: normalizedActorId,
        updatedById: normalizedActorId,
      },
      include: { lines: true },
    });
    return Object.freeze({ replayed: false, preparation: presentPreparation(created) });
  } catch (error) {
    if (error?.code !== 'P2002') throw error;
    const replay = await findPreparation(prisma, {
      branchId: normalizedBranchId,
      saleId: normalizedSaleId,
    });
    if (!replay) throw error;
    return Object.freeze({ replayed: true, preparation: presentPreparation(replay) });
  }
};

const replaceSaleDocumentPreparationLines = async ({ prisma, branchId, saleId, actorEmployeeId, lines }) => {
  const normalizedBranchId = positiveInt(branchId, 'DOCUMENT_PREPARATION_BRANCH_REQUIRED', 'branchId');
  const normalizedSaleId = positiveInt(saleId, 'DOCUMENT_PREPARATION_SALE_REQUIRED', 'saleId');
  const normalizedActorId = actorEmployeeId == null
    ? null
    : positiveInt(actorEmployeeId, 'DOCUMENT_PREPARATION_ACTOR_INVALID', 'actorEmployeeId');
  const normalizedLines = normalizeManualLines(lines);

  return prisma.$transaction(async (tx) => {
    const preparation = await findPreparation(tx, {
      branchId: normalizedBranchId,
      saleId: normalizedSaleId,
    });
    if (!preparation) fail('DOCUMENT_PREPARATION_NOT_FOUND', 'Document preparation draft not found', 404);
    if (preparation.status !== 'DRAFT') {
      fail('DOCUMENT_PREPARATION_IMMUTABLE', 'Only a DRAFT preparation can be edited', 409);
    }

    const projection = buildPreparationTaxProjection({
      sourceTotal: Number(preparation.sourceTotal || 0),
      lines: normalizedLines,
    });

    await tx.saleDocumentPreparationLine.deleteMany({
      where: { preparationId: preparation.id },
    });
    if (normalizedLines.length) {
      await tx.saleDocumentPreparationLine.createMany({
        data: normalizedLines.map((line) => ({
          preparationId: preparation.id,
          description: line.description,
          quantity: line.quantity,
          unitName: line.unitName,
          unitPrice: line.unitPrice,
          amount: line.amount,
          sortOrder: line.sortOrder,
        })),
      });
    }
    await tx.saleDocumentPreparation.update({
      where: { id: preparation.id },
      data: {
        documentTotal: projection.documentTotal,
        updatedById: normalizedActorId,
      },
    });

    const updated = await findPreparation(tx, {
      branchId: normalizedBranchId,
      saleId: normalizedSaleId,
    });
    return presentPreparation(updated);
  });
};

const lockSaleDocumentPreparation = async ({ prisma, branchId, saleId, actorEmployeeId }) => {
  const normalizedBranchId = positiveInt(branchId, 'DOCUMENT_PREPARATION_BRANCH_REQUIRED', 'branchId');
  const normalizedSaleId = positiveInt(saleId, 'DOCUMENT_PREPARATION_SALE_REQUIRED', 'saleId');
  const normalizedActorId = actorEmployeeId == null
    ? null
    : positiveInt(actorEmployeeId, 'DOCUMENT_PREPARATION_ACTOR_INVALID', 'actorEmployeeId');

  return prisma.$transaction(async (tx) => {
    const preparation = await findPreparation(tx, {
      branchId: normalizedBranchId,
      saleId: normalizedSaleId,
    });
    if (!preparation) fail('DOCUMENT_PREPARATION_NOT_FOUND', 'Document preparation draft not found', 404);
    if (preparation.status === 'LOCKED') {
      return Object.freeze({
        replayed: true,
        preparation: presentPreparation(preparation),
        finalSnapshot: preparation.finalSnapshot || null,
      });
    }
    if (preparation.status !== 'DRAFT') {
      fail('DOCUMENT_PREPARATION_LOCK_FORBIDDEN', 'Only a DRAFT preparation can be locked', 409);
    }

    const sale = await selectSourceSale(tx, {
      branchId: normalizedBranchId,
      saleId: normalizedSaleId,
    });
    if (!sale) fail('DOCUMENT_PREPARATION_SOURCE_NOT_FOUND', 'Sale source not found in this branch', 404);
    if (String(sale.status || '').toUpperCase() === 'CANCELLED') {
      fail('DOCUMENT_PREPARATION_SOURCE_CANCELLED', 'A cancelled sale cannot lock document preparation', 409);
    }
    if (!sale.officialDocumentNumber) {
      fail('DOCUMENT_PREPARATION_DELIVERY_NOTE_REQUIRED', 'Delivery note authority is required before lock', 409);
    }
    if (roundMoney(sale.totalAmount) !== roundMoney(preparation.sourceTotal)) {
      fail(
        'DOCUMENT_PREPARATION_SOURCE_TOTAL_CHANGED',
        'Source transaction total changed after preparation creation',
        409,
      );
    }

    const lockedAt = new Date();
    const finalSnapshot = buildLockedPreparationSnapshot({
      preparationId: preparation.id,
      sourceSale: sale,
      sourceTotal: Number(preparation.sourceTotal || 0),
      agencyContext: preparation.agencyContext,
      lines: preparation.lines,
      lockedAt,
      lockedById: normalizedActorId,
    });

    const changed = await tx.saleDocumentPreparation.updateMany({
      where: { id: preparation.id, status: 'DRAFT' },
      data: {
        status: 'LOCKED',
        finalSnapshot,
        lockedById: normalizedActorId,
        lockedAt,
        updatedById: normalizedActorId,
      },
    });

    if (changed.count !== 1) {
      const replay = await findPreparation(tx, {
        branchId: normalizedBranchId,
        saleId: normalizedSaleId,
      });
      if (replay?.status === 'LOCKED') {
        return Object.freeze({
          replayed: true,
          preparation: presentPreparation(replay),
          finalSnapshot: replay.finalSnapshot || null,
        });
      }
      fail('DOCUMENT_PREPARATION_LOCK_CONFLICT', 'Document preparation changed during lock', 409);
    }

    const locked = await findPreparation(tx, {
      branchId: normalizedBranchId,
      saleId: normalizedSaleId,
    });
    return Object.freeze({
      replayed: false,
      preparation: presentPreparation(locked),
      finalSnapshot,
    });
  });
};

module.exports = Object.freeze({
  buildAgencyContext,
  createSaleDocumentPreparation,
  getSaleDocumentPreparation,
  lockSaleDocumentPreparation,
  normalizeManualLines,
  replaceSaleDocumentPreparationLines,
});
