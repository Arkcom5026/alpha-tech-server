const repository = require('./getRepairPartStockOptionsRepository');
const { RepairError, RepairFailureCode } = require('../../contracts/repairError');
const { CLAIM_ACTIVE_STATUSES } = require('../../contracts/repairContract');

function positiveId(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RepairError(RepairFailureCode.INVALID_INPUT, `${field} ต้องเป็นจำนวนเต็มมากกว่า 0`, 400, { field });
  }
  return parsed;
}

function activeWarrantyClaim(job) {
  return (job?.warrantyClaims || []).find((claim) => CLAIM_ACTIVE_STATUSES.includes(claim.status)) || null;
}

class GetRepairPartStockOptionsService {
  constructor(repo = repository) {
    this.repository = repo;
  }

  async execute(actor, rawRepairJobId, query = {}) {
    const repairJobId = positiveId(rawRepairJobId, 'repairJobId');
    const productId = positiveId(query.productId, 'productId');
    const search = String(query.q || '').trim().slice(0, 160);

    const job = await this.repository.findRepairJob(actor.branchId, repairJobId);
    if (!job) {
      throw new RepairError(RepairFailureCode.REPAIR_JOB_NOT_FOUND, 'ไม่พบใบงานซ่อมในสาขานี้', 404);
    }

    const activeClaim = activeWarrantyClaim(job);
    if (activeClaim) {
      throw new RepairError(
        RepairFailureCode.CONFLICT,
        'ใบงานอยู่ระหว่างเคลม กรุณาดำเนินรายการเคลมให้จบก่อนเลือกอะไหล่เพิ่ม',
        409,
        { warrantyClaimId: activeClaim.id, claimNo: activeClaim.claimNo, claimStatus: activeClaim.status }
      );
    }

    const workflowEvent = job.deviceId
      ? await this.repository.findLatestWorkflowEvent(actor.branchId, job.id, job.deviceId)
      : null;
    const workflowStatus = workflowEvent?.metadata?.workflowTargetStatus || 'RECEIVED';
    if (workflowStatus !== 'REPAIRING') {
      throw new RepairError(
        RepairFailureCode.CONFLICT,
        'เลือกอะไหล่จาก Inventory ได้เฉพาะขณะงานอยู่ในขั้นกำลังซ่อม',
        409,
        { workflowStatus, requiredWorkflowStatus: 'REPAIRING' }
      );
    }

    const product = await this.repository.findProduct(productId);
    if (!product || !product.active || (product.branchId && Number(product.branchId) !== Number(actor.branchId))) {
      throw new RepairError(RepairFailureCode.PART_PRODUCT_NOT_FOUND, 'ไม่พบสินค้าอะไหล่ที่ใช้งานได้ในสาขานี้', 404);
    }
    if (product.inventoryBehavior === 'NON_STOCK') {
      throw new RepairError(RepairFailureCode.CONFLICT, 'อะไหล่ต้องผ่านการรับเข้า Inventory และพร้อมใช้งานก่อน', 409);
    }
    if (!product.trackSerialNumber) {
      return {
        mode: 'QUANTITY',
        product: { id: product.id, name: product.name, trackSerialNumber: false },
        items: [],
      };
    }

    const items = await this.repository.findAvailableStockItems(actor.branchId, productId, search);
    return {
      mode: 'SERIALIZED',
      product: { id: product.id, name: product.name, trackSerialNumber: true },
      items: items.map((item) => ({
        id: item.id,
        barcode: item.barcode,
        serialNumber: item.serialNumber,
        status: item.status,
        receivedAt: item.receivedAt,
        locationCode: item.locationCode,
        costPrice: item.costPrice == null ? null : Number(item.costPrice),
      })),
    };
  }
}

module.exports = new GetRepairPartStockOptionsService();
module.exports.GetRepairPartStockOptionsService = GetRepairPartStockOptionsService;
module.exports.positiveId = positiveId;
module.exports.activeWarrantyClaim = activeWarrantyClaim;
