const repository = require('./repairJobDetailRepository');
const { mapRepairJob } = require('../../mappers/repairMapper');
const {
  RepairError,
  RepairFailureCode,
} = require('../../contracts/repairError');
const { CLAIM_ACTIVE_STATUSES } = require('../../contracts/repairContract');
const {
  REPAIR_WORKFLOW_ACTION,
  REPAIR_WORKFLOW_STATUS,
  getAvailableRepairWorkflowActions,
} = require('../../workflow/policies/repairWorkflowPolicy');

function requirePositiveInteger(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `${fieldName} ต้องเป็นจำนวนเต็มมากกว่า 0`,
      400,
      { field: fieldName }
    );
  }
  return parsed;
}

const NEXT_ACTION_BY_STATUS = Object.freeze({
  RECEIVED: 'ตรวจหลักฐานรับเครื่องให้ครบ แล้วให้ช่างกดรับงานก่อนเริ่มซ่อมหรือตรวจสอบ',
  ACCEPTED: 'ช่างรับงานแล้ว เลือกเริ่มซ่อมหรือตรวจสอบก่อนตามเงื่อนไขของเคส',
  WAITING_DIAGNOSIS: 'เริ่มตรวจสอบเมื่อช่างพร้อม',
  DIAGNOSING: 'บันทึกผลตรวจ สาเหตุ แนวทางแก้ และราคาประเมินสำหรับเคสที่ต้องเสนอราคาก่อนซ่อม',
  WAITING_APPROVAL: 'ส่งราคาประเมินและรอการตัดสินใจจากลูกค้า',
  APPROVED: 'ลูกค้าอนุมัติราคาแล้ว เริ่มงานซ่อมตามรายการที่อนุมัติ',
  REJECTED: 'ทบทวนแนวทาง/ราคา แล้วเปิดตรวจสอบใหม่หากต้องการเสนอทางเลือกใหม่',
  REPAIRING: 'ดำเนินการซ่อม บันทึกอะไหล่ และสรุปงานพร้อมค่าซ่อมจริงเมื่อเสร็จ',
  WAITING_PARTS: 'ติดตามอะไหล่ และกลับมาซ่อมต่อเมื่อพร้อม',
  WAITING_QC: 'ตรวจ QC ให้ครบทุกหัวข้อก่อนส่งมอบ',
  QC_FAILED: 'แก้ไขงานตามสาเหตุที่ QC ไม่ผ่าน แล้วส่งตรวจใหม่',
  READY_FOR_DELIVERY: 'ยืนยันผู้รับและส่งมอบเครื่องคืนลูกค้า',
  DELIVERED: 'ตรวจความเรียบร้อยแล้วปิดใบงาน',
  CLOSED: 'ใบงานเสร็จสมบูรณ์แล้ว',
  CANCELLED: 'ใบงานถูกยกเลิก ตรวจเหตุผลและประวัติได้จาก Timeline',
});

const CLAIM_HANDBACK_BY_RESOLUTION = Object.freeze({
  REPAIRED: 'เคลมซ่อมกลับมาแล้ว ตรวจสภาพงานที่ได้รับจากศูนย์ แล้วดำเนินขั้นซ่อม/สรุปงานต่อเพื่อเข้าสู่ QC',
  REPLACED: 'ได้รับสินค้าทดแทนแล้ว ตรวจ Serial/Barcode และทดสอบสินค้าทดแทนก่อนดำเนินงานต่อ',
  RETURNED_UNCHANGED: 'ศูนย์ส่งสินค้ากลับโดยไม่แก้ไข ให้ทบทวนผลตรวจและกำหนดแนวทางซ่อมใหม่กับลูกค้า',
  REJECTED: 'ศูนย์ปฏิเสธการเคลม ให้ทบทวนเหตุผลและกำหนดแนวทางซ่อมหรือทางเลือกใหม่กับลูกค้า',
  CREDITED: 'ได้รับเครดิตจากผู้จำหน่ายแล้ว ให้ตรวจเงื่อนไขชดเชยและตกลงแนวทางสุดท้ายกับลูกค้าก่อนดำเนินใบงานต่อ',
  REFUNDED: 'ได้รับการคืนเงินจากผู้จำหน่ายแล้ว ให้ตรวจยอดและตกลงแนวทางสุดท้ายกับลูกค้าก่อนดำเนินใบงานต่อ',
  WRITTEN_OFF: 'ผลเคลมเป็นตัดจำหน่าย ให้ผู้รับผิดชอบตรวจหลักฐานและตกลงแนวทางชดเชย/ปิดงานกับลูกค้า',
});

function mapHistory(event) {
  return {
    id: event.id,
    eventType: event.eventType,
    action: event.metadata?.action || null,
    previousStatus: event.metadata?.workflowPreviousStatus || null,
    status: event.metadata?.workflowTargetStatus || null,
    title: event.title,
    description: event.description || event.metadata?.note || null,
    occurredAt: event.occurredAt,
  };
}

function mapSerializedPartMovement(movement) {
  return {
    movementId: movement.id,
    productId: movement.productId,
    productName: movement.stockItem?.product?.name || null,
    qtyUsed: Math.abs(Number(movement.qty || 0)),
    stockItemId: movement.stockItemId,
    barcode: movement.stockItem?.barcode || null,
    serialNumber: movement.stockItem?.serialNumber || null,
    previousStatus: movement.previousStockStatus || null,
    status: movement.resultingStockStatus || movement.stockItem?.status || null,
    occurredAt: movement.occurredAt,
    performedByEmployeeId: movement.performedByEmployeeId || null,
  };
}

function deriveClaimContext(job, workflowEvent) {
  const claims = job.warrantyClaims || [];
  const activeClaim = claims.find((claim) => CLAIM_ACTIVE_STATUSES.includes(claim.status)) || null;
  if (activeClaim) {
    return {
      active: true,
      handbackPending: false,
      claimId: activeClaim.id,
      claimNo: activeClaim.claimNo,
      status: activeClaim.status,
      resolution: activeClaim.resolution || null,
      resolvedAt: activeClaim.resolvedAt || null,
    };
  }

  const resolvedClaim = claims.find((claim) => claim.status === 'RESOLVED' && claim.resolvedAt) || null;
  if (!resolvedClaim) return null;

  const workflowAt = workflowEvent?.occurredAt ? new Date(workflowEvent.occurredAt).getTime() : 0;
  const resolvedAt = new Date(resolvedClaim.resolvedAt).getTime();
  const handbackPending = Number.isFinite(resolvedAt) && resolvedAt > workflowAt;
  return {
    active: false,
    handbackPending,
    claimId: resolvedClaim.id,
    claimNo: resolvedClaim.claimNo,
    status: resolvedClaim.status,
    resolution: resolvedClaim.resolution || null,
    resolvedAt: resolvedClaim.resolvedAt,
  };
}

function deriveSubcontractContext(job) {
  const subcontract = job.activeSubcontract;
  if (!subcontract) return null;
  return {
    active: true,
    subcontractId: Number(subcontract.id),
    status: subcontract.status,
    providerName: subcontract.providerName,
    providerPhone: subcontract.providerPhone || null,
    workScope: subcontract.workScope,
    externalReference: subcontract.externalReference || null,
    trackingNumber: subcontract.trackingNumber || null,
    customerEstimateAmount:
      subcontract.customerEstimateAmount === null || subcontract.customerEstimateAmount === undefined
        ? null
        : Number(subcontract.customerEstimateAmount),
    customerApprovalNote: subcontract.customerApprovalNote || null,
    providerQuotedAmount:
      subcontract.providerQuotedAmount === null || subcontract.providerQuotedAmount === undefined
        ? null
        : Number(subcontract.providerQuotedAmount),
    providerQuoteNote: subcontract.providerQuoteNote || null,
    customerDecisionNote: subcontract.customerDecisionNote || null,
    actualExternalCost:
      subcontract.actualExternalCost === null || subcontract.actualExternalCost === undefined
        ? null
        : Number(subcontract.actualExternalCost),
    resultNote: subcontract.resultNote || null,
    sentAt: subcontract.sentAt,
    expectedReturnAt: subcontract.expectedReturnAt || null,
    returnRequestedAt: subcontract.returnRequestedAt || null,
    returnedAt: subcontract.returnedAt || null,
    updatedAt: subcontract.updatedAt,
  };
}

function derivePreAgreedService(job) {
  const creationEvent = (job.repairWorkflowHistory || []).find(
    (event) => event.eventType === 'REPAIR_CREATED'
  );
  return creationEvent?.metadata?.preAgreedService || null;
}

function availableActionsForContext(workflowStatus, preAgreedService) {
  const actions = getAvailableRepairWorkflowActions(workflowStatus);
  if (preAgreedService?.enabled) return actions;
  return actions.filter(
    (item) => item.action !== REPAIR_WORKFLOW_ACTION.START_PRE_AGREED_SERVICE
  );
}

class RepairJobDetailService {
  constructor(repo = repository) {
    this.repository = repo;
  }

  async execute(actor, repairJobIdInput) {
    const repairJobId = requirePositiveInteger(repairJobIdInput, 'repairJobId');
    const job = await this.repository.findById(actor.branchId, repairJobId);

    if (!job) {
      throw new RepairError(
        RepairFailureCode.REPAIR_JOB_NOT_FOUND,
        'ไม่พบใบงานซ่อมในสาขานี้',
        404
      );
    }

    const workflowEvent = job.repairWorkflowEvent || null;
    const workflowStatus =
      workflowEvent?.metadata?.workflowTargetStatus || REPAIR_WORKFLOW_STATUS.RECEIVED;
    const diagnosis = job.repairDiagnosisEvent?.metadata?.diagnosis || null;
    const history = (job.repairWorkflowHistory || []).map(mapHistory);
    const claimContext = deriveClaimContext(job, workflowEvent);
    const subcontractContext = deriveSubcontractContext(job);
    const preAgreedService = derivePreAgreedService(job);
    const serializedPartsUsed = (job.serializedPartMovements || []).map(mapSerializedPartMovement);

    const nextAction = claimContext?.active
      ? `ใบงานพักการดำเนินการระหว่างเคลม ${claimContext.claimNo} (${claimContext.status}) ให้ดำเนินงานในรายการเคลมจนจบก่อนกลับมาที่ใบงานซ่อม`
      : subcontractContext?.active
        ? subcontractContext.status === 'RETURN_REQUESTED'
          ? `ใบงานพักไว้ระหว่างรอรับอุปกรณ์กลับจาก ${subcontractContext.providerName} เมื่อเครื่องกลับถึงร้านให้ยืนยันรับกลับก่อนดำเนินงานต่อ`
          : `ใบงานพักไว้ระหว่างอุปกรณ์อยู่กับ ${subcontractContext.providerName} อัปเดตราคา/ผลดำเนินการในรายการส่งซ่อมภายนอก หรือขอรับเครื่องกลับเมื่อจำเป็น`
        : claimContext?.handbackPending
          ? CLAIM_HANDBACK_BY_RESOLUTION[claimContext.resolution] || 'รายการเคลมจบแล้ว ตรวจผลเคลมและดำเนินใบงานซ่อมต่อ'
          : workflowStatus === REPAIR_WORKFLOW_STATUS.ACCEPTED && preAgreedService?.enabled
            ? 'ช่างรับงานแล้ว และลูกค้าอนุมัติให้ซ่อมโดยไม่ต้องเสนอราคาก่อน เริ่มซ่อมได้เลยหรือเลือกตรวจสอบเพิ่มเติมเมื่อจำเป็น'
            : NEXT_ACTION_BY_STATUS[workflowStatus] || 'ตรวจสอบสถานะงานก่อนดำเนินการต่อ';

    return {
      ...mapRepairJob(job),
      serializedPartsUsed,
      workflow: {
        status: workflowStatus,
        nextAction,
        availableActions: claimContext?.active || subcontractContext?.active
          ? []
          : availableActionsForContext(workflowStatus, preAgreedService),
        claimContext,
        subcontractContext,
        preAgreedService,
        latestEvent: workflowEvent
          ? {
              id: workflowEvent.id,
              eventType: workflowEvent.eventType,
              title: workflowEvent.title,
              description: workflowEvent.description,
              occurredAt: workflowEvent.occurredAt,
            }
          : null,
        diagnosis,
        history,
      },
    };
  }
}

module.exports = new RepairJobDetailService();
module.exports.RepairJobDetailService = RepairJobDetailService;
module.exports.requirePositiveInteger = requirePositiveInteger;
module.exports.NEXT_ACTION_BY_STATUS = NEXT_ACTION_BY_STATUS;
module.exports.CLAIM_HANDBACK_BY_RESOLUTION = CLAIM_HANDBACK_BY_RESOLUTION;
module.exports.deriveClaimContext = deriveClaimContext;
module.exports.deriveSubcontractContext = deriveSubcontractContext;
module.exports.derivePreAgreedService = derivePreAgreedService;
module.exports.availableActionsForContext = availableActionsForContext;
module.exports.mapHistory = mapHistory;
module.exports.mapSerializedPartMovement = mapSerializedPartMovement;
