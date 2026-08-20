'use strict';

const {
  assertReplacementFinancialLock,
  buildReplacementFinancialLock,
} = require('./documentReplacementPolicy');

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

const requiredText = (value, code, field, maxLength = 500) => {
  const normalized = String(value || '').trim();
  if (!normalized) fail(code, `${field} is required`);
  if (normalized.length > maxLength) fail(code, `${field} is too long`);
  return normalized;
};

const draftKeyFor = (branchId, preparationId) => `${Number(branchId)}:${Number(preparationId)}:DRAFT`;
const currentKeyFor = (branchId, preparationId) => `${Number(branchId)}:${Number(preparationId)}:CURRENT`;

const normalizeLine = (line, portion, index) => {
  const quantity = Number(line?.quantity);
  const unitPrice = Number(line?.unitPrice);
  const amount = Number((quantity * unitPrice).toFixed(2));
  return Object.freeze({
    portion,
    description: requiredText(line?.description, 'DOCUMENT_REPLACEMENT_LINE_INVALID', `lines[${index}].description`),
    quantity,
    unitName: String(line?.unitName || '').trim() || null,
    unitPrice: Number(unitPrice.toFixed(2)),
    amount,
    lineType: portion === 'OUT_OF_BUDGET' ? 'SERVICE_ONLY' : 'MANUAL_DOCUMENT_LINES',
    sortOrder: index,
  });
};

const splitLines = (lines = []) => Object.freeze({
  inBudgetLines: lines.filter((line) => line.portion === 'IN_BUDGET'),
  outOfBudgetLines: lines.filter((line) => line.portion === 'OUT_OF_BUDGET'),
});

const findLockedPreparation = (prisma, { branchId, saleId }) => prisma.saleDocumentPreparation.findUnique({
  where: {
    branchId_sourceType_sourceId: {
      branchId,
      sourceType: 'SALE',
      sourceId: String(saleId),
    },
  },
});

const replacementInclude = Object.freeze({
  lines: { orderBy: [{ portion: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }] },
});

const findReplacementByDraftKey = (prisma, draftKey) => prisma.saleDocumentReplacement.findUnique({
  where: { draftKey },
  include: replacementInclude,
});

const findCurrentReplacement = (prisma, currentKey) => prisma.saleDocumentReplacement.findUnique({
  where: { currentKey },
  include: replacementInclude,
});

const loadPreparationTaxDocuments = async (prisma, { branchId, preparationId }) => prisma.taxDocument.findMany({
  where: {
    branchId,
    candidate: {
      is: {
        sourceType: 'DOCUMENT_PREPARATION',
        sourceId: { startsWith: `${Number(preparationId)}:` },
      },
    },
  },
  select: {
    id: true,
    issuedDocumentNumber: true,
    snapshot: true,
    outputVatRecord: { select: { taxPeriodId: true } },
  },
});

const buildTaxPeriodMap = (documents) => Object.fromEntries(
  (documents || [])
    .filter((document) => document?.id != null)
    .map((document) => [document.id, document.outputVatRecord?.taxPeriodId || null]),
);

const seedLinesFromAuthority = ({ preparation, currentReplacement }) => {
  if (currentReplacement?.finalSnapshot?.lines && Array.isArray(currentReplacement.finalSnapshot.lines)) {
    return currentReplacement.finalSnapshot.lines.map((line, index) => normalizeLine(line, line.portion, index));
  }

  const finalSnapshot = preparation.finalSnapshot;
  const lines = (Array.isArray(finalSnapshot?.lines) ? finalSnapshot.lines : []).map((line, index) => (
    normalizeLine(line, 'IN_BUDGET', index)
  ));
  if (finalSnapshot?.outOfBudgetService) {
    lines.push(normalizeLine(finalSnapshot.outOfBudgetService, 'OUT_OF_BUDGET', 0));
  }
  return lines;
};

const presentReplacement = (replacement) => {
  if (!replacement) return null;
  if (replacement.status === 'LOCKED' && replacement.finalSnapshot) {
    const snapshotLines = Array.isArray(replacement.finalSnapshot.lines) ? replacement.finalSnapshot.lines : [];
    const { inBudgetLines, outOfBudgetLines } = splitLines(snapshotLines);
    return Object.freeze({
      ...replacement,
      lines: snapshotLines,
      inBudgetLines,
      outOfBudgetLines,
    });
  }
  const lines = Array.isArray(replacement.lines) ? replacement.lines : [];
  const { inBudgetLines, outOfBudgetLines } = splitLines(lines);
  return Object.freeze({
    ...replacement,
    lines,
    inBudgetLines,
    outOfBudgetLines,
  });
};

const buildReplacementFinalSnapshot = ({ replacement, saleId, lockedAt, lockedById }) => {
  const lines = Array.isArray(replacement?.lines) ? replacement.lines : [];
  const { inBudgetLines, outOfBudgetLines } = splitLines(lines);
  const financialCheck = assertReplacementFinancialLock({
    financialLock: replacement.financialLock,
    inBudgetLines,
    outOfBudgetLines,
  });

  const snapshotLines = lines.map((line, index) => Object.freeze({
    portion: line.portion,
    description: String(line.description || '').trim(),
    quantity: Number(line.quantity || 0),
    unitName: String(line.unitName || '').trim() || null,
    unitPrice: Number(Number(line.unitPrice || 0).toFixed(2)),
    amount: Number(Number(line.amount || 0).toFixed(2)),
    lineType: line.lineType,
    sortOrder: Number.isInteger(Number(line.sortOrder)) ? Number(line.sortOrder) : index,
  }));

  return Object.freeze({
    schemaVersion: 1,
    replacementId: Number(replacement.id),
    preparationId: Number(replacement.preparationId),
    replacementNumber: Number(replacement.replacementNumber),
    replacesReplacementId: replacement.replacesReplacementId == null ? null : Number(replacement.replacesReplacementId),
    sourceSaleId: Number(saleId),
    reason: replacement.reason,
    financialLock: replacement.financialLock,
    totals: Object.freeze({
      sourceTotal: financialCheck.sourceTotal,
      sourceTaxAmount: financialCheck.sourceTaxAmount,
      inBudgetTotal: financialCheck.inBudgetTotal,
      outOfBudgetTotal: financialCheck.outOfBudgetTotal,
      total: financialCheck.total,
    }),
    lines: Object.freeze(snapshotLines),
    lockedAt: new Date(lockedAt).toISOString(),
    lockedById: lockedById == null ? null : Number(lockedById),
  });
};

const getSaleDocumentReplacement = async ({ prisma, branchId, saleId }) => {
  const normalizedBranchId = positiveInt(branchId, 'DOCUMENT_REPLACEMENT_BRANCH_REQUIRED', 'branchId');
  const normalizedSaleId = positiveInt(saleId, 'DOCUMENT_REPLACEMENT_SALE_REQUIRED', 'saleId');
  const preparation = await findLockedPreparation(prisma, { branchId: normalizedBranchId, saleId: normalizedSaleId });
  if (!preparation) fail('DOCUMENT_REPLACEMENT_PREPARATION_NOT_FOUND', 'Document preparation not found', 404);

  const draftKey = draftKeyFor(normalizedBranchId, preparation.id);
  const currentKey = currentKeyFor(normalizedBranchId, preparation.id);
  const replacement = await findReplacementByDraftKey(prisma, draftKey)
    || await findCurrentReplacement(prisma, currentKey);
  if (!replacement) fail('DOCUMENT_REPLACEMENT_NOT_FOUND', 'Document replacement not found', 404);
  return presentReplacement(replacement);
};

const createSaleDocumentReplacement = async ({ prisma, branchId, saleId, actorEmployeeId, reason }) => {
  const normalizedBranchId = positiveInt(branchId, 'DOCUMENT_REPLACEMENT_BRANCH_REQUIRED', 'branchId');
  const normalizedSaleId = positiveInt(saleId, 'DOCUMENT_REPLACEMENT_SALE_REQUIRED', 'saleId');
  const normalizedActorId = actorEmployeeId == null ? null : positiveInt(actorEmployeeId, 'DOCUMENT_REPLACEMENT_ACTOR_INVALID', 'actorEmployeeId');
  const normalizedReason = requiredText(reason, 'DOCUMENT_REPLACEMENT_REASON_REQUIRED', 'reason', 1000);

  return prisma.$transaction(async (tx) => {
    const preparation = await findLockedPreparation(tx, { branchId: normalizedBranchId, saleId: normalizedSaleId });
    if (!preparation) fail('DOCUMENT_REPLACEMENT_PREPARATION_NOT_FOUND', 'Document preparation not found', 404);
    if (preparation.status !== 'LOCKED' || !preparation.finalSnapshot) {
      fail('DOCUMENT_REPLACEMENT_PREPARATION_NOT_LOCKED', 'Replacement requires a locked preparation snapshot', 409);
    }

    const draftKey = draftKeyFor(normalizedBranchId, preparation.id);
    const existingDraft = await findReplacementByDraftKey(tx, draftKey);
    if (existingDraft) return Object.freeze({ replayed: true, replacement: presentReplacement(existingDraft) });

    const currentKey = currentKeyFor(normalizedBranchId, preparation.id);
    const currentReplacement = await findCurrentReplacement(tx, currentKey);
    const taxDocuments = await loadPreparationTaxDocuments(tx, {
      branchId: normalizedBranchId,
      preparationId: preparation.id,
    });
    const financialLock = currentReplacement?.financialLock || buildReplacementFinancialLock({
      finalSnapshot: preparation.finalSnapshot,
      taxDocuments,
      taxPeriodByDocumentId: buildTaxPeriodMap(taxDocuments),
    });

    const seedLines = seedLinesFromAuthority({ preparation, currentReplacement });
    const { inBudgetLines, outOfBudgetLines } = splitLines(seedLines);
    assertReplacementFinancialLock({ financialLock, inBudgetLines, outOfBudgetLines });

    const numberAggregate = await tx.saleDocumentReplacement.aggregate({
      where: { preparationId: preparation.id },
      _max: { replacementNumber: true },
    });
    const replacementNumber = Number(numberAggregate?._max?.replacementNumber || 0) + 1;

    try {
      const created = await tx.saleDocumentReplacement.create({
        data: {
          branchId: normalizedBranchId,
          preparationId: preparation.id,
          replacementNumber,
          replacesReplacementId: currentReplacement?.id || null,
          status: 'DRAFT',
          draftKey,
          currentKey: null,
          reason: normalizedReason,
          financialLock,
          createdById: normalizedActorId,
          updatedById: normalizedActorId,
          lines: {
            create: seedLines.map((line) => ({
              portion: line.portion,
              description: line.description,
              quantity: line.quantity,
              unitName: line.unitName,
              unitPrice: line.unitPrice,
              amount: line.amount,
              lineType: line.lineType,
              sortOrder: line.sortOrder,
            })),
          },
        },
        include: replacementInclude,
      });
      return Object.freeze({ replayed: false, replacement: presentReplacement(created) });
    } catch (error) {
      if (error?.code !== 'P2002') throw error;
      const replay = await findReplacementByDraftKey(tx, draftKey);
      if (!replay) throw error;
      return Object.freeze({ replayed: true, replacement: presentReplacement(replay) });
    }
  });
};

const replaceSaleDocumentReplacementLines = async ({ prisma, branchId, saleId, actorEmployeeId, inBudgetLines, outOfBudgetLines }) => {
  const normalizedBranchId = positiveInt(branchId, 'DOCUMENT_REPLACEMENT_BRANCH_REQUIRED', 'branchId');
  const normalizedSaleId = positiveInt(saleId, 'DOCUMENT_REPLACEMENT_SALE_REQUIRED', 'saleId');
  const normalizedActorId = actorEmployeeId == null ? null : positiveInt(actorEmployeeId, 'DOCUMENT_REPLACEMENT_ACTOR_INVALID', 'actorEmployeeId');

  return prisma.$transaction(async (tx) => {
    const preparation = await findLockedPreparation(tx, { branchId: normalizedBranchId, saleId: normalizedSaleId });
    if (!preparation) fail('DOCUMENT_REPLACEMENT_PREPARATION_NOT_FOUND', 'Document preparation not found', 404);
    const draftKey = draftKeyFor(normalizedBranchId, preparation.id);
    const replacement = await findReplacementByDraftKey(tx, draftKey);
    if (!replacement) fail('DOCUMENT_REPLACEMENT_DRAFT_NOT_FOUND', 'Replacement draft not found', 404);
    if (replacement.status !== 'DRAFT') fail('DOCUMENT_REPLACEMENT_IMMUTABLE', 'Only a DRAFT replacement can be edited', 409);

    assertReplacementFinancialLock({
      financialLock: replacement.financialLock,
      inBudgetLines,
      outOfBudgetLines,
    });

    const normalizedInBudget = (inBudgetLines || []).map((line, index) => normalizeLine(line, 'IN_BUDGET', index));
    const normalizedOutOfBudget = (outOfBudgetLines || []).map((line, index) => normalizeLine(line, 'OUT_OF_BUDGET', index));
    const nextLines = [...normalizedInBudget, ...normalizedOutOfBudget];

    await tx.saleDocumentReplacementLine.deleteMany({ where: { replacementId: replacement.id } });
    await tx.saleDocumentReplacementLine.createMany({
      data: nextLines.map((line) => ({
        replacementId: replacement.id,
        portion: line.portion,
        description: line.description,
        quantity: line.quantity,
        unitName: line.unitName,
        unitPrice: line.unitPrice,
        amount: line.amount,
        lineType: line.lineType,
        sortOrder: line.sortOrder,
      })),
    });
    await tx.saleDocumentReplacement.update({
      where: { id: replacement.id },
      data: { updatedById: normalizedActorId },
    });

    const updated = await findReplacementByDraftKey(tx, draftKey);
    return presentReplacement(updated);
  });
};

const lockSaleDocumentReplacement = async ({ prisma, branchId, saleId, actorEmployeeId }) => {
  const normalizedBranchId = positiveInt(branchId, 'DOCUMENT_REPLACEMENT_BRANCH_REQUIRED', 'branchId');
  const normalizedSaleId = positiveInt(saleId, 'DOCUMENT_REPLACEMENT_SALE_REQUIRED', 'saleId');
  const normalizedActorId = actorEmployeeId == null ? null : positiveInt(actorEmployeeId, 'DOCUMENT_REPLACEMENT_ACTOR_INVALID', 'actorEmployeeId');

  return prisma.$transaction(async (tx) => {
    const preparation = await findLockedPreparation(tx, { branchId: normalizedBranchId, saleId: normalizedSaleId });
    if (!preparation) fail('DOCUMENT_REPLACEMENT_PREPARATION_NOT_FOUND', 'Document preparation not found', 404);
    if (preparation.status !== 'LOCKED' || !preparation.finalSnapshot) {
      fail('DOCUMENT_REPLACEMENT_PREPARATION_NOT_LOCKED', 'Replacement requires a locked preparation snapshot', 409);
    }

    const draftKey = draftKeyFor(normalizedBranchId, preparation.id);
    const currentKey = currentKeyFor(normalizedBranchId, preparation.id);
    const draft = await findReplacementByDraftKey(tx, draftKey);
    if (!draft) {
      const current = await findCurrentReplacement(tx, currentKey);
      if (current?.status === 'LOCKED') {
        return Object.freeze({ replayed: true, replacement: presentReplacement(current), finalSnapshot: current.finalSnapshot || null });
      }
      fail('DOCUMENT_REPLACEMENT_DRAFT_NOT_FOUND', 'Replacement draft not found', 404);
    }
    if (draft.status !== 'DRAFT') fail('DOCUMENT_REPLACEMENT_LOCK_FORBIDDEN', 'Only a DRAFT replacement can be locked', 409);

    const lockedAt = new Date();
    const finalSnapshot = buildReplacementFinalSnapshot({
      replacement: draft,
      saleId: normalizedSaleId,
      lockedAt,
      lockedById: normalizedActorId,
    });

    const priorCurrent = await findCurrentReplacement(tx, currentKey);
    if (draft.replacesReplacementId != null && priorCurrent?.id !== draft.replacesReplacementId) {
      fail('DOCUMENT_REPLACEMENT_LINEAGE_CONFLICT', 'Current replacement changed while this draft was being prepared', 409);
    }
    if (draft.replacesReplacementId == null && priorCurrent) {
      fail('DOCUMENT_REPLACEMENT_LINEAGE_CONFLICT', 'A current replacement already exists for this preparation', 409);
    }

    if (priorCurrent) {
      const superseded = await tx.saleDocumentReplacement.updateMany({
        where: { id: priorCurrent.id, status: 'LOCKED', currentKey },
        data: {
          status: 'SUPERSEDED',
          currentKey: null,
          supersededAt: lockedAt,
          updatedById: normalizedActorId,
        },
      });
      if (superseded.count !== 1) {
        fail('DOCUMENT_REPLACEMENT_SUPERSEDE_CONFLICT', 'Current replacement changed during supersede', 409);
      }
    }

    const changed = await tx.saleDocumentReplacement.updateMany({
      where: { id: draft.id, status: 'DRAFT', draftKey, currentKey: null },
      data: {
        status: 'LOCKED',
        draftKey: null,
        currentKey,
        finalSnapshot,
        lockedById: normalizedActorId,
        lockedAt,
        updatedById: normalizedActorId,
      },
    });
    if (changed.count !== 1) {
      fail('DOCUMENT_REPLACEMENT_LOCK_CONFLICT', 'Replacement changed during lock', 409);
    }

    const locked = await findCurrentReplacement(tx, currentKey);
    if (!locked || locked.id !== draft.id) {
      fail('DOCUMENT_REPLACEMENT_CURRENT_AUTHORITY_FAILED', 'Locked replacement did not become current authority', 409);
    }

    return Object.freeze({
      replayed: false,
      replacement: presentReplacement(locked),
      finalSnapshot,
      supersededReplacementId: priorCurrent?.id || null,
    });
  });
};

module.exports = Object.freeze({
  buildReplacementFinalSnapshot,
  createSaleDocumentReplacement,
  currentKeyFor,
  draftKeyFor,
  getSaleDocumentReplacement,
  lockSaleDocumentReplacement,
  replaceSaleDocumentReplacementLines,
  seedLinesFromAuthority,
});
