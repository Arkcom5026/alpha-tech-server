function numberOrNull(value) {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function customerName(customer) {
  return (
    customer?.name ||
    customer?.companyName ||
    customer?.user?.email ||
    customer?.user?.loginId ||
    null
  );
}

function mapStockIdentity(stockItem) {
  if (!stockItem) return null;
  return {
    id: stockItem.id,
    barcode: stockItem.barcode,
    serialNumber: stockItem.serialNumber,
    status: stockItem.status,
    warrantyDays: stockItem.warrantyDays,
    soldAt: stockItem.soldAt,
    expiredAt: stockItem.expiredAt,
    branchId: stockItem.branchId,
    product: stockItem.product
      ? {
          id: stockItem.product.id,
          name: stockItem.product.name,
          brand: stockItem.product.brand?.name || null,
          productType: stockItem.product.productType?.name || null,
        }
      : null,
  };
}

function mapRepairJob(job) {
  return {
    id: job.id,
    jobNo: job.jobNo,
    branchId: job.branchId,
    customerId: job.customerId,
    customerName: customerName(job.customer),
    stockItemId: job.stockItemId,
    stockItem: mapStockIdentity(job.stockItem),
    deviceModel: job.deviceModel,
    reportedSymptoms: job.reportedSymptoms,
    technicianNotes: job.technicianNotes,
    status: job.status,
    estimatedCost: numberOrNull(job.estimatedCost),
    depositPaid: numberOrNull(job.depositPaid),
    technician: job.technician
      ? {
          id: job.technician.id,
          name: job.technician.name,
          phone: job.technician.phone,
        }
      : null,
    partsUsed: (job.partsUsed || []).map((part) => ({
      id: part.id,
      productId: part.productId,
      productName: part.product?.name || null,
      qtyUsed: part.qtyUsed,
      unitPrice: numberOrNull(part.unitPrice),
    })),
    warrantyClaims: (job.warrantyClaims || []).map((claim) => ({
      id: claim.id,
      claimNo: claim.claimNo,
      status: claim.status,
      repairLinkState: claim.repairLinkState,
      supplierId: claim.supplierId,
      supplierName: claim.supplier?.name || null,
      openedAt: claim.openedAt,
      resolvedAt: claim.resolvedAt,
    })),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function mapWarrantyClaim(claim) {
  return {
    id: claim.id,
    claimNo: claim.claimNo,
    branchId: claim.branchId,
    stockItemId: claim.stockItemId,
    stockItem: mapStockIdentity(claim.stockItem),
    repairJobId: claim.repairJobId,
    repairJob: claim.repairJob
      ? {
          id: claim.repairJob.id,
          jobNo: claim.repairJob.jobNo,
          status: claim.repairJob.status,
          customerId: claim.repairJob.customerId,
          customerName: customerName(claim.repairJob.customer),
        }
      : null,
    repairLinkState: claim.repairLinkState,
    supplier: claim.supplier
      ? {
          id: claim.supplier.id,
          name: claim.supplier.name,
          phone: claim.supplier.phone,
          email: claim.supplier.email,
        }
      : null,
    status: claim.status,
    reason: claim.reason,
    serviceProvider: claim.serviceProvider,
    externalClaimRef: claim.externalClaimRef,
    trackingNumber: claim.trackingNumber,
    resolution: claim.resolution,
    resolutionNote: claim.resolutionNote,
    replacementStockItemId: claim.replacementStockItemId,
    creditAmount: numberOrNull(claim.creditAmount),
    openedAt: claim.openedAt,
    submittedAt: claim.submittedAt,
    providerReceivedAt: claim.providerReceivedAt,
    resolvedAt: claim.resolvedAt,
    cancelledAt: claim.cancelledAt,
    events: (claim.events || []).map((event) => ({
      id: event.id,
      status: event.status,
      note: event.note,
      occurredAt: event.occurredAt,
      performedByEmployeeId: event.performedByEmployeeId,
      performedByName: event.performedBy?.name || null,
      metadata: event.metadata,
    })),
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
  };
}

module.exports = {
  mapRepairJob,
  mapWarrantyClaim,
  mapStockIdentity,
};
