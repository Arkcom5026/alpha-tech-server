const repository = require('./getWarrantyClaimOptionsRepository');
const { inferSourceSupplierId } = require('../../policies/repairIntakePolicy');
const { assertRepairCanOpenClaim, assertNoActiveClaimForJob } = require('../../policies/warrantyClaimPolicy');
const { RepairError, RepairFailureCode } = require('../../contracts/repairError');

class GetWarrantyClaimOptionsService {
  constructor(repo = repository) {
    this.repository = repo;
  }

  async execute(actor, rawRepairJobId) {
    const repairJobId = Number(rawRepairJobId);
    if (!Number.isInteger(repairJobId) || repairJobId <= 0) {
      throw new RepairError(
        RepairFailureCode.INVALID_INPUT,
        'repairJobId ไม่ถูกต้อง',
        400,
        { field: 'repairJobId' }
      );
    }

    const job = await this.repository.findRepairJob(actor.branchId, repairJobId);
    assertRepairCanOpenClaim(job);
    assertNoActiveClaimForJob(job);

    const sourceSupplierId = inferSourceSupplierId(job.stockItem);
    const sourceSupplier = job.stockItem?.purchaseOrderReceiptItem?.receipt?.supplier || null;

    if (sourceSupplierId && sourceSupplier) {
      return {
        repairJobId: job.id,
        supplierSelectionMode: 'SOURCE_LOCKED',
        sourceSupplierId: Number(sourceSupplierId),
        suppliers: [{
          id: Number(sourceSupplier.id),
          name: sourceSupplier.name,
          phone: sourceSupplier.phone || null,
          email: sourceSupplier.email || null,
          sourceMatched: true,
        }],
      };
    }

    const suppliers = await this.repository.listActiveSuppliers(actor.branchId);
    return {
      repairJobId: job.id,
      supplierSelectionMode: 'BRANCH_SELECTABLE',
      sourceSupplierId: null,
      suppliers: suppliers.map((supplier) => ({ ...supplier, sourceMatched: false })),
    };
  }
}

module.exports = new GetWarrantyClaimOptionsService();
module.exports.GetWarrantyClaimOptionsService = GetWarrantyClaimOptionsService;
