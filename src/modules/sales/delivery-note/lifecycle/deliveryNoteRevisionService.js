'use strict';

const { Prisma } = require('../../../../../lib/prisma');
const { findIssuedTaxAuthority } = require('./loadLegacySaleDeliveryNoteLifecycle');
const { deriveDeliveryNoteRevisionNumber } = require('./deliveryNoteRevisionNumberPolicy');
const {
  buildOriginalMaterialization,
  buildReturnAdjustedRevision,
  currentKeyOf,
} = require('./deliveryNoteRevisionAuthority');

const fail = (code, message, statusCode = 409) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const normalizePositiveInt = (value, code, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail(code, `${field} must be a positive integer`, 400);
  return parsed;
};

const loadRevisionSale = async (tx, { branchId, saleId }) => {
  const sale = await tx.sale.findFirst({
    where: {
      id: saleId,
      branchId,
      isCredit: true,
      status: { not: 'CANCELLED' },
      officialDocumentNumber: { not: null },
    },
    select: {
      id: true,
      branchId: true,
      code: true,
      soldAt: true,
      createdAt: true,
      officialDocumentNumber: true,
      totalAmount: true,
      items: {
        select: {
          id: true,
          stockItemId: true,
          price: true,
          returnedQuantity: true,
          documentDescription: true,
          stockItem: { select: { productId: true, product: { select: { name: true } } } },
        },
      },
      simpleItems: {
        select: {
          id: true,
          productId: true,
          quantity: true,
          price: true,
          returnedQuantity: true,
          documentDescription: true,
          product: { select: { name: true } },
        },
      },
    },
  });
  if (!sale) {
    fail(
      'DELIVERY_NOTE_REVISION_SOURCE_INVALID',
      'Sale is missing, cancelled, non-credit, outside branch, or has no issued Delivery Note',
      404,
    );
  }
  return sale;
};

const createDocumentFromAuthority = async (tx, authority) => tx.deliveryNoteDocument.create({
  data: {
    branchId: authority.branchId,
    saleId: authority.saleId,
    documentNumber: authority.documentNumber,
    revisionNumber: authority.revisionNumber,
    revisionKind: authority.revisionKind,
    state: authority.state,
    replacesDocumentId: authority.replacesDocumentId,
    currentKey: authority.currentKey,
    grossAmount: authority.grossAmount,
    returnedAmount: authority.returnedAmount,
    activeAmount: authority.activeAmount,
    issuedAt: authority.issuedAt,
    createdById: authority.createdById,
    snapshot: authority.snapshot,
    lines: {
      create: authority.lines.map((line) => ({
        sourceLineType: line.sourceLineType,
        sourceLineId: line.sourceLineId,
        description: line.description,
        originalQuantity: line.originalQuantity,
        returnedQuantity: line.returnedQuantity,
        activeQuantity: line.activeQuantity,
        unitAmount: line.unitAmount,
        originalAmount: line.originalAmount,
        returnedAmount: line.returnedAmount,
        activeAmount: line.activeAmount,
        sortOrder: line.sortOrder,
        snapshot: line.snapshot,
      })),
    },
    ...(authority.returnSources?.length ? {
      returnSources: {
        create: authority.returnSources.map((source) => ({
          saleReturnId: source.saleReturnId,
          returnedAt: source.returnedAt,
          snapshot: source.snapshot,
        })),
      },
    } : {}),
  },
  include: {
    lines: { orderBy: { sortOrder: 'asc' } },
    returnSources: { orderBy: { returnedAt: 'asc' } },
  },
});

const ensureOriginalMaterialized = async (tx, { sale, createdById }) => {
  const key = currentKeyOf(sale);
  const current = await tx.deliveryNoteDocument.findUnique({
    where: { currentKey: key },
    include: { lines: { orderBy: { sortOrder: 'asc' } }, returnSources: true },
  });
  if (current) return current;

  const latest = await tx.deliveryNoteDocument.findFirst({
    where: { branchId: sale.branchId, saleId: sale.id },
    orderBy: { revisionNumber: 'desc' },
    select: { id: true, state: true, revisionNumber: true, documentNumber: true },
  });
  if (latest) {
    fail(
      'DELIVERY_NOTE_REVISION_NO_CURRENT_DOCUMENT',
      `Delivery Note lifecycle has no current document after ${latest.state}`,
    );
  }

  const original = buildOriginalMaterialization({ sale, createdById });
  return createDocumentFromAuthority(tx, original);
};

const createReturnAdjustedDeliveryNoteRevision = async ({
  prisma,
  branchId,
  saleId,
  employeeId,
  documentNumber = null,
}) => {
  if (!prisma) fail('DELIVERY_NOTE_REVISION_PRISMA_REQUIRED', 'prisma is required', 500);
  const normalizedBranchId = normalizePositiveInt(branchId, 'DELIVERY_NOTE_BRANCH_REQUIRED', 'branchId');
  const normalizedSaleId = normalizePositiveInt(saleId, 'DELIVERY_NOTE_SALE_REQUIRED', 'saleId');
  const normalizedEmployeeId = normalizePositiveInt(employeeId, 'DELIVERY_NOTE_EMPLOYEE_REQUIRED', 'employeeId');

  return prisma.$transaction(async (tx) => {
    const sale = await loadRevisionSale(tx, {
      branchId: normalizedBranchId,
      saleId: normalizedSaleId,
    });

    const [activeConsolidation, issuedTaxAuthority] = await Promise.all([
      tx.consolidatedDeliveryLine.findFirst({
        where: {
          branchId: normalizedBranchId,
          sourceSaleId: normalizedSaleId,
          status: 'DOCUMENTED',
          combinedBilling: { is: { status: { not: 'CANCELLED' } } },
        },
        select: { combinedBillingId: true },
      }),
      findIssuedTaxAuthority(tx, {
        branchId: normalizedBranchId,
        saleId: normalizedSaleId,
      }),
    ]);

    if (activeConsolidation) {
      fail(
        'DELIVERY_NOTE_REVISION_SOURCE_CONSOLIDATED',
        `Source Delivery Note is already represented by consolidated document ${activeConsolidation.combinedBillingId}`,
      );
    }
    if (issuedTaxAuthority) {
      fail(
        'DELIVERY_NOTE_REVISION_TAX_ALREADY_ISSUED',
        `Tax authority already exists (${issuedTaxAuthority.document?.issuedDocumentNumber || issuedTaxAuthority.document?.id})`,
      );
    }

    const predecessor = await ensureOriginalMaterialized(tx, {
      sale,
      createdById: normalizedEmployeeId,
    });

    const completedReturns = await tx.saleReturn.findMany({
      where: {
        branchId: normalizedBranchId,
        saleId: normalizedSaleId,
        status: 'COMPLETED',
        returnedAt: { gt: predecessor.issuedAt },
      },
      orderBy: [{ returnedAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        code: true,
        status: true,
        returnedAt: true,
        completedAt: true,
      },
    });

    const returnSources = completedReturns.length
      ? completedReturns
      : predecessor.revisionNumber === 1
        ? await tx.saleReturn.findMany({
            where: {
              branchId: normalizedBranchId,
              saleId: normalizedSaleId,
              status: 'COMPLETED',
            },
            orderBy: [{ returnedAt: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              code: true,
              status: true,
              returnedAt: true,
              completedAt: true,
            },
          })
        : [];

    const nextRevisionNumber = Number(predecessor.revisionNumber) + 1;
    const resolvedDocumentNumber = documentNumber || deriveDeliveryNoteRevisionNumber({
      originalDocumentNumber: sale.officialDocumentNumber,
      revisionNumber: nextRevisionNumber,
    });

    const command = buildReturnAdjustedRevision({
      sale,
      predecessor,
      documentNumber: resolvedDocumentNumber,
      createdById: normalizedEmployeeId,
      returnSources,
    });

    await tx.deliveryNoteDocument.update({
      where: { id: predecessor.id },
      data: command.predecessorUpdate,
    });

    return createDocumentFromAuthority(tx, command.revision);
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 30000,
  });
};

module.exports = Object.freeze({
  loadRevisionSale,
  ensureOriginalMaterialized,
  createReturnAdjustedDeliveryNoteRevision,
});
