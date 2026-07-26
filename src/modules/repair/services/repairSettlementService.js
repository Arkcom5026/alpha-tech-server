const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const repairRepository = require('../repositories/repairRepository');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const { RepairError, RepairFailureCode } = require('../contracts/repairError');
const { estimateHistory } = require('./repairEstimateService');
const { latestApprovedEstimate } = require('./repairFinancialSummaryService');

const REPAIR_PAYMENT_METHODS = Object.freeze([
  'CASH',
  'TRANSFER',
  'CARD',
  'QR',
  'E_WALLET',
  'CHEQUE',
  'OTHER',
]);

function decimal(value) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value || 0);
}

function metadataObject(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
}

function paymentHistory(metadata) {
  const history = metadataObject(metadata).repairPayments;
  return Array.isArray(history) ? history : [];
}

function validateRepairPayment(payload = {}) {
  const amount = decimal(payload.amount);
  if (!amount.isPositive()) {
    throw new RepairError(
      RepairFailureCode.REPAIR_PAYMENT_AMOUNT_INVALID,
      'ยอดรับชำระต้องมากกว่า 0',
      400
    );
  }

  const method = String(payload.method || '').trim().toUpperCase();
  if (!REPAIR_PAYMENT_METHODS.includes(method)) {
    throw new RepairError(
      RepairFailureCode.REPAIR_PAYMENT_METHOD_INVALID,
      'ช่องทางรับชำระไม่อยู่ในค่าที่ระบบรองรับ',
      400,
      { method, allowed: REPAIR_PAYMENT_METHODS }
    );
  }

  const reference = payload.reference == null ? null : String(payload.reference).trim() || null;
  const note = payload.note == null ? null : String(payload.note).trim() || null;
  if (reference && reference.length > 255) {
    throw new RepairError(RepairFailureCode.INVALID_INPUT, 'reference ยาวเกิน 255 ตัวอักษร', 400);
  }
  if (note && note.length > 2000) {
    throw new RepairError(RepairFailureCode.INVALID_INPUT, 'note ยาวเกิน 2000 ตัวอักษร', 400);
  }

  return {
    amount: amount.toDecimalPlaces(2),
    method,
    reference,
    note,
    allowOverpayment: payload.allowOverpayment === true,
  };
}

function calculateSettlement({ job, approvedEstimate, payments = [] }) {
  const approvedTotal = decimal(approvedEstimate?.total || 0);
  const depositPaid = decimal(job?.depositPaid || 0);
  const paymentTotal = payments.reduce((sum, payment) => sum.add(decimal(payment.amount)), new Prisma.Decimal(0));
  const paidTotal = depositPaid.add(paymentTotal);
  const outstandingBalance = Prisma.Decimal.max(approvedTotal.sub(paidTotal), 0);
  const overpaidAmount = Prisma.Decimal.max(paidTotal.sub(approvedTotal), 0);

  return {
    currency: approvedEstimate?.currency || 'THB',
    approvedTotal: approvedTotal.toFixed(2),
    depositPaid: depositPaid.toFixed(2),
    paymentTotal: paymentTotal.toFixed(2),
    paidTotal: paidTotal.toFixed(2),
    outstandingBalance: outstandingBalance.toFixed(2),
    overpaidAmount: overpaidAmount.toFixed(2),
    status: approvedEstimate
      ? outstandingBalance.isZero()
        ? 'SETTLED'
        : paidTotal.isPositive()
          ? 'PARTIALLY_PAID'
          : 'UNPAID'
      : 'NOT_BILLABLE',
  };
}

class RepairSettlementService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async loadContext(repo, actor, repairJobId) {
    const job = await repo.findRepairJob(actor.branchId, repairJobId);
    if (!job) {
      throw new RepairError(RepairFailureCode.REPAIR_JOB_NOT_FOUND, 'ไม่พบใบงานซ่อมในสาขานี้', 404);
    }
    if (!job.serviceAssetId) {
      throw new RepairError(RepairFailureCode.SERVICE_ASSET_REQUIRED, 'ใบงานซ่อมต้องเชื่อมกับอุปกรณ์บริการก่อนรับชำระ', 409);
    }
    const assetRepository = new ServiceAssetRepository(repo.prisma);
    const asset = await assetRepository.findServiceAsset(actor.branchId, job.serviceAssetId);
    if (!asset) {
      throw new RepairError(RepairFailureCode.SERVICE_ASSET_NOT_FOUND, 'ไม่พบอุปกรณ์บริการของใบงานซ่อม', 404);
    }
    const estimates = estimateHistory(asset.metadata);
    const approvedEstimate = latestApprovedEstimate(job.id, estimates);
    if (!approvedEstimate) {
      throw new RepairError(
        RepairFailureCode.APPROVED_REPAIR_ESTIMATE_REQUIRED,
        'ต้องมีใบเสนอราคาที่ลูกค้าอนุมัติก่อนรับชำระ',
        409
      );
    }
    return { job, asset, assetRepository, approvedEstimate };
  }

  async getSettlement(actor, repairJobId) {
    const { job, asset, approvedEstimate } = await this.loadContext(this.repository, actor, repairJobId);
    const payments = paymentHistory(asset.metadata).filter(
      (payment) => Number(payment.repairJobId) === Number(job.id) && payment.status !== 'VOIDED'
    );
    return {
      repairJobId: job.id,
      repairJobNo: job.jobNo,
      payments,
      settlement: calculateSettlement({ job, approvedEstimate, payments }),
    };
  }

  async recordPayment(actor, repairJobId, rawPayload) {
    const payload = validateRepairPayment(rawPayload);
    return this.repository.transaction(async (repo) => {
      const { job, asset, assetRepository, approvedEstimate } = await this.loadContext(repo, actor, repairJobId);
      const metadata = metadataObject(asset.metadata);
      const history = paymentHistory(metadata);
      const activePayments = history.filter(
        (payment) => Number(payment.repairJobId) === Number(job.id) && payment.status !== 'VOIDED'
      );
      const before = calculateSettlement({ job, approvedEstimate, payments: activePayments });
      const nextPaidTotal = decimal(before.paidTotal).add(payload.amount);
      const approvedTotal = decimal(before.approvedTotal);
      if (nextPaidTotal.greaterThan(approvedTotal) && !payload.allowOverpayment) {
        throw new RepairError(
          RepairFailureCode.REPAIR_PAYMENT_EXCEEDS_OUTSTANDING,
          'ยอดรับชำระเกินยอดคงค้างของใบงานซ่อม',
          409,
          { outstandingBalance: before.outstandingBalance, requestedAmount: payload.amount.toFixed(2) }
        );
      }

      const payment = {
        id: crypto.randomUUID(),
        repairJobId: job.id,
        repairJobNo: job.jobNo,
        amount: payload.amount.toFixed(2),
        method: payload.method,
        reference: payload.reference,
        note: payload.note,
        status: 'RECORDED',
        receivedByEmployeeId: actor.employeeId,
        receivedAt: new Date().toISOString(),
      };
      const nextHistory = [...history, payment];
      await assetRepository.updateServiceAsset(asset.id, {
        metadata: {
          ...metadata,
          repairPayments: nextHistory,
          latestRepairPayment: payment,
        },
      });

      return {
        payment,
        settlement: calculateSettlement({
          job,
          approvedEstimate,
          payments: [...activePayments, payment],
        }),
      };
    });
  }
}

module.exports = new RepairSettlementService();
module.exports.RepairSettlementService = RepairSettlementService;
module.exports.REPAIR_PAYMENT_METHODS = REPAIR_PAYMENT_METHODS;
module.exports.paymentHistory = paymentHistory;
module.exports.validateRepairPayment = validateRepairPayment;
module.exports.calculateSettlement = calculateSettlement;
