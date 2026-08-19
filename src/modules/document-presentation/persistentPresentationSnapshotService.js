'use strict';

const { prisma } = require('../../../lib/prisma');
const { toCanonicalDocumentCode } = require('./canonicalDocumentIdentity');
const { resolveDocumentPresentation } = require('./presentationConfig');
const { createPresentationSnapshotEnvelope } = require('./presentationSnapshot');

const normalizeText = (value, field) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new TypeError(`${field} is required`);
  return normalized;
};

const getOrCreatePresentationSnapshot = async ({
  tx = prisma,
  branchId,
  sourceType,
  sourceId,
  documentPurpose,
  rendererFamily,
  storeConfig,
  perDocumentOverride = null,
  issuedAt = new Date(),
  businessSnapshot = null,
} = {}) => {
  const normalizedBranchId = Number(branchId);
  if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
    throw new TypeError('branchId is required');
  }

  const normalizedSourceType = normalizeText(sourceType, 'sourceType').toUpperCase();
  const normalizedSourceId = normalizeText(sourceId, 'sourceId');
  const canonicalPurpose = toCanonicalDocumentCode(documentPurpose);
  if (!canonicalPurpose) throw new TypeError('documentPurpose is required');
  const normalizedRenderer = normalizeText(rendererFamily, 'rendererFamily').toUpperCase();

  const key = {
    branchId: normalizedBranchId,
    sourceType: normalizedSourceType,
    sourceId: normalizedSourceId,
    documentPurpose: canonicalPurpose,
    rendererFamily: normalizedRenderer,
  };

  const existing = await tx.documentPresentationSnapshot.findUnique({
    where: {
      branchId_sourceType_sourceId_documentPurpose_rendererFamily: key,
    },
  });
  if (existing) return existing;

  const presentation = resolveDocumentPresentation({
    storeConfig,
    documentPurpose: canonicalPurpose,
    perDocumentOverride,
  });
  const envelope = createPresentationSnapshotEnvelope({
    businessSnapshot,
    presentation,
    documentPurpose: canonicalPurpose,
    rendererFamily: normalizedRenderer,
    issuedAt: new Date(issuedAt).toISOString(),
  });

  return tx.documentPresentationSnapshot.upsert({
    where: {
      branchId_sourceType_sourceId_documentPurpose_rendererFamily: key,
    },
    update: {},
    create: {
      ...key,
      snapshot: envelope,
      snapshotHash: envelope.snapshotHash,
      issuedAt: new Date(envelope.issuedAt),
    },
  });
};

module.exports = Object.freeze({
  getOrCreatePresentationSnapshot,
});
