const repository = require('./addRepairPartRepository');
const { validateAddPart } = require('../validators/repairValidator');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');
const { CLAIM_ACTIVE_STATUSES } = require('../contracts/repairContract');

function positiveRepairJobId(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      'repairJobId ต้องเป็นจำนวนเต็มมากกว่า 0',
      400,
      { field: 'repairJobId' }
    );
  }
  return parsed;
}

function currentWorkflowStatus(event) {
  return event?.metadata?.workflowTargetStatus || 'RECEIVED';
}

function activeWarrantyClaim(job) {
  return (job?.warrantyClaims || []).find((claim) =>
    CLAIM_ACTIVE_STATUSES.includes(claim.status)
  ) || null;
}

function assertPartInventoryMode(product, payload, actor) {
  if (product.inventoryBehavior === 'NON_STOCK') {
    throw new RepairError(
      RepairFailureCode.CONFLICT,
      'อะไหล่สำหรับงานซ่อมต้องเป็นสินค้าที่รับเข้าและมีสต๊อกพร้อมใช้งานก่อนเสมอ',
      409,
      { productId: product.id, inventoryBehavior: product.inventoryBehavior }
    );
  }

  if (product.branchId && Number(product.branchId) !== Number(actor.branchId)) {
    throw new RepairError(
      RepairFailureCode.PART_PRODUCT_NOT_FOUND,
      'ไม่พบสินค้าอะไหล่ที่ใช้งานได้ในสาขานี้',
      404
    );
  }

  if (product.trackSerialNumber) {
    if (!payload.stockItemId) {
      throw new RepairError(
        RepairFailureCode.INVALID_INPUT,
        'สินค้านี้ติดตาม Serial/StockItem กรุณาเลือกชิ้นที่อยู่ในสถานะพร้อมขายก่อนเบิกใช้',
        400,
        { field: 'stockItemId', productId: product.id }
      );
    }
    if (payload.qtyUsed !== 1) {
      throw new RepairError(
        RepairFailureCode.INVALID_INPUT,
        'อะไหล่แบบ Serial ต้องเบิกครั้งละ 1 StockItem',
        400,
        { field: 'qtyUsed', productId: product.id }
      );
    }
  } else if (payload.stockItemId) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      'สินค้านี้ไม่ได้ติดตาม Serial กรุณาเบิกด้วยจำนวนสินค้าแทน',
      400,
      { field: 'stockItemId', productId: product.id }
    );
  }
}

class AddRepairPartService {
  constructor(repo = repository) {
    this.repository = repo;
  }

  async execute(actor, rawRepairJobId, rawPayload) {
    const repairJobId = positiveRepairJobId(rawRepairJobId);
    const payload = validateAddPart(rawPayload);

    return this.repository.transaction(async (repo) => {
      const job = await repo.findRepairJob(actor.branchId, repairJobId);
      if (!job) {
        throw new RepairError(
          RepairFailureCode.REPAIR_JOB_NOT_FOUND,
          'ไม่พบใบงานซ่อมในสาขานี้',
          404
        );
      }

      if (['COMPLETED', 'CANCELLED'].includes(job.status)) {
        throw new RepairError(
          RepairFailureCode.REPAIR_JOB_TERMINAL,
          'ไม่สามารถเบิกอะไหล่ให้ใบงานที่ปิดหรือยกเลิกแล้ว',
          409
        );
      }

      const activeClaim = activeWarrantyClaim(job);
      if (activeClaim) {
        throw new RepairError(
          RepairFailureCode.CONFLICT,
          'ใบงานอยู่ระหว่างเคลม กรุณาดำเนินรายการเคลมให้จบก่อนเบิกอะไหล่เพิ่ม',
          409,
          {
            warrantyClaimId: activeClaim.id,
            claimNo: activeClaim.claimNo,
            claimStatus: activeClaim.status,
          }
        );
      }

      const activeSubcontract = typeof repo.findActiveSubcontract === 'function'
        ? await repo.findActiveSubcontract(job.id)
        : null;
      if (activeSubcontract) {
        throw new RepairError(
          RepairFailureCode.CONFLICT,
          'อุปกรณ์อยู่ระหว่างส่งซ่อมภายนอก จึงยังไม่สามารถเบิกอะไหล่เข้าร้านให้ใบงานนี้ได้',
          409,
          {
            repairSubcontractId: Number(activeSubcontract.id),
            subcontractStatus: activeSubcontract.status,
            providerName: activeSubcontract.providerName || null,
          }
        );
      }

      const workflowEvent = job.deviceId
        ? await repo.findLatestWorkflowEvent(actor.branchId, job.id, job.deviceId)
        : null;
      const workflowStatus = currentWorkflowStatus(workflowEvent);
      if (workflowStatus !== 'REPAIRING') {
        throw new RepairError(
          RepairFailureCode.CONFLICT,
          'เบิกอะไหล่ได้เฉพาะขณะงานอยู่ในขั้นกำลังซ่อม',
          409,
          { workflowStatus, requiredWorkflowStatus: 'REPAIRING' }
        );
      }

      const product = await repo.findProduct(payload.productId);
      if (!product || !product.active) {
        throw new RepairError(
          RepairFailureCode.PART_PRODUCT_NOT_FOUND,
          'ไม่พบสินค้าอะไหล่ที่ใช้งานได้',
          404
        );
      }
      assertPartInventoryMode(product, payload, actor);

      let stockItem = null;
      if (product.trackSerialNumber) {
        stockItem = await repo.findStockItem(actor.branchId, product.id, payload.stockItemId);
        if (!stockItem) {
          throw new RepairError(
            RepairFailureCode.PART_PRODUCT_NOT_FOUND,
            'ไม่พบ StockItem ของอะไหล่นี้ในสาขา',
            404,
            { stockItemId: payload.stockItemId, productId: product.id }
          );
        }
        if (stockItem.status !== 'IN_STOCK') {
          throw new RepairError(
            RepairFailureCode.CONFLICT,
            'StockItem นี้ไม่ได้อยู่ในสถานะพร้อมขาย/พร้อมใช้งาน กรุณาเลือกชิ้นอื่น',
            409,
            { stockItemId: stockItem.id, status: stockItem.status, requiredStatus: 'IN_STOCK' }
          );
        }
      }

      const stockBalance = await repo.findStockBalance(actor.branchId, payload.productId);
      const available = stockBalance ? Number(stockBalance.quantity) : 0;
      if (!stockBalance || available < payload.qtyUsed) {
        throw new RepairError(
          RepairFailureCode.PART_STOCK_INSUFFICIENT,
          'จำนวนอะไหล่คงเหลือในสาขาไม่เพียงพอ',
          409,
          { available, requested: payload.qtyUsed }
        );
      }

      const branchPrice = await repo.findBranchPrice(actor.branchId, payload.productId);
      const unitPrice = Number(
        branchPrice?.priceTechnician ??
          branchPrice?.priceRetail ??
          branchPrice?.costPrice ??
          stockBalance.avgCost ??
          0
      );

      if (stockItem) {
        const consumed = await repo.consumeStockItem(actor.branchId, product.id, stockItem.id);
        if (consumed.count !== 1) {
          throw new RepairError(
            RepairFailureCode.CONFLICT,
            'StockItem ถูกเปลี่ยนสถานะไปแล้ว กรุณาโหลดรายการพร้อมขายใหม่',
            409,
            { stockItemId: stockItem.id }
          );
        }
      }

      const decremented = await repo.decrementStockBalance(actor.branchId, payload.productId, payload.qtyUsed);
      if (decremented.count !== 1) {
        throw new RepairError(
          RepairFailureCode.PART_STOCK_INSUFFICIENT,
          'สต๊อกถูกเปลี่ยนระหว่างการเบิก กรุณาตรวจสอบจำนวนใหม่',
          409,
          { requested: payload.qtyUsed }
        );
      }

      const part = await repo.createRepairPart({
        repairJobId: job.id,
        productId: payload.productId,
        qtyUsed: payload.qtyUsed,
        unitPrice,
      });

      await repo.createStockMovement({
        productId: payload.productId,
        branchId: actor.branchId,
        qty: -payload.qtyUsed,
        type: 'ADJUST',
        stockItemId: stockItem?.id || null,
        previousStockStatus: stockItem ? 'IN_STOCK' : null,
        resultingStockStatus: stockItem ? 'USED' : null,
        refType: 'REPAIR_JOB_PART_USAGE',
        refId: job.id,
        note: stockItem
          ? `เบิกอะไหล่ Serial ${stockItem.serialNumber || stockItem.barcode || stockItem.id} สำหรับใบงานซ่อม ${job.jobNo}`
          : `เบิกอะไหล่สำหรับใบงานซ่อม ${job.jobNo}`,
        performedByEmployeeId: actor.employeeId,
      });

      return {
        id: part.id,
        repairJobId: part.repairJobId,
        productId: part.productId,
        productName: part.product?.name || null,
        qtyUsed: part.qtyUsed,
        unitPrice: Number(part.unitPrice),
        serialized: Boolean(stockItem),
        stockItem: stockItem
          ? {
              id: stockItem.id,
              barcode: stockItem.barcode,
              serialNumber: stockItem.serialNumber,
              previousStatus: 'IN_STOCK',
              status: 'USED',
            }
          : null,
      };
    });
  }
}

module.exports = new AddRepairPartService();
module.exports.AddRepairPartService = AddRepairPartService;
module.exports.currentWorkflowStatus = currentWorkflowStatus;
module.exports.activeWarrantyClaim = activeWarrantyClaim;
module.exports.assertPartInventoryMode = assertPartInventoryMode;
