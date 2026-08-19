'use strict';

const { getOrCreatePresentationSnapshot } = require('./persistentPresentationSnapshotService');
const { RENDERER_FAMILIES, getDocumentPresentationCapability } = require('./presentationCapabilityRegistry');
const { toCanonicalDocumentCode } = require('./canonicalDocumentIdentity');

const freezeFinanceOperationalPresentation = async ({
  tx,
  branchId,
  sourceType,
  sourceId,
  documentPurpose,
  issuedAt = new Date(),
  businessSnapshot = null,
} = {}) => {
  const canonicalPurpose = toCanonicalDocumentCode(documentPurpose);
  const capability = getDocumentPresentationCapability(canonicalPurpose);
  if (!capability || capability.className !== 'FINANCE_OPERATIONAL') {
    throw new TypeError('finance-operational documentPurpose is required');
  }

  const branch = await tx.branch.findFirst({
    where: { id: Number(branchId) },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      taxId: true,
      branchCode: true,
      isHeadOffice: true,
      slug: true,
      documentHeaderConfig: true,
    },
  });
  if (!branch) throw new Error('BRANCH_NOT_FOUND');

  const storeIdentity = {
    id: branch.id,
    name: branch.name || null,
    address: branch.address || null,
    phone: branch.phone || null,
    taxId: branch.taxId || null,
    branchCode: branch.branchCode || null,
    isHeadOffice: Boolean(branch.isHeadOffice),
    slug: branch.slug || null,
  };
  const frozenBusinessSnapshot = {
    ...(businessSnapshot && typeof businessSnapshot === 'object' && !Array.isArray(businessSnapshot)
      ? businessSnapshot
      : {}),
    storeIdentity,
  };

  const rendererFamilies = capability.rendererFamilies.filter((family) => (
    family === RENDERER_FAMILIES.A4 || family === RENDERER_FAMILIES.THERMAL_80MM
  ));

  const snapshots = {};
  for (const rendererFamily of rendererFamilies) {
    snapshots[rendererFamily] = await getOrCreatePresentationSnapshot({
      tx,
      branchId: branch.id,
      sourceType,
      sourceId,
      documentPurpose: canonicalPurpose,
      rendererFamily,
      storeConfig: branch.documentHeaderConfig,
      issuedAt,
      businessSnapshot: frozenBusinessSnapshot,
    });
  }
  return snapshots;
};

module.exports = Object.freeze({
  freezeFinanceOperationalPresentation,
});
