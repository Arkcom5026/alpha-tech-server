const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');
const {
  REPAIR_ACTIVE_STATUSES,
  CLAIM_ACTIVE_STATUSES,
} = require('../contracts/repairContract');

function assertStockItemBranch(stockItem, branchId) {
  if (!stockItem) {
    throw new RepairError(
      RepairFailureCode.STOCK_ITEM_NOT_FOUND,
      'ไม่พบสินค้าตามบาร์โค้ด หมายเลขซีเรียล หรือรหัสสินค้าในระบบ',
      404
    );
  }

  if (Number(stockItem.branchId) !== Number(branchId)) {
    throw new RepairError(
      RepairFailureCode.STOCK_ITEM_BRANCH_MISMATCH,
      'สินค้ารายการนี้ไม่ได้อยู่ภายใต้สาขาของผู้ใช้งาน',
      403
    );
  }
}

function assertNoActiveRepair(stockItem) {
  const activeRepair = (stockItem.repairJobs || []).find((job) =>
    REPAIR_ACTIVE_STATUSES.includes(job.status)
  );

  if (activeRepair) {
    throw new RepairError(
      RepairFailureCode.ACTIVE_REPAIR_EXISTS,
      'สินค้ารายการนี้มีงานซ่อมที่กำลังดำเนินการอยู่แล้ว',
      409,
      {
        repairJobId: activeRepair.id,
        jobNo: activeRepair.jobNo,
        status: activeRepair.status,
      }
    );
  }
}

function assertNoActiveClaim(stockItem) {
  const activeClaim = (stockItem.warrantyClaims || []).find((claim) =>
    CLAIM_ACTIVE_STATUSES.includes(claim.status)
  );

  if (activeClaim) {
    throw new RepairError(
      RepairFailureCode.ACTIVE_CLAIM_EXISTS,
      'สินค้ารายการนี้มีเคลมที่กำลังดำเนินการอยู่แล้ว',
      409,
      {
        warrantyClaimId: activeClaim.id,
        claimNo: activeClaim.claimNo,
        status: activeClaim.status,
      }
    );
  }
}

function assertCustomerMatchesLatestSale(stockItem, customerId, allowOverride) {
  const latestSaleItem = (stockItem.saleItems || [])
    .filter((item) => item.sale)
    .sort((a, b) => new Date(b.sale.soldAt) - new Date(a.sale.soldAt))[0];

  const soldCustomerId = latestSaleItem?.sale?.customerId || null;

  if (
    soldCustomerId &&
    Number(soldCustomerId) !== Number(customerId) &&
    !allowOverride
  ) {
    throw new RepairError(
      RepairFailureCode.STOCK_ITEM_CUSTOMER_MISMATCH,
      'ลูกค้าที่นำสินค้ามารับบริการไม่ตรงกับผู้ซื้อในประวัติการขาย กรุณาให้ผู้จัดการยืนยันการรับแทน',
      409,
      {
        expectedCustomerId: soldCustomerId,
        providedCustomerId: customerId,
      }
    );
  }
}

function inferSourceSupplierId(stockItem) {
  return stockItem?.purchaseOrderReceiptItem?.receipt?.supplierId || null;
}

module.exports = {
  assertStockItemBranch,
  assertNoActiveRepair,
  assertNoActiveClaim,
  assertCustomerMatchesLatestSale,
  inferSourceSupplierId,
};
