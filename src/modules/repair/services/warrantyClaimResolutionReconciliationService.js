const { RepairError, RepairFailureCode } = require('../contracts/repairError');

const RETURNED_TO_CUSTOMER_RESOLUTIONS = new Set([
  'REPAIRED',
  'RETURNED_UNCHANGED',
  'REJECTED',
]);

function metadataObject(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata
    : {};
}

function reconciliationHistory(metadata) {
  const history = metadataObject(metadata).warrantyClaimReconciliations;
  return Array.isArray(history) ? history : [];
}

function stockStatusForOriginal(resolution) {
  if (RETURNED_TO_CUSTOMER_RESOLUTIONS.has(resolution)) return 'SOLD';
  if (resolution === 'WRITTEN_OFF') return 'DAMAGED';
  return 'CLAIMED';
}

function movementTypeForResolution(resolution) {
  if (RETURNED_TO_CUSTOMER_RESOLUTIONS.has(resolution)) return 'CLAIM_RETURN';
  if (resolution === 'REPLACED') return 'CLAIM_REPLACEMENT';
  if (resolution === 'WRITTEN_OFF') return 'CLAIM_WRITE_OFF';
  return 'CLAIM_RETURN';
}

function assetStatusForResolution(resolution) {
  return resolution === 'WRITTEN_OFF' ? 'ARCHIVED' : 'IN_SERVICE';
}

function assertReplacementEligible(claim, replacement) {
  if (!replacement) {
    throw new RepairError(
      RepairFailureCode.WARRANTY_REPLACEMENT_REQUIRED,
      'ไม่พบสินค้าทดแทนสำหรับผลการเคลมแบบเปลี่ยนสินค้า',
      404
    );
  }
  if (Number(replacement.branchId) !== Number(claim.branchId)) {
    throw new RepairError(
      RepairFailureCode.STOCK_ITEM_NOT_FOUND,
      'สินค้าทดแทนไม่ได้อยู่ในสาขาของรายการเคลม',
      409
    );
  }
  if (!['IN_STOCK', 'RETURNED'].includes(replacement.status)) {
    throw new RepairError(
      RepairFailureCode.CONFLICT,
      'สินค้าทดแทนไม่อยู่ในสถานะที่สามารถส่งมอบให้ลูกค้าได้',
      409,
      { replacementStockItemId: replacement.id, currentStatus: replacement.status }
    );
  }
}

class WarrantyClaimResolutionReconciliationService {
  async reconcile({ repo, assetRepo, actor, claim, payload, updatedClaim, asset }) {
    if (payload.status !== 'RESOLVED') return null;

    const resolution = payload.resolution;
    const resolvedAt = updatedClaim.resolvedAt || new Date();
    const resolvedAtIso = new Date(resolvedAt).toISOString();
    const originalStockItem = claim.stockItem;
    const originalPreviousStatus = originalStockItem?.status || null;
    const originalResultingStatus = stockStatusForOriginal(resolution);

    let replacement = null;
    if (resolution === 'REPLACED') {
      replacement = await repo.findStockItemByIdForIntake(
        payload.replacementStockItemId
      );
      assertReplacementEligible(claim, replacement);
    }

    if (originalStockItem) {
      await repo.prisma.stockItem.update({
        where: { id: Number(originalStockItem.id) },
        data: { status: originalResultingStatus },
      });

      await repo.createStockMovement({
        productId: originalStockItem.productId,
        branchId: claim.branchId,
        qty: 0,
        type: movementTypeForResolution(resolution),
        refType: 'WARRANTY_CLAIM_RESOLUTION',
        refId: claim.id,
        stockItemId: originalStockItem.id,
        previousStockStatus: originalPreviousStatus,
        resultingStockStatus: originalResultingStatus,
        note: `ปรับสถานะสินค้าจากผลเคลม ${claim.claimNo}: ${resolution}`,
        performedByEmployeeId: actor.employeeId,
      });
    }

    if (replacement) {
      await repo.prisma.stockItem.update({
        where: { id: Number(replacement.id) },
        data: {
          status: 'SOLD',
          soldAt: resolvedAt,
        },
      });

      await repo.createStockMovement({
        productId: replacement.productId,
        branchId: claim.branchId,
        qty: 0,
        type: 'CLAIM_REPLACEMENT',
        refType: 'WARRANTY_CLAIM_REPLACEMENT',
        refId: claim.id,
        stockItemId: replacement.id,
        previousStockStatus: replacement.status,
        resultingStockStatus: 'SOLD',
        note: `ส่งมอบสินค้าทดแทนจากผลเคลม ${claim.claimNo}`,
        performedByEmployeeId: actor.employeeId,
      });
    }

    const assetMetadata = metadataObject(asset.metadata);
    const history = reconciliationHistory(assetMetadata);
    const reconciliation = {
      warrantyClaimId: claim.id,
      claimNo: claim.claimNo,
      repairJobId: claim.repairJobId || null,
      resolution,
      originalStockItemId: claim.stockItemId,
      originalPreviousStatus,
      originalResultingStatus,
      replacementStockItemId: replacement?.id || null,
      replacementPreviousStatus: replacement?.status || null,
      replacementResultingStatus: replacement ? 'SOLD' : null,
      creditAmount:
        payload.creditAmount === null || payload.creditAmount === undefined
          ? null
          : Number(payload.creditAmount),
      serviceAssetStatus: assetStatusForResolution(resolution),
      reconciledByEmployeeId: actor.employeeId,
      reconciledAt: resolvedAtIso,
    };

    const assetData = {
      status: assetStatusForResolution(resolution),
      ...(resolution === 'WRITTEN_OFF' ? { archivedAt: resolvedAt } : {}),
      ...(replacement
        ? {
            sourceStockItemId: replacement.id,
            productId: replacement.productId,
            serialNumber: replacement.serialNumber || asset.serialNumber,
          }
        : {}),
      metadata: {
        ...assetMetadata,
        warrantyClaimReconciliations: [...history, reconciliation],
        latestWarrantyClaimReconciliation: reconciliation,
        ...(replacement
          ? {
              previousSourceStockItemId: claim.stockItemId,
              replacementSourceStockItemId: replacement.id,
            }
          : {}),
      },
    };

    await assetRepo.updateServiceAsset(asset.id, assetData);
    return reconciliation;
  }
}

module.exports = new WarrantyClaimResolutionReconciliationService();
module.exports.WarrantyClaimResolutionReconciliationService =
  WarrantyClaimResolutionReconciliationService;
module.exports.reconciliationHistory = reconciliationHistory;
module.exports.stockStatusForOriginal = stockStatusForOriginal;
module.exports.assetStatusForResolution = assetStatusForResolution;
module.exports.assertReplacementEligible = assertReplacementEligible;
