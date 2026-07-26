const repairRepository = require('../repositories/repairRepository');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const { RepairError, RepairFailureCode } = require('../contracts/repairError');
const { repairWarrantyHistory } = require('./repairWarrantyService');
const { repeatRepairLinks } = require('./repairRepeatLinkService');
const {
  reconciliationHistory,
} = require('./warrantyClaimResolutionReconciliationService');

function metadataObject(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata
    : {};
}

function event(type, occurredAt, title, details = {}) {
  if (!occurredAt) return null;
  return { type, occurredAt, title, details };
}

function reconciliationEventType(resolution) {
  switch (resolution) {
    case 'REPLACED':
      return 'CLAIM_REPLACEMENT_RECONCILED';
    case 'WRITTEN_OFF':
      return 'CLAIM_WRITE_OFF_RECONCILED';
    case 'CREDITED':
    case 'REFUNDED':
      return 'CLAIM_FINANCIAL_RECOVERY_RECONCILED';
    default:
      return 'CLAIM_RETURN_RECONCILED';
  }
}

function reconciliationTitle(resolution) {
  switch (resolution) {
    case 'REPLACED':
      return 'รับสินค้าทดแทนจากผลเคลม';
    case 'WRITTEN_OFF':
      return 'ตัดจำหน่ายอุปกรณ์จากผลเคลม';
    case 'CREDITED':
      return 'รับเครดิตจากผลเคลม';
    case 'REFUNDED':
      return 'รับเงินคืนจากผลเคลม';
    case 'REPAIRED':
      return 'รับอุปกรณ์ที่ซ่อมแล้วกลับจากเคลม';
    case 'RETURNED_UNCHANGED':
      return 'รับอุปกรณ์คืนโดยไม่มีการเปลี่ยนแปลง';
    case 'REJECTED':
      return 'เคลมถูกปฏิเสธและรับอุปกรณ์คืน';
    default:
      return 'ปรับปรุงทรัพย์สินและสต็อกจากผลเคลม';
  }
}

function buildTimeline(job, asset) {
  const metadata = metadataObject(asset.metadata);
  const events = [
    event('REPAIR_RECEIVED', job.createdAt, 'รับเครื่องเข้าระบบ', {
      repairJobId: job.id,
      repairJobNo: job.jobNo,
      reportedSymptoms: job.reportedSymptoms,
    }),
    ...((metadata.repairDiagnoses || [])
      .filter((item) => Number(item.repairJobId) === Number(job.id))
      .map((item) =>
        event(
          'DIAGNOSIS_RECORDED',
          item.recordedAt || item.createdAt,
          'บันทึกผลตรวจอาการ',
          item
        )
      )),
    ...((metadata.repairEstimates || [])
      .filter((item) => Number(item.repairJobId) === Number(job.id))
      .map((item) =>
        event(
          'ESTIMATE_CREATED',
          item.createdAt || item.recordedAt,
          'สร้างใบเสนอราคางานซ่อม',
          item
        )
      )),
    ...((metadata.repairPayments || [])
      .filter((item) => Number(item.repairJobId) === Number(job.id))
      .map((item) =>
        event('PAYMENT_RECORDED', item.receivedAt, 'รับชำระค่าซ่อม', item)
      )),
    ...((metadata.repairInvoices || [])
      .filter((item) => Number(item.repairJobId) === Number(job.id))
      .map((item) =>
        event('INVOICE_ISSUED', item.issuedAt, 'ออกใบแจ้งค่าซ่อม', item)
      )),
    ...((metadata.customerHandovers || [])
      .filter((item) => Number(item.repairJobId) === Number(job.id))
      .map((item) =>
        event(
          'CUSTOMER_HANDOVER',
          item.handedOverAt,
          'ส่งคืนเครื่องให้ลูกค้า',
          item
        )
      )),
    ...repairWarrantyHistory(metadata)
      .filter((item) => Number(item.repairJobId) === Number(job.id))
      .map((item) =>
        event(
          'REPAIR_WARRANTY_STARTED',
          item.startedAt,
          'เริ่มรับประกันงานซ่อม',
          item
        )
      ),
    ...repeatRepairLinks(metadata)
      .filter(
        (item) =>
          Number(item.repairJobId) === Number(job.id) ||
          Number(item.previousRepairJobId) === Number(job.id)
      )
      .map((item) =>
        event(
          'REPEAT_REPAIR_LINKED',
          item.linkedAt,
          'เชื่อมโยงงานซ่อมซ้ำ',
          item
        )
      ),
    ...((metadata.repairClaimEscalations || [])
      .filter((item) => Number(item.repairJobId) === Number(job.id))
      .map((item) =>
        event(
          'WARRANTY_CLAIM_ESCALATED',
          item.escalatedAt,
          'ยกระดับใบงานซ่อมไปเป็นงานเคลม',
          item
        )
      )),
    ...reconciliationHistory(metadata)
      .filter((item) => Number(item.repairJobId) === Number(job.id))
      .map((item) =>
        event(
          reconciliationEventType(item.resolution),
          item.reconciledAt,
          reconciliationTitle(item.resolution),
          item
        )
      ),
  ].filter(Boolean);

  return events.sort(
    (a, b) => new Date(a.occurredAt) - new Date(b.occurredAt)
  );
}

class RepairAssetTimelineService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async getForRepairJob(actor, repairJobId) {
    const job = await this.repository.findRepairJob(actor.branchId, repairJobId);
    if (!job) {
      throw new RepairError(
        RepairFailureCode.REPAIR_JOB_NOT_FOUND,
        'ไม่พบใบงานซ่อมในสาขานี้',
        404
      );
    }
    if (!job.serviceAssetId) {
      throw new RepairError(
        RepairFailureCode.SERVICE_ASSET_REQUIRED,
        'ใบงานซ่อมต้องเชื่อมกับอุปกรณ์บริการ',
        409
      );
    }
    const assetRepository = new ServiceAssetRepository(this.repository.prisma);
    const asset = await assetRepository.findServiceAsset(
      actor.branchId,
      job.serviceAssetId
    );
    if (!asset) {
      throw new RepairError(
        RepairFailureCode.SERVICE_ASSET_NOT_FOUND,
        'ไม่พบอุปกรณ์บริการของใบงานซ่อม',
        404
      );
    }
    return {
      repairJobId: job.id,
      repairJobNo: job.jobNo,
      serviceAssetId: asset.id,
      serviceAssetStatus: asset.status,
      sourceStockItemId: asset.sourceStockItemId,
      events: buildTimeline(job, asset),
    };
  }
}

module.exports = new RepairAssetTimelineService();
module.exports.RepairAssetTimelineService = RepairAssetTimelineService;
module.exports.buildTimeline = buildTimeline;
module.exports.reconciliationEventType = reconciliationEventType;
module.exports.reconciliationTitle = reconciliationTitle;
