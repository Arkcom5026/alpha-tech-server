'use strict';

const { prisma } = require('../../../../../lib/prisma');
const { resolveDocumentPresentation } = require('../../../document-presentation/presentationConfig');
const { getOrCreatePresentationSnapshot } = require('../../../document-presentation/persistentPresentationSnapshotService');

const positiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getCombinedBillingPresentation = async (req, res, next) => {
  try {
    const branchId = positiveInt(req.user?.branchId);
    const documentId = positiveInt(req.params?.id);
    if (!branchId) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authenticated branch is required' });
    if (!documentId) return res.status(400).json({ code: 'COMBINED_BILLING_ID_REQUIRED', message: 'Combined billing id is required' });

    const document = await prisma.combinedBillingDocument.findFirst({
      where: { id: documentId, branchId },
      select: {
        id: true,
        code: true,
        issueDate: true,
        createdAt: true,
        status: true,
        branch: { select: { documentHeaderConfig: true } },
      },
    });
    if (!document) return res.status(404).json({ code: 'COMBINED_BILLING_NOT_FOUND', message: 'Combined billing document not found' });

    const storeConfig = document.branch?.documentHeaderConfig || null;
    if (document.status === 'DRAFT') {
      const presentation = resolveDocumentPresentation({
        storeConfig,
        documentPurpose: 'COMBINED_BILLING',
      });
      return res.status(200).json({
        ok: true,
        data: {
          persisted: false,
          snapshotId: null,
          snapshotHash: null,
          presentationSnapshot: { presentation },
        },
      });
    }

    const record = await getOrCreatePresentationSnapshot({
      branchId,
      sourceType: 'COMBINED_BILLING',
      sourceId: document.id,
      documentPurpose: 'COMBINED_BILLING',
      rendererFamily: 'A4',
      storeConfig,
      issuedAt: document.issueDate || document.createdAt,
      businessSnapshot: {
        combinedBillingId: document.id,
        code: document.code,
        status: document.status,
      },
    });

    return res.status(200).json({
      ok: true,
      data: {
        persisted: true,
        snapshotId: record.id,
        snapshotHash: record.snapshotHash,
        presentationSnapshot: record.snapshot,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({ getCombinedBillingPresentation });
