'use strict';

const { prisma } = require('../../../../../lib/prisma');
const repository = require('./inputTaxDecisionRepository');

const DUPLICATE_DECISIONS = new Set(['CONFIRMED_DUPLICATE', 'RESOLVED_NOT_DUPLICATE']);

const positiveInt = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), {
      code: 'INPUT_TAX_DECISION_INPUT_INVALID',
      statusCode: 400,
      details: { fieldName },
    });
  }
  return parsed;
};

const requiredText = (value, fieldName) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw Object.assign(new Error(`${fieldName} is required`), {
      code: 'INPUT_TAX_DECISION_REASON_REQUIRED',
      statusCode: 400,
      details: { fieldName },
    });
  }
  return normalized;
};

const cloneSnapshot = (document) => ({ ...(document?.snapshot || {}) });

const decideDuplicate = async ({
  branchId,
  taxDocumentId,
  decision,
  reason,
  actorEmployeeId,
  evidence = null,
  decidedAt = new Date(),
}) => prisma.$transaction(async (tx) => {
  const normalizedBranchId = positiveInt(branchId, 'branchId');
  const normalizedDocumentId = positiveInt(taxDocumentId, 'taxDocumentId');
  const normalizedDecision = String(decision || '').trim().toUpperCase();
  if (!DUPLICATE_DECISIONS.has(normalizedDecision)) {
    throw Object.assign(new Error('Unsupported duplicate decision'), {
      code: 'INPUT_TAX_DUPLICATE_DECISION_INVALID',
      statusCode: 400,
      details: { allowed: [...DUPLICATE_DECISIONS] },
    });
  }

  const document = await repository.findForUpdate({
    branchId: normalizedBranchId,
    taxDocumentId: normalizedDocumentId,
  }, tx);
  if (!document) {
    throw Object.assign(new Error('Tax document not found'), {
      code: 'TAX_DOCUMENT_NOT_FOUND',
      statusCode: 404,
    });
  }

  const snapshot = cloneSnapshot(document);
  snapshot.inputTaxDuplicateStatus = normalizedDecision;
  snapshot.inputTaxDuplicateReason = requiredText(reason, 'reason');
  snapshot.inputTaxDuplicateEvidence = evidence;
  snapshot.inputTaxDuplicateDecidedAt = decidedAt;
  snapshot.inputTaxDuplicateDecidedByEmployeeId = actorEmployeeId || null;

  const updated = await repository.replaceSnapshot({
    branchId: normalizedBranchId,
    taxDocumentId: normalizedDocumentId,
    snapshot,
  }, tx);
  await repository.appendDecisionEvent({
    taxDocumentId: normalizedDocumentId,
    eventType: normalizedDecision,
    reason: snapshot.inputTaxDuplicateReason,
    actorEmployeeId,
    metadata: {
      decisionType: 'DUPLICATE',
      decision: normalizedDecision,
      evidence,
      decidedAt,
    },
  }, tx);

  return Object.freeze({
    taxDocumentId: normalizedDocumentId,
    branchId: normalizedBranchId,
    decisionType: 'DUPLICATE',
    decision: normalizedDecision,
    reason: snapshot.inputTaxDuplicateReason,
    evidence,
    decidedAt,
    actorEmployeeId: actorEmployeeId || null,
    updatedAt: updated?.updatedAt || null,
  });
});

const linkReplacement = async ({
  branchId,
  taxDocumentId,
  replacesTaxDocumentId,
  reason,
  actorEmployeeId,
  evidence = null,
  decidedAt = new Date(),
}) => prisma.$transaction(async (tx) => {
  const normalizedBranchId = positiveInt(branchId, 'branchId');
  const normalizedDocumentId = positiveInt(taxDocumentId, 'taxDocumentId');
  const normalizedReplacedId = positiveInt(replacesTaxDocumentId, 'replacesTaxDocumentId');
  if (normalizedDocumentId === normalizedReplacedId) {
    throw Object.assign(new Error('A tax document cannot replace itself'), {
      code: 'INPUT_TAX_REPLACEMENT_SELF_REFERENCE',
      statusCode: 409,
    });
  }

  const [document, replacedDocument] = await Promise.all([
    repository.findForUpdate({ branchId: normalizedBranchId, taxDocumentId: normalizedDocumentId }, tx),
    repository.findForUpdate({ branchId: normalizedBranchId, taxDocumentId: normalizedReplacedId }, tx),
  ]);
  if (!document || !replacedDocument) {
    throw Object.assign(new Error('Replacement documents must exist in the same branch'), {
      code: 'INPUT_TAX_REPLACEMENT_DOCUMENT_NOT_FOUND',
      statusCode: 404,
    });
  }

  const currentParentId = Number(document.snapshot?.replacesTaxDocumentId || 0) || null;
  if (currentParentId && currentParentId !== normalizedReplacedId) {
    throw Object.assign(new Error('Replacement document is already linked to another source'), {
      code: 'INPUT_TAX_REPLACEMENT_ALREADY_LINKED',
      statusCode: 409,
      details: { currentParentId },
    });
  }

  const cursor = new Set([normalizedDocumentId]);
  let current = replacedDocument;
  while (current) {
    if (cursor.has(Number(current.id))) {
      throw Object.assign(new Error('Replacement chain cycle detected'), {
        code: 'INPUT_TAX_REPLACEMENT_CYCLE',
        statusCode: 409,
      });
    }
    cursor.add(Number(current.id));
    const parentId = Number(current.snapshot?.replacesTaxDocumentId || 0) || null;
    if (!parentId) break;
    current = await repository.findForUpdate({ branchId: normalizedBranchId, taxDocumentId: parentId }, tx);
    if (!current) break;
  }

  const snapshot = cloneSnapshot(document);
  snapshot.replacesTaxDocumentId = normalizedReplacedId;
  snapshot.inputTaxReplacementReason = requiredText(reason, 'reason');
  snapshot.inputTaxReplacementEvidence = evidence;
  snapshot.inputTaxReplacementDecidedAt = decidedAt;
  snapshot.inputTaxReplacementDecidedByEmployeeId = actorEmployeeId || null;

  const updated = await repository.replaceSnapshot({
    branchId: normalizedBranchId,
    taxDocumentId: normalizedDocumentId,
    snapshot,
  }, tx);
  await repository.appendDecisionEvent({
    taxDocumentId: normalizedDocumentId,
    eventType: 'ACTIVE_REPLACEMENT',
    reason: snapshot.inputTaxReplacementReason,
    actorEmployeeId,
    metadata: {
      decisionType: 'REPLACEMENT',
      replacesTaxDocumentId: normalizedReplacedId,
      evidence,
      decidedAt,
    },
  }, tx);

  return Object.freeze({
    taxDocumentId: normalizedDocumentId,
    branchId: normalizedBranchId,
    decisionType: 'REPLACEMENT',
    replacesTaxDocumentId: normalizedReplacedId,
    reason: snapshot.inputTaxReplacementReason,
    evidence,
    decidedAt,
    actorEmployeeId: actorEmployeeId || null,
    updatedAt: updated?.updatedAt || null,
  });
});

module.exports = Object.freeze({
  DUPLICATE_DECISIONS,
  decideDuplicate,
  linkReplacement,
});
