'use strict';

const { prisma } = require('../../../../../lib/prisma');
const { getOrCreatePresentationSnapshot } = require('../../../document-presentation/persistentPresentationSnapshotService');

const positiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getPurchaseOrderPresentation = async (req, res, next) => {
  try {
    const branchId = positiveInt(req.user?.branchId);
    const purchaseOrderId = positiveInt(req.params?.id);
    if (!branchId) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authenticated branch is required' });
    }
    if (!purchaseOrderId) {
      return res.status(400).json({ code: 'PURCHASE_ORDER_ID_REQUIRED', message: 'Purchase order id is required' });
    }

    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, branchId },
      select: {
        id: true,
        code: true,
        date: true,
        createdAt: true,
        status: true,
        branch: { select: { documentHeaderConfig: true } },
      },
    });

    if (!purchaseOrder) {
      return res.status(404).json({ code: 'PURCHASE_ORDER_NOT_FOUND', message: 'Purchase order not found' });
    }

    const record = await getOrCreatePresentationSnapshot({
      branchId,
      sourceType: 'PURCHASE_ORDER',
      sourceId: purchaseOrder.id,
      documentPurpose: 'PURCHASE_ORDER',
      rendererFamily: 'A4',
      storeConfig: purchaseOrder.branch?.documentHeaderConfig || null,
      issuedAt: purchaseOrder.date || purchaseOrder.createdAt,
      businessSnapshot: {
        purchaseOrderId: purchaseOrder.id,
        code: purchaseOrder.code,
        status: purchaseOrder.status,
      },
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

module.exports = Object.freeze({ getPurchaseOrderPresentation });
