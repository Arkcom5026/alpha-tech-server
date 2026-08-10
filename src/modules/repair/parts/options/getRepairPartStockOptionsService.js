const repository = require('./getRepairPartStockOptionsRepository');
const { RepairError, RepairFailureCode } = require('../../contracts/repairError');

function positiveId(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RepairError(RepairFailureCode.INVALID_INPUT, `${field} ต้องเป็นจำนวนเต็มมากกว่า 0`, 400, { field });
  }
  return parsed;
}

class GetRepairPartStockOptionsService {
  constructor(repo = repository) {
    this.repository = repo;
  }

  async execute(actor, rawRepairJobId, query = {}) {
    const repairJobId = positiveId(rawRepairJobId, 'repairJobId');
    const productId = positiveId(query.productId, 'productId');
    const search = String(query.q || '').trim().slice(0, 160);

    const [job, product] = await Promise.all([
      this.repository.findRepairJob(actor.branchId, repairJobId),
      this.repository.findProduct(productId),
    ]);

    if (!job) {
      throw new RepairError(RepairFailureCode.REPAIR_JOB_NOT_FOUND, 'ไม่พบใบงานซ่อมในสาขานี้', 404);
    }
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
