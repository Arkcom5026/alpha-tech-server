const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const { createServiceAssetNo } = require('../utils/serviceAssetCode');

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function repositoryFor(repo) {
  if (
    repo?.findServiceAsset &&
    repo?.findServiceAssetBySourceStockItem &&
    repo?.createServiceAsset &&
    repo?.updateServiceAsset
  ) {
    return repo;
  }
  return new ServiceAssetRepository(repo?.prisma);
}

function assertAssetAuthority(asset, actor, customerId) {
  if (!asset) {
    throw new RepairError(
      RepairFailureCode.SERVICE_ASSET_NOT_FOUND,
      'ไม่พบอุปกรณ์บริการในระบบ',
      404
    );
  }

  if (Number(asset.branchId) !== Number(actor.branchId)) {
    throw new RepairError(
      RepairFailureCode.SERVICE_ASSET_BRANCH_MISMATCH,
      'อุปกรณ์บริการไม่ได้อยู่ในสาขานี้',
      409
    );
  }

  if (Number(asset.customerId) !== Number(customerId)) {
    throw new RepairError(
      RepairFailureCode.SERVICE_ASSET_CUSTOMER_MISMATCH,
      'อุปกรณ์บริการไม่ได้เป็นของลูกค้ารายนี้',
      409
    );
  }

  if (asset.status === 'ARCHIVED') {
    throw new RepairError(
      RepairFailureCode.SERVICE_ASSET_ARCHIVED,
      'อุปกรณ์บริการถูกเก็บถาวรแล้ว',
      409
    );
  }

  return asset;
}

function stockAssetData(actor, customerId, stockItem) {
  return {
    assetNo: createServiceAssetNo(actor.branchId),
    branchId: actor.branchId,
    customerId,
    sourceStockItemId: stockItem.id,
    productId: stockItem.productId || stockItem.product?.id || null,
    productTypeId:
      stockItem.product?.productTypeId || stockItem.product?.productType?.id || null,
    brandId: stockItem.product?.brandId || stockItem.product?.brand?.id || null,
    createdByEmployeeId: actor.employeeId || null,
    source: 'SOLD_BY_BRANCH',
    status: 'IN_SERVICE',
    deviceType:
      stockItem.product?.productType?.name ||
      stockItem.product?.name ||
      'อุปกรณ์',
    brandNameSnapshot: stockItem.product?.brand?.name || null,
    modelName:
      stockItem.product?.name ||
      stockItem.serialNumber ||
      stockItem.barcode ||
      'ไม่ระบุรุ่น',
    serialNumber: normalizeText(stockItem.serialNumber),
    description: normalizeText(stockItem.product?.description),
    purchaseDate: stockItem.soldAt || null,
    externalWarrantyUntil: stockItem.expiredAt || null,
    metadata: {
      createdFrom: 'REPAIR_INTAKE_STOCK_ITEM',
      barcode: stockItem.barcode || null,
    },
  };
}

function externalAssetData(actor, payload) {
  const deviceType = normalizeText(payload.deviceType) || 'อุปกรณ์';
  const modelName = normalizeText(payload.modelName || payload.deviceModel);

  if (!modelName) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      'กรุณาระบุรุ่นหรือรายละเอียดอุปกรณ์',
      400,
      { field: 'modelName' }
    );
  }

  return {
    assetNo: createServiceAssetNo(actor.branchId),
    branchId: actor.branchId,
    customerId: payload.customerId,
    createdByEmployeeId: actor.employeeId || null,
    source: 'EXTERNAL_CUSTOMER',
    status: 'IN_SERVICE',
    deviceType,
    brandNameSnapshot: normalizeText(payload.brandName),
    modelName,
    serialNumber: normalizeText(payload.serialNumber),
    customerAssetTag: normalizeText(payload.customerAssetTag),
    color: normalizeText(payload.color),
    description: normalizeText(payload.assetDescription),
    accessories: Array.isArray(payload.accessories)
      ? payload.accessories.map((item) => String(item).trim()).filter(Boolean)
      : [],
    physicalCondition: normalizeText(payload.physicalCondition),
    accessInstructions: normalizeText(payload.accessInstructions),
    purchaseSource: normalizeText(payload.purchaseSource),
    purchaseDate: payload.purchaseDate || null,
    externalWarrantyUntil: payload.externalWarrantyUntil || null,
    externalWarrantyNote: normalizeText(payload.externalWarrantyNote),
    metadata: {
      createdFrom: 'REPAIR_INTAKE_EXTERNAL_DEVICE',
    },
  };
}

class ServiceAssetService {
  async resolveForRepairIntake(repo, actor, payload, stockItem = null) {
    const assetRepo = repositoryFor(repo);

    if (payload.serviceAssetId) {
      const selected = await assetRepo.findServiceAsset(
        actor.branchId,
        payload.serviceAssetId
      );
      assertAssetAuthority(selected, actor, payload.customerId);

      if (selected.status !== 'IN_SERVICE') {
        return assetRepo.updateServiceAsset(selected.id, { status: 'IN_SERVICE' });
      }
      return selected;
    }

    if (stockItem) {
      const existing = await assetRepo.findServiceAssetBySourceStockItem(
        stockItem.id
      );
      if (existing) {
        assertAssetAuthority(existing, actor, payload.customerId);
        if (existing.status !== 'IN_SERVICE') {
          return assetRepo.updateServiceAsset(existing.id, {
            status: 'IN_SERVICE',
          });
        }
        return existing;
      }

      return assetRepo.createServiceAsset(
        stockAssetData(actor, payload.customerId, stockItem)
      );
    }

    return assetRepo.createServiceAsset(externalAssetData(actor, payload));
  }
}

module.exports = new ServiceAssetService();
module.exports.ServiceAssetService = ServiceAssetService;
module.exports.assertAssetAuthority = assertAssetAuthority;
module.exports.stockAssetData = stockAssetData;
module.exports.externalAssetData = externalAssetData;
