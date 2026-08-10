'use strict';

const { prisma } = require('../../../../../lib/prisma');
const repository = require('./inputTaxDecisionRepository');

const DUPLICATE_DECISIONS = new Set(['CONFIRMED_DUPLICATE', 'RESOLVED_NOT_DUPLICATE']);

const positiveInt = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), {
      code: 'INPUT_TAX_DECISION_INPUT_INVALID', statusCode: 400, details: { fieldName },
    });
  }
  return parsed;
};

const requiredText = (value, fieldName) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw Object.assign(new Error(`${fieldName} is required`), {
      code: 'INPUT_TAX_DECISION_REASON_REQUIRED', statusCode: 400, details: { fieldName },
    });
  }
  return normalized;
};

const cloneSnapshot = (document) => ({ ...(document?.snapshot || {}) });

const duplicateProjection = ({ document, branchId, taxDocumentId, replayed }) => Object.freeze({
  taxDocumentId,
  branchId,
  decisionType: 'DUPLICATE',
  decision: document.snapshot?.inputTaxDuplicateStatus || null,
  reason: document.snapshot?.inputTaxDuplicateReason || null,
  evidence: document.snapshot?.inputTaxDuplicateEvidence || null,
  decidedAt: document.snapshot?.inputTaxDuplicateDecidedAt || null,
  actorEmployeeId: document.snapshot?.inputTaxDuplicateDecidedByEmployeeId || null,
  updatedAt: document.updatedAt || null,
  replayed,
});

const replacementProjection = ({ document, branchId, taxDocumentId, replayed }) => Object.freeze({
  taxDocumentId,
  branchId,
  decisionType: 'REPLACEMENT',
  replacesTaxDocumentId: Number(document.snapshot?.replacesTaxDocumentId || 0) || null,
  reason: document.snapshot?.inputTaxReplacementReason || null,
  evidence: document.snapshot?.inputTaxReplacementEvidence || null,
  decidedAt: document.snapshot?.inputTaxReplacementDecidedAt || null,
  actorEmployeeId: document.snapshot?.inputTaxReplacementDecidedByEmployeeId || null,
  updatedAt: document.updatedAt || null,
  replayed,
});

const decideDuplicate = async ({ branchId, taxDocumentId, decision, reason, actorEmployeeId, evidence = null, decidedAt = new Date() }) => prisma.$transaction(async (tx) => {
  const normalizedBranchId = positiveInt(branchId, 'branchId');
  const normalizedDocumentId = positiveInt(taxDocumentId, 'taxDocumentId');
  const normalizedDecision = String(decision || '').trim().toUpperCase();
  const normalizedReason = requiredText(reason, 'reason');
  if (!DUPLICATE_DECISIONS.has(normalizedDecision)) {
    throw Object.assign(new Error('Unsupported duplicate decision'), {
      code: 'INPUT_TAX_DUPLICATE_DECISION_INVALID', statusCode: 400, details: { allowed: [...DUPLICATE_DECISIONS] },
    });
  }

  const document = await repository.findForUpdate({ branchId: normalizedBranchId, taxDocumentId: normalizedDocumentId }, tx);
  if (!document) {
    throw Object.assign(new Error('Tax document not found'), { code: 'TAX_DOCUMENT_NOT_FOUND', statusCode: 404 });
  }

  if (
    document.snapshot?.inputTaxDuplicateStatus === normalizedDecision
    && String(document.snapshot?.inputTaxDuplicateReason || '').trim() === normalizedReason
  ) {
    return duplicateProjection({ document, branchId: normalizedBranchId, taxDocumentId: normalizedDocumentId, replayed: true });
  }

  const snapshot = cloneSnapshot(document);
  snapshot.inputTaxDuplicateStatus = normalizedDecision;
  snapshot.inputTaxDuplicateReason = normalizedReason;
  snapshot.inputTaxDuplicateEvidence = evidence;
  snapshot.inputTaxDuplicateDecidedAt = decidedAt;
  snapshot.inputTaxDuplicateDecidedByEmployeeId = actorEmployeeId || null;

  const updated = await repository.replaceSnapshot({ branchId: normalizedBranchId, taxDocumentId: normalizedDocumentId, snapshot }, tx);
  await repository.appendDecisionEvent({
    taxDocumentId: normalizedDocumentId,
    eventType: normalizedDecision,
    reason: normalizedReason,
    actorEmployeeId,
    metadata: { decisionType: 'DUPLICATE', decision: normalizedDecision, evidence, decidedAt },
  }, tx);

  return duplicateProjection({
    document: { ...updated, snapshot },
    branchId: normalizedBranchId,
    taxDocumentId: normalizedDocumentId,
    replayed: false,
  });
});

const linkReplacement = async ({ branchId, taxDocumentId, replacesTaxDocumentId, reason, actorEmployeeId, evidence = null, decidedAt = new Date() }) => prisma.$transaction(async (tx) => {
  const normalizedBranchId = positiveInt(branchId, 'branchId');
  const normalizedDocumentId = positiveInt(taxDocumentId, 'taxDocumentId');
  const normalizedReplacedId = positiveInt(replacesTaxDocumentId, 'replacesTaxDocumentId');
  const normalizedReason = requiredText(reason, 'reason');
  if (normalizedDocumentId === normalizedReplacedId) {
    throw Object.assign(new Error('A tax document cannot replace itself'), { code: 'INPUT_TAX_REPLACEMENT_SELF_REFERENCE', statusCode: 409 });
  }

  const lockIds = [normalizedDocumentId, normalizedReplacedId].sort((a, b) => a - b);
  const locked = new Map();
  for (const id of lockIds) {
    const row = await repository.findForUpdate({ branchId: normalizedBranchId, taxDocumentId: id }, tx);
    if (row) locked.set(id, row);
  }
  const document = locked.get(normalizedDocumentId);
  const replacedDocument = locked.get(normalizedReplacedId);
  if (!document || !replacedDocument) {
    throw Object.assign(new Error('Replacement documents must exist in the same branch'), { code: 'INPUT_TAX_REPLACEMENT_DOCUMENT_NOT_FOUND', statusCode: 404 });
  }

  const currentParentId = Number(document.snapshot?.replacesTaxDocumentId || 0) || null;
  if (
    currentParentId === normalizedReplacedId
    && String(document.snapshot?.inputTaxReplacementReason || '').trim() === normalizedReason
  ) {
    return replacementProjection({ document, branchId: normalizedBranchId, taxDocumentId: normalizedDocumentId, replayed: true });
  }
  if (currentParentId && currentParentId !== normalizedReplacedId) {
    throw Object.assign(new Error('Replacement document is already linked to another source'), {
      code: 'INPUT_TAX_REPLACEMENT_ALREADY_LINKED', statusCode: 409, details: { currentParentId },
    });
  }

  const cursor = new Set([normalizedDocumentId]);
  let current = replacedDocument;
  while (current) {
    if (cursor.has(Number(current.id))) {
      throw Object.assign(new Error('Replacement chain cycle detected'), { code: 'INPUT_TAX_REPLACEMENT_CYCLE', statusCode: 409 });
    }
    cursor.add(Number(current.id));
    const parentId = Number(current.snapshot?.replacesTaxDocumentId || 0) || null;
    if (!parentId) break;
    current = locked.get(parentId) || await repository.findForUpdate({ branchId: normalizedBranchId, taxDocumentId: parentId }, tx);
    if (!current) break;
  }

  const snapshot = cloneSnapshot(document);
  snapshot.replacesTaxDocumentId = normalizedReplacedId;
  snapshot.inputTaxReplacementReason = normalizedReason;
  snapshot.inputTaxReplacementEvidence = evidence;
  snapshot.inputTaxReplacementDecidedAt = decidedAt;
  snapshot.inputTaxReplacementDecidedByEmployeeId = actorEmployeeId || null;

  const updated = await repository.replaceSnapshot({ branchId: normalizedBranchId, taxDocumentId: normalizedDocumentId, snapshot }, tx);
  await repository.appendDecisionEvent({
    taxDocumentId: normalizedDocumentId,
    eventType: 'ACTIVE_REPLACEMENT',
    reason: normalizedReason,
    actorEmployeeId,
    metadata: { decisionType: 'REPLACEMENT', replacesTaxDocumentId: normalizedReplacedId, evidence, decidedAt },
  }, tx);

  return replacementProjection({
    document: { ...updated, snapshot },
    branchId: normalizedBranchId,
    taxDocumentId: normalizedDocumentId,
    replayed: false,
  });
});

module.exports = Object.freeze({ DUPLICATE_DECISIONS, decideDuplicate, linkReplacement });