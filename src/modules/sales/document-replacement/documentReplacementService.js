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

const findReplacementByDraftKey = (prisma, draftKey) => prisma.saleDocumentReplacement.findUnique({
  where: { draftKey },
  include: { lines: { orderBy: [{ portion: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }] } },
});

const findCurrentReplacement = (prisma, currentKey) => prisma.saleDocumentReplacement.findUnique({
  where: { currentKey },
  include: { lines: { orderBy: [{ portion: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }] } },
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
  const lines = Array.isArray(replacement.lines) ? replacement.lines : [];
  const { inBudgetLines, outOfBudgetLines } = splitLines(lines);
  return Object.freeze({
    ...replacement,
    lines,
    inBudgetLines,
    outOfBudgetLines,
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
        include: { lines: { orderBy: [{ portion: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }] } },
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

module.exports = Object.freeze({
  createSaleDocumentReplacement,
  currentKeyFor,
  draftKeyFor,
  getSaleDocumentReplacement,
  replaceSaleDocumentReplacementLines,
  seedLinesFromAuthority,
});
