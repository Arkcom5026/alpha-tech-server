const {
  REPAIR_ACTIVE_STATUSES,
  CLAIM_ACTIVE_STATUSES,
} = require('../contracts/repairContract');
const { mapStockIdentity } = require('./repairMapper');

function latest(items, dateSelector) {
  return [...(items || [])].sort(
    (a, b) => new Date(dateSelector(b)) - new Date(dateSelector(a))
  )[0] || null;
}

function resolveWarranty(stockItem) {
  const start = stockItem.soldAt ? new Date(stockItem.soldAt) : null;
  const days = stockItem.warrantyDays ?? stockItem.product?.warrantyDays ?? null;
  const explicitExpiry = stockItem.expiredAt ? new Date(stockItem.expiredAt) : null;
  const computedExpiry =
    !explicitExpiry && start && Number.isInteger(days)
      ? new Date(start.getTime() + days * 24 * 60 * 60 * 1000)
      : null;
  const expiresAt = explicitExpiry || computedExpiry;

  return {
    warrantyDays: days,
    startsAt: start,
    expiresAt,
    isExpired: expiresAt ? expiresAt.getTime() < Date.now() : null,
  };
}

function mapIntakeContext(stockItem) {
  const latestSaleItem = latest(stockItem.saleItems, (item) => item.sale?.soldAt || 0);
  const latestRepair = latest(stockItem.repairJobs, (item) => item.createdAt);
  const latestClaim = latest(stockItem.warrantyClaims, (item) => item.openedAt);
  const activeRepair = (stockItem.repairJobs || []).find((job) =>
    REPAIR_ACTIVE_STATUSES.includes(job.status)
  ) || null;
  const activeClaim = (stockItem.warrantyClaims || []).find((claim) =>
    CLAIM_ACTIVE_STATUSES.includes(claim.status)
  ) || null;
  const sourceReceipt = stockItem.purchaseOrderReceiptItem?.receipt || null;

  const recommendedActions = [];
  if (activeClaim) {
    recommendedActions.push({
      type: 'OPEN_ACTIVE_CLAIM',
      priority: 1,
      referenceId: activeClaim.id,
      reason: 'สินค้ามีเคลมที่กำลังดำเนินการอยู่',
    });
  } else if (activeRepair) {
    recommendedActions.push({
      type: 'OPEN_ACTIVE_REPAIR',
      priority: 1,
      referenceId: activeRepair.id,
      reason: 'สินค้ามีงานซ่อมที่กำลังดำเนินการอยู่',
    });
  } else {
    recommendedActions.push({
      type: 'CREATE_REPAIR_JOB',
      priority: 1,
      reason: 'ยังไม่มีงานซ่อมหรือเคลมที่กำลังดำเนินการ',
    });
  }

  const warranty = resolveWarranty(stockItem);
  if (!activeClaim && !warranty.isExpired && sourceReceipt?.supplierId) {
    recommendedActions.push({
      type: 'ASSESS_WARRANTY_CLAIM',
      priority: 2,
      reason: 'พบผู้จำหน่ายต้นทางและสิทธิ์ประกันยังไม่หมดอายุ',
    });
  }

  return {
    identity: mapStockIdentity(stockItem),
    warranty,
    procurement: sourceReceipt
      ? {
          receiptId: sourceReceipt.id,
          receiptCode: sourceReceipt.code,
          receivedAt: sourceReceipt.receivedAt,
          supplier: sourceReceipt.supplier
            ? {
                id: sourceReceipt.supplier.id,
                name: sourceReceipt.supplier.name,
                phone: sourceReceipt.supplier.phone,
                email: sourceReceipt.supplier.email,
              }
            : null,
        }
      : null,
    latestSale: latestSaleItem?.sale
      ? {
          id: latestSaleItem.sale.id,
          code: latestSaleItem.sale.code,
          soldAt: latestSaleItem.sale.soldAt,
          customerId: latestSaleItem.sale.customerId,
          customerName:
            latestSaleItem.sale.customer?.name ||
            latestSaleItem.sale.customer?.companyName ||
            latestSaleItem.sale.customer?.user?.email ||
            null,
          price: Number(latestSaleItem.price),
        }
      : null,
    latestRepair: latestRepair
      ? {
          id: latestRepair.id,
          jobNo: latestRepair.jobNo,
          status: latestRepair.status,
          createdAt: latestRepair.createdAt,
        }
      : null,
    latestClaim: latestClaim
      ? {
          id: latestClaim.id,
          claimNo: latestClaim.claimNo,
          status: latestClaim.status,
          repairJobId: latestClaim.repairJobId,
          repairLinkState: latestClaim.repairLinkState,
          openedAt: latestClaim.openedAt,
        }
      : null,
    activeProcesses: {
      repair: activeRepair
        ? {
            id: activeRepair.id,
            jobNo: activeRepair.jobNo,
            status: activeRepair.status,
          }
        : null,
      claim: activeClaim
        ? {
            id: activeClaim.id,
            claimNo: activeClaim.claimNo,
            status: activeClaim.status,
          }
        : null,
    },
    recommendedActions,
  };
}

module.exports = {
  mapIntakeContext,
};
