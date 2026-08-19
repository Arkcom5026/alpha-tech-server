'use strict';

const { prisma } = require('../../../../../lib/prisma');
const {
  ensureStatutoryTaxPresentationSnapshot,
} = require('./statutoryTaxPresentationService');

const positiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getStatutoryTaxPresentation = async (req, res, next) => {
  try {
    const authenticatedBranchId = positiveInt(req.user?.branchId);
    const requestedBranchId = positiveInt(req.query?.branchId);
    const taxDocumentId = positiveInt(req.params?.taxDocumentId);

    if (!authenticatedBranchId) {
      return res.status(401).json({ code: 'TAX_BRANCH_REQUIRED', message: 'Authenticated branch is required' });
    }
    if (requestedBranchId && requestedBranchId !== authenticatedBranchId) {
      return res.status(403).json({ code: 'TAX_BRANCH_FORBIDDEN', message: 'Cross-branch tax presentation access is forbidden' });
    }
    if (!taxDocumentId) {
      return res.status(400).json({ code: 'TAX_DOCUMENT_ID_REQUIRED', message: 'Tax document id is required' });
    }

    const taxDocument = await prisma.taxDocument.findFirst({
      where: { id: taxDocumentId, branchId: authenticatedBranchId },
      select: {
        id: true,
        branchId: true,
        documentType: true,
        status: true,
        taxInvoiceKind: true,
        issuedAt: true,
        issuedDocumentNumber: true,
        issuerSnapshot: true,
        recipientSnapshot: true,
      },
    });
    if (!taxDocument) {
      return res.status(404).json({ code: 'TAX_DOCUMENT_NOT_FOUND', message: 'Tax document not found' });
    }

    const record = await ensureStatutoryTaxPresentationSnapshot({
      branchId: authenticatedBranchId,
      taxDocument,
    });

    return res.status(200).json({
      ok: true,
      data: {
        snapshotId: record.id,
        snapshotHash: record.snapshotHash,
        presentationSnapshot: record.snapshot,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({ getStatutoryTaxPresentation });
