const repository = require('../repository/missingCostResolutionRecoveryAuditRepository');
const {
  assertBranchId,
  assertResolutionId,
  createNotFoundError,
} = require('../../runtime/service/missingCostResolutionReadService');

const mapExecutionEvent = (event) => ({
  id: event.id,
  eventType: event.eventType,
  eventHash: event.eventHash,
  evidenceHash: event.evidenceHash,
  candidateSnapshotHash: event.candidateSnapshotHash,
  reasonCode: event.reasonCode,
  note: event.note,
  occurredAt: event.occurredAt,
  approvedVersion: event.version ? {
    id: event.version.id,
    version: event.version.version,
    evidenceHash: event.version.evidenceHash,
    proposedUnitCost: event.version.proposedUnitCost == null
      ? null
      : Number(event.version.proposedUnitCost),
    approvedAt: event.version.approvedAt,
    approvedByEmployeeId: event.version.approvedByEmployeeId,
  } : null,
});

class MissingCostResolutionRecoveryAuditService {
  constructor(auditRepository = repository) {
    this.repository = auditRepository;
  }

  async getPostRecoveryAudit({ branchId, resolutionId }) {
    const scopedBranchId = assertBranchId(branchId);
    const scopedResolutionId = assertResolutionId(resolutionId);
    const latest = await this.repository.findLatestExecution({
      branchId: scopedBranchId,
      resolutionId: scopedResolutionId,
    });
    if (!latest) throw createNotFoundError();

    const history = await this.repository.findExecutionHistory({
      branchId: scopedBranchId,
      resolutionId: scopedResolutionId,
    });
    const stockBalance = latest.resolution.stockBalance;

    return {
      apiVersion: 'missing-cost-recovery-audit-v1',
      mode: 'POST_RECOVERY_AUDIT_READ_ONLY',
      branchId: scopedBranchId,
      resolutionId: scopedResolutionId,
      latestExecution: mapExecutionEvent(latest),
      resultingInventoryAuthority: {
        stockBalanceId: stockBalance.id,
        branchId: stockBalance.branchId,
        productId: stockBalance.productId,
        quantity: Number(stockBalance.quantity),
        avgCost: stockBalance.avgCost == null ? null : Number(stockBalance.avgCost),
        lastReceivedCost: stockBalance.lastReceivedCost == null
          ? null
          : Number(stockBalance.lastReceivedCost),
        inventoryValue: Number(stockBalance.quantity)
          * Number(stockBalance.avgCost || 0),
      },
      immutableExecutionHistory: history.map(mapExecutionEvent),
      mutationPerformed: false,
    };
  }
}

module.exports = new MissingCostResolutionRecoveryAuditService();
module.exports.MissingCostResolutionRecoveryAuditService = MissingCostResolutionRecoveryAuditService;
module.exports.mapExecutionEvent = mapExecutionEvent;
