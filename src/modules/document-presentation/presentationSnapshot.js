'use strict';

const crypto = require('node:crypto');
const { toCanonicalDocumentCode } = require('./canonicalDocumentIdentity');

const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const createPresentationSnapshotEnvelope = ({
  businessSnapshot = null,
  presentation,
  documentPurpose,
  rendererFamily,
  issuedAt = new Date().toISOString(),
} = {}) => {
  if (!presentation || typeof presentation !== 'object' || Array.isArray(presentation)) {
    throw new TypeError('presentation snapshot is required');
  }
  const canonical = toCanonicalDocumentCode(documentPurpose);
  if (!canonical) throw new TypeError('documentPurpose is required');
  const renderer = String(rendererFamily || '').trim().toUpperCase();
  if (!renderer) throw new TypeError('rendererFamily is required');

  const envelope = {
    snapshotVersion: 1,
    presentationVersion: Number(presentation.version || 2),
    documentPurpose: canonical,
    rendererFamily: renderer,
    issuedAt: String(issuedAt),
    businessSnapshot: businessSnapshot == null ? null : structuredClone(businessSnapshot),
    presentation: structuredClone(presentation),
  };
  const snapshotHash = crypto.createHash('sha256').update(stableStringify(envelope)).digest('hex');
  return Object.freeze({ ...envelope, snapshotHash });
};

module.exports = {
  createPresentationSnapshotEnvelope,
  stableStringify,
};
