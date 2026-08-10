const repository = require('./getWarrantyReplacementOptionsRepository');
const { RepairError, RepairFailureCode } = require('../../contracts/repairError');

function positiveId(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RepairError(RepairFailureCode.INVALID_INPUT, `${field} ต้องเป็นจำนวนเต็มมากกว่า 0`, 400, { field });
  }
  return parsed;
}

class GetWarrantyReplacementOptionsService {
  constructor(repo = repository) {
    this.repository = repo;
  }

  async execute(actor, rawClaimId, rawQuery = '') {
    const claimId = positiveId(rawClaimId, 'claimId');
    const branchId = positiveId(actor?.branchId, 'actor.branchId');
    const query = String(rawQuery || '').trim().slice(0, 160);
    const claim = await this.repository.findClaim(branchId, claimId);
    if (!claim) {
      throw new RepairError(RepairFailureCode.WARRANTY_CLAIM_NOT_FOUND, 'ไม่พบรายการเคลมในสาขานี้', 404);
    }
    if (!['APPROVED', 'REPLACEMENT_PENDING'].includes(claim.status)) {
      throw new RepairError(RepairFailureCode.INVALID_CLAIM_TRANSITION, 'รายการเคลมยังไม่อยู่ในขั้นเลือกสินค้าทดแทน', 409, { status: claim.status });
    }

    const preferredProductId = claim.stockItem?.productId || null;
    const rows = await this.repository.searchAvailableStock(branchId, query, preferredProductId);
    const options = rows
      .filter((item) => Number(item.id) !== Number(claim.stockItemId))
      .map((item) => ({
        id: item.id,
        barcode: item.barcode,
        serialNumber: item.serialNumber || null,
        productId: item.productId,
        productName: item.product?.name || null,
        brandName: item.product?.brand?.name || null,
        preferredMatch: preferredProductId ? Number(item.productId) === Number(preferredProductId) : false,
      }))
      .sort((a, b) => Number(b.preferredMatch) - Number(a.preferredMatch));

    return { claimId, preferredProductId, options };
  }
}

module.exports = new GetWarrantyReplacementOptionsService();
module.exports.GetWarrantyReplacementOptionsService = GetWarrantyReplacementOptionsService;
module.exports.positiveId = positiveId;
