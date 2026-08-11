const repository = require('./repairSubcontractRepository');
const { RepairError, RepairFailureCode } = require('../contracts/repairError');
const { CLAIM_ACTIVE_STATUSES } = require('../contracts/repairContract');

const OPENABLE_WORKFLOW_STATUSES = Object.freeze(['APPROVED', 'REPAIRING']);
const ACTIVE_SUBCONTRACT_STATUSES = Object.freeze(['SENT', 'RETURN_REQUESTED']);

function positiveInteger(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `${field} ต้องเป็นจำนวนเต็มมากกว่า 0`,
      400,
      { field }
    );
  }
  return parsed;
}

function requiredText(value, field, maxLength = 4000) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `กรุณาระบุ ${field}`,
      400,
      { field }
    );
  }
  if (normalized.length > maxLength) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `${field} ยาวเกินกำหนด`,
      400,
      { field, maxLength }
    );
  }
  return normalized;
}

function optionalText(value, maxLength = 4000) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim().slice(0, maxLength) || null;
}

function optionalMoney(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `${field} ต้องเป็นจำนวนตั้งแต่ 0 ขึ้นไป`,
      400,
      { field }
    );
  }
  return parsed;
}

function optionalDate(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `${field} ไม่ใช่วันที่ที่ถูกต้อง`,
      400,
      { field }
    );
  }
  return parsed;
}

function workflowStatusFromEvent(event) {
  return event?.metadata?.workflowTargetStatus || 'RECEIVED';
}

function activeWarrantyClaim(job) {
  return (job?.warrantyClaims || []).find((claim) =>
    CLAIM_ACTIVE_STATUSES.includes(claim.status)
  ) || null;
}

function mapSubcontract(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    branchId: Number(row.branchId),
    repairJobId: Number(row.repairJobId),
    expensePayeeId: Number(row.expensePayeeId),
    status: row.status,
    active: ACTIVE_SUBCONTRACT_STATUSES.includes(row.status),
    providerName: row.providerName,
    providerPhone: row.providerPhone || null,
    workScope: row.workScope,
    externalReference: row.externalReference || null,
    trackingNumber: row.trackingNumber || null,
    customerEstimateAmount:
      row.customerEstimateAmount === null || row.customerEstimateAmount === undefined
        ? null
        : Number(row.customerEstimateAmount),
    customerApprovalNote: row.customerApprovalNote || null,
    providerQuotedAmount:
      row.providerQuotedAmount === null || row.providerQuotedAmount === undefined
        ? null
        : Number(row.providerQuotedAmount),
    providerQuoteNote: row.providerQuoteNote || null,
    customerDecisionNote: row.customerDecisionNote || null,
    actualExternalCost:
      row.actualExternalCost === null || row.actualExternalCost === undefined
        ? null
        : Number(row.actualExternalCost),
    transportCost: row.transportCost == null ? null : Number(row.transportCost),
    materialCost: row.materialCost == null ? null : Number(row.materialCost),
    otherOperationalCost: row.otherOperationalCost == null ? null : Number(row.otherOperationalCost),
    resultNote: row.resultNote || null,
    sentAt: row.sentAt,
    expectedReturnAt: row.expectedReturnAt || null,
    returnRequestedAt: row.returnRequestedAt || null,
    returnedAt: row.returnedAt || null,
    sentByEmployeeId: Number(row.sentByEmployeeId),
    returnedByEmployeeId: row.returnedByEmployeeId ? Number(row.returnedByEmployeeId) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function assertCanSend(job, workflowStatus, activeSubcontract) {
  if (['COMPLETED', 'CANCELLED'].includes(job.status)) {
    throw new RepairError(
      RepairFailureCode.REPAIR_JOB_TERMINAL,
      'ไม่สามารถส่งซ่อมภายนอกจากใบงานที่ปิดหรือยกเลิกแล้ว',
      409
    );
  }

  const claim = activeWarrantyClaim(job);
  if (claim) {
    throw new RepairError(
      RepairFailureCode.CONFLICT,
      'ใบงานอยู่ระหว่างเคลม กรุณาดำเนินรายการเคลมให้จบก่อนส่งซ่อมภายนอก',
      409,
      { warrantyClaimId: claim.id, claimNo: claim.claimNo, claimStatus: claim.status }
    );
  }

  if (activeSubcontract) {
    throw new RepairError(
      RepairFailureCode.CONFLICT,
      'ใบงานนี้มีอุปกรณ์อยู่ระหว่างส่งซ่อมภายนอกแล้ว',
      409,
      { subcontractId: Number(activeSubcontract.id), status: activeSubcontract.status }
    );
  }

  if (!job.deviceIntake?.consent?.allowOutsourceRepair) {
    throw new RepairError(
      RepairFailureCode.CONFLICT,
      'ลูกค้ายังไม่ได้อนุญาตให้ส่งอุปกรณ์ซ่อมภายนอก กรุณาบันทึกคำยืนยันก่อนส่งเครื่องออก',
      409,
      { requiredConsent: 'allowOutsourceRepair' }
    );
  }

  if (!OPENABLE_WORKFLOW_STATUSES.includes(workflowStatus)) {
    throw new RepairError(
      RepairFailureCode.CONFLICT,
      'ส่งซ่อมภายนอกได้หลังลูกค้าตัดสินใจแนวทางซ่อมแล้ว หรือระหว่างงานอยู่ในขั้นกำลังซ่อม',
      409,
      { workflowStatus, allowedWorkflowStatuses: OPENABLE_WORKFLOW_STATUSES }
    );
  }
}

class RepairSubcontractService {
  constructor(repo = repository) {
    this.repository = repo;
  }

  async getContext(actor, repairJobIdInput) {
    const repairJobId = positiveInteger(repairJobIdInput, 'repairJobId');
    const job = await this.repository.findRepairJob(actor.branchId, repairJobId);
    if (!job) {
      throw new RepairError(RepairFailureCode.REPAIR_JOB_NOT_FOUND, 'ไม่พบใบงานซ่อมในสาขานี้', 404);
    }
    const [rows, workflowEvent] = await Promise.all([
      this.repository.list(job.id),
      this.repository.findLatestWorkflowEvent(job.branchId, job.id, job.deviceId),
    ]);
    const items = rows.map(mapSubcontract);
    const active = items.find((item) => item.active) || null;
    const relatedExpenses = active
      ? await this.repository.listRelatedExpenses(job.branchId, job.id, active.id)
      : [];
    return {
      repairJobId: job.id,
      jobNo: job.jobNo,
      workflowStatus: workflowStatusFromEvent(workflowEvent),
      outsourceConsent: Boolean(job.deviceIntake?.consent?.allowOutsourceRepair),
      active,
      items,
      relatedExpenses: relatedExpenses.map((expense) => ({
        ...expense,
        totalAmount: Number(expense.totalAmount),
        paymentDueAmount: Number(expense.paymentDueAmount),
      })),
    };
  }

  send(actor, repairJobIdInput, input = {}) {
    const repairJobId = positiveInteger(repairJobIdInput, 'repairJobId');
    const expensePayeeId = positiveInteger(input.expensePayeeId, 'expensePayeeId');
    let providerName = optionalText(input.providerName, 255);
    const workScope = requiredText(input.workScope, 'ขอบเขตงานที่ส่งซ่อม');
    let providerPhone = optionalText(input.providerPhone, 120);
    const externalReference = optionalText(input.externalReference, 255);
    const trackingNumber = optionalText(input.trackingNumber, 255);
    const customerApprovalNote = optionalText(input.customerApprovalNote, 2000);
    const expectedReturnAt = optionalDate(input.expectedReturnAt, 'expectedReturnAt');
    const requestedEstimate = optionalMoney(input.customerEstimateAmount, 'customerEstimateAmount');

    return this.repository.transaction(async (repo) => {
      const job = await repo.findRepairJob(actor.branchId, repairJobId);
      if (!job) {
        throw new RepairError(RepairFailureCode.REPAIR_JOB_NOT_FOUND, 'ไม่พบใบงานซ่อมในสาขานี้', 404);
      }
      const workflowEvent = await repo.findLatestWorkflowEvent(job.branchId, job.id, job.deviceId);
      const workflowStatus = workflowStatusFromEvent(workflowEvent);
      const activeSubcontract = await repo.findActive(job.id, { forUpdate: true });
      assertCanSend(job, workflowStatus, activeSubcontract);
      const expensePayee = await repo.findExpensePayee(job.branchId, expensePayeeId);
      if (!expensePayee) {
        throw new RepairError(RepairFailureCode.INVALID_INPUT, 'ExpensePayee not found or inactive for this branch', 400, { field: 'expensePayeeId' });
      }
      providerName = expensePayee.name;
      providerPhone = expensePayee.phone || providerPhone;

      const customerEstimateAmount = requestedEstimate ??
        (Number(job.estimatedCost || 0) > 0 ? Number(job.estimatedCost) : null);
      if (customerEstimateAmount === null && !customerApprovalNote) {
        throw new RepairError(
          RepairFailureCode.INVALID_INPUT,
          'ก่อนส่งซ่อมภายนอก กรุณาระบุราคาประเมินคร่าว ๆ หรือหมายเหตุข้อตกลงที่แจ้งลูกค้า',
          400,
          { fields: ['customerEstimateAmount', 'customerApprovalNote'] }
        );
      }

      const created = await repo.create({
        branchId: job.branchId,
        repairJobId: job.id,
        expensePayeeId: expensePayee.id,
        providerName,
        providerPhone,
        workScope,
        externalReference,
        trackingNumber,
        customerEstimateAmount,
        customerApprovalNote,
        expectedReturnAt,
        sentByEmployeeId: actor.employeeId,
      });

      await repo.createTimelineEvent({
        repairJobId: job.id,
        eventType: 'REPAIR_SUBCONTRACT_SENT',
        fromStatus: workflowStatus,
        toStatus: workflowStatus,
        customerVisible: true,
        customerTitle: 'ส่งอุปกรณ์ดำเนินการภายนอกแล้ว',
        customerMessage: 'อุปกรณ์อยู่ระหว่างดำเนินการกับผู้ให้บริการภายนอก ร้านจะติดตามงานและแจ้งความคืบหน้าให้ทราบ',
        internalNote: `ส่งซ่อมภายนอก: ${providerName} · ${workScope}`,
        performedByEmployeeId: actor.employeeId,
        metadata: {
          repairSubcontractId: Number(created.id),
          expensePayeeId: expensePayee.id,
          providerName,
          workflowStatusAtSend: workflowStatus,
          customerEstimateAmount,
        },
      });

      return mapSubcontract(created);
    });
  }

  async updateDetails(actor, repairJobIdInput, subcontractIdInput, input = {}) {
    const repairJobId = positiveInteger(repairJobIdInput, 'repairJobId');
    const subcontractId = positiveInteger(subcontractIdInput, 'subcontractId');
    const job = await this.repository.findRepairJob(actor.branchId, repairJobId);
    if (!job) {
      throw new RepairError(RepairFailureCode.REPAIR_JOB_NOT_FOUND, 'ไม่พบใบงานซ่อมในสาขานี้', 404);
    }

    const updated = await this.repository.updateDetails(job.branchId, job.id, subcontractId, {
      providerPhone: optionalText(input.providerPhone, 120),
      externalReference: optionalText(input.externalReference, 255),
      trackingNumber: optionalText(input.trackingNumber, 255),
      expectedReturnAt: optionalDate(input.expectedReturnAt, 'expectedReturnAt'),
      providerQuotedAmount: optionalMoney(input.providerQuotedAmount, 'providerQuotedAmount'),
      providerQuoteNote: optionalText(input.providerQuoteNote, 2000),
      customerDecisionNote: optionalText(input.customerDecisionNote, 2000),
    });
    if (!updated) {
      throw new RepairError(RepairFailureCode.CONFLICT, 'รายการส่งซ่อมภายนอกนี้ไม่ได้อยู่ในสถานะที่แก้ไขได้', 409);
    }
    return mapSubcontract(updated);
  }

  command(actor, repairJobIdInput, subcontractIdInput, input = {}) {
    const repairJobId = positiveInteger(repairJobIdInput, 'repairJobId');
    const subcontractId = positiveInteger(subcontractIdInput, 'subcontractId');
    const action = requiredText(input.action, 'action', 80).toUpperCase();

    return this.repository.transaction(async (repo) => {
      const job = await repo.findRepairJob(actor.branchId, repairJobId);
      if (!job) {
        throw new RepairError(RepairFailureCode.REPAIR_JOB_NOT_FOUND, 'ไม่พบใบงานซ่อมในสาขานี้', 404);
      }
      const current = await repo.findById(job.branchId, job.id, subcontractId, { forUpdate: true });
      if (!current) {
        throw new RepairError(RepairFailureCode.REPAIR_JOB_NOT_FOUND, 'ไม่พบรายการส่งซ่อมภายนอกนี้', 404);
      }
      const workflowEvent = await repo.findLatestWorkflowEvent(job.branchId, job.id, job.deviceId);
      const workflowStatus = workflowStatusFromEvent(workflowEvent);

      if (action === 'REQUEST_RETURN') {
        const note = optionalText(input.note, 2000);
        const updated = await repo.requestReturn(job.branchId, job.id, subcontractId, note);
        if (!updated) {
          throw new RepairError(RepairFailureCode.CONFLICT, 'รายการนี้ไม่ได้อยู่ในสถานะที่ขอรับเครื่องกลับได้', 409);
        }
        await repo.createTimelineEvent({
          repairJobId: job.id,
          eventType: 'REPAIR_SUBCONTRACT_RETURN_REQUESTED',
          fromStatus: workflowStatus,
          toStatus: workflowStatus,
          customerVisible: true,
          customerTitle: 'กำลังนำอุปกรณ์กลับเข้าร้าน',
          customerMessage: 'ร้านได้ขอรับอุปกรณ์กลับจากผู้ให้บริการแล้ว และจะตรวจสอบเมื่ออุปกรณ์กลับถึงร้าน',
          internalNote: note || 'ขอรับเครื่องกลับจากผู้รับซ่อมภายนอก',
          performedByEmployeeId: actor.employeeId,
          metadata: { repairSubcontractId: subcontractId },
        });
        return mapSubcontract(updated);
      }

      if (action === 'RECEIVE_RETURN') {
        const resultNote = requiredText(input.resultNote, 'ผลการรับเครื่องกลับ', 4000);
        const actualExternalCost = optionalMoney(input.actualExternalCost, 'actualExternalCost');
        const transportCost = optionalMoney(input.transportCost, 'transportCost');
        const materialCost = optionalMoney(input.materialCost, 'materialCost');
        const otherOperationalCost = optionalMoney(input.otherOperationalCost, 'otherOperationalCost');
        const updated = await repo.receiveReturn(job.branchId, job.id, subcontractId, {
          actualExternalCost,
          transportCost,
          materialCost,
          otherOperationalCost,
          resultNote,
          returnedByEmployeeId: actor.employeeId,
        });
        if (!updated) {
          throw new RepairError(RepairFailureCode.CONFLICT, 'รายการนี้ไม่ได้อยู่ในสถานะที่รับเครื่องกลับได้', 409);
        }
        await repo.createTimelineEvent({
          repairJobId: job.id,
          eventType: 'REPAIR_SUBCONTRACT_RETURNED',
          fromStatus: workflowStatus,
          toStatus: workflowStatus,
          customerVisible: true,
          customerTitle: 'อุปกรณ์กลับถึงร้านแล้ว',
          customerMessage: 'ร้านได้รับอุปกรณ์กลับแล้ว และกำลังตรวจสอบก่อนดำเนินงานขั้นถัดไป',
          internalNote: resultNote,
          performedByEmployeeId: actor.employeeId,
          metadata: {
            repairSubcontractId: subcontractId,
            actualExternalCost,
            transportCost,
            materialCost,
            otherOperationalCost,
          },
        });
        return mapSubcontract(updated);
      }

      throw new RepairError(
        RepairFailureCode.INVALID_INPUT,
        'action ต้องเป็น REQUEST_RETURN หรือ RECEIVE_RETURN',
        400,
        { action }
      );
    });
  }
}

module.exports = new RepairSubcontractService();
module.exports.RepairSubcontractService = RepairSubcontractService;
module.exports.OPENABLE_WORKFLOW_STATUSES = OPENABLE_WORKFLOW_STATUSES;
module.exports.ACTIVE_SUBCONTRACT_STATUSES = ACTIVE_SUBCONTRACT_STATUSES;
module.exports.assertCanSend = assertCanSend;
module.exports.mapSubcontract = mapSubcontract;
module.exports.workflowStatusFromEvent = workflowStatusFromEvent;
