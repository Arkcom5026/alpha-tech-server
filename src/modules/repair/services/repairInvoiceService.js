const crypto = require('crypto');
const repairRepository = require('../repositories/repairRepository');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const { RepairError, RepairFailureCode } = require('../contracts/repairError');
const { estimateHistory } = require('./repairEstimateService');
const { latestApprovedEstimate } = require('./repairFinancialSummaryService');
const { paymentHistory, calculateSettlement } = require('./repairSettlementService');

function metadataObject(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
}

function invoiceHistory(metadata) {
  const history = metadataObject(metadata).repairInvoices;
  return Array.isArray(history) ? history : [];
}

function createInvoiceNumber(jobNo, sequence) {
  const normalizedJobNo = String(jobNo || 'REPAIR').replace(/[^A-Za-z0-9-]/g, '');
  return `INV-${normalizedJobNo}-${String(sequence).padStart(2, '0')}`;
}

class RepairInvoiceService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async loadContext(repo, actor, repairJobId) {
    const job = await repo.findRepairJob(actor.branchId, repairJobId);
    if (!job) {
      throw new RepairError(RepairFailureCode.REPAIR_JOB_NOT_FOUND, 'ไม่พบใบงานซ่อมในสาขานี้', 404);
    }
    if (!job.serviceAssetId) {
      throw new RepairError(RepairFailureCode.SERVICE_ASSET_REQUIRED, 'ใบงานซ่อมต้องเชื่อมกับอุปกรณ์บริการก่อนออกใบแจ้งค่าซ่อม', 409);
    }

    const assetRepository = new ServiceAssetRepository(repo.prisma);
    const asset = await assetRepository.findServiceAsset(actor.branchId, job.serviceAssetId);
    if (!asset) {
      throw new RepairError(RepairFailureCode.SERVICE_ASSET_NOT_FOUND, 'ไม่พบอุปกรณ์บริการของใบงานซ่อม', 404);
    }

    const approvedEstimate = latestApprovedEstimate(job.id, estimateHistory(asset.metadata));
    if (!approvedEstimate) {
      throw new RepairError(
        RepairFailureCode.APPROVED_REPAIR_ESTIMATE_REQUIRED,
        'ต้องมีใบเสนอราคาที่ลูกค้าอนุมัติก่อนออกใบแจ้งค่าซ่อม',
        409
      );
    }

    const activePayments = paymentHistory(asset.metadata).filter(
      (payment) => Number(payment.repairJobId) === Number(job.id) && payment.status !== 'VOIDED'
    );
    const settlement = calculateSettlement({ job, approvedEstimate, payments: activePayments });

    return { job, asset, assetRepository, approvedEstimate, activePayments, settlement };
  }

  async listInvoices(actor, repairJobId) {
    const { job, asset } = await this.loadContext(this.repository, actor, repairJobId);
    return invoiceHistory(asset.metadata).filter(
      (invoice) => Number(invoice.repairJobId) === Number(job.id)
    );
  }

  async issueInvoice(actor, repairJobId, rawPayload = {}) {
    return this.repository.transaction(async (repo) => {
      const { job, asset, assetRepository, approvedEstimate, settlement } = await this.loadContext(
        repo,
        actor,
        repairJobId
      );
      const metadata = metadataObject(asset.metadata);
      const invoices = invoiceHistory(metadata);
      const existing = invoices.find(
        (invoice) => Number(invoice.repairJobId) === Number(job.id) && invoice.status === 'ISSUED'
      );
      if (existing) {
        return { invoice: existing, settlement, idempotent: true };
      }

      const note = rawPayload.note == null ? null : String(rawPayload.note).trim() || null;
      if (note && note.length > 2000) {
        throw new RepairError(RepairFailureCode.INVALID_INPUT, 'note ยาวเกิน 2000 ตัวอักษร', 400);
      }

      const sequence = invoices.filter(
        (invoice) => Number(invoice.repairJobId) === Number(job.id)
      ).length + 1;
      const issuedAt = new Date().toISOString();
      const invoice = {
        id: crypto.randomUUID(),
        invoiceNo: createInvoiceNumber(job.jobNo, sequence),
        repairJobId: job.id,
        repairJobNo: job.jobNo,
        estimateId: approvedEstimate.id,
        status: 'ISSUED',
        currency: approvedEstimate.currency || 'THB',
        subtotal: String(approvedEstimate.subtotal || approvedEstimate.total || '0.00'),
        total: String(approvedEstimate.total || '0.00'),
        depositApplied: settlement.depositPaid,
        paymentApplied: settlement.paymentTotal,
        paidTotal: settlement.paidTotal,
        outstandingBalance: settlement.outstandingBalance,
        settlementStatus: settlement.status,
        note,
        issuedByEmployeeId: actor.employeeId,
        issuedAt,
      };

      await assetRepository.updateServiceAsset(asset.id, {
        metadata: {
          ...metadata,
          repairInvoices: [...invoices, invoice],
          latestRepairInvoice: invoice,
        },
      });

      return { invoice, settlement, idempotent: false };
    });
  }
}

module.exports = new RepairInvoiceService();
module.exports.RepairInvoiceService = RepairInvoiceService;
module.exports.invoiceHistory = invoiceHistory;
module.exports.createInvoiceNumber = createInvoiceNumber;
