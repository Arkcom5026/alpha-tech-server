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

function mapCustomer(customer) {
  if (!customer) return null;

  return {
    id: customer.id,
    name: customerName(customer),
    phone: customer.phone || customer.user?.phone || null,
    email: customer.email || customer.user?.email || null,
    companyName: customer.companyName || null,
  };
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

function mapDeviceIdentity(device) {
  if (!device) return null;
  return {
    id: device.id,
    category: device.category,
    brand: device.brand,
    model: device.model,
    serialNumber: device.serialNumber,
    imei: device.imei,
    barcode: device.barcode,
    status: device.status,
  };
}

function nonEmpty(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function mapRepairAsset(job) {
  const intake = job.deviceIntake || null;
  const snapshot = intake?.snapshot || null;
  const device = job.device || null;
  const stockItem = job.stockItem || null;
  const legacyDeviceName = [device?.brand, device?.model].filter(Boolean).join(' ');

  const displayName =
    nonEmpty(intake?.assetDescription) ||
    nonEmpty(job.deviceModel) ||
    nonEmpty(stockItem?.product?.name) ||
    nonEmpty(legacyDeviceName) ||
    'อุปกรณ์ที่ลูกค้านำมาซ่อม';

  const sourceType = snapshot
    ? 'INTAKE_SNAPSHOT'
    : intake
      ? 'DEVICE_INTAKE'
      : stockItem
        ? 'STOCK_ITEM'
        : device
          ? 'CUSTOMER_DEVICE'
          : 'DESCRIBED_DEVICE';

  const sourceId = snapshot?.id ?? intake?.id ?? stockItem?.id ?? device?.id ?? null;

  return {
    sourceType,
    sourceId,
    displayName,
    brand:
      nonEmpty(snapshot?.brand) ||
      nonEmpty(device?.brand) ||
      nonEmpty(stockItem?.product?.brand?.name),
    category:
      nonEmpty(device?.category) ||
      nonEmpty(stockItem?.product?.productType?.name),
    model:
      nonEmpty(snapshot?.model) ||
      nonEmpty(device?.model),
    barcode:
      nonEmpty(snapshot?.barcode) ||
      nonEmpty(stockItem?.barcode) ||
      nonEmpty(device?.barcode),
    serialNumber:
      nonEmpty(snapshot?.serialNumber) ||
      nonEmpty(stockItem?.serialNumber) ||
      nonEmpty(device?.serialNumber),
    imei:
      nonEmpty(snapshot?.imei) ||
      nonEmpty(device?.imei),
  };
}

function mapClaimAsset(claim) {
  const repairJob = claim.repairJob || null;
  const intake = repairJob?.deviceIntake || null;
  const snapshot = intake?.snapshot || null;
  const stockItem = claim.stockItem || null;
  const device = claim.device || null;
  const legacyDeviceName = [device?.brand, device?.model].filter(Boolean).join(' ');

  const displayName =
    nonEmpty(intake?.assetDescription) ||
    nonEmpty(repairJob?.deviceModel) ||
    nonEmpty(stockItem?.product?.name) ||
    nonEmpty(legacyDeviceName) ||
    (repairJob ? 'อุปกรณ์ในใบงานซ่อม' : 'อุปกรณ์ในรายการเคลม');

  const sourceType = snapshot
    ? 'INTAKE_SNAPSHOT'
    : intake
      ? 'DEVICE_INTAKE'
      : stockItem
        ? 'STOCK_ITEM'
        : device
          ? 'CUSTOMER_DEVICE'
          : 'DESCRIBED_DEVICE';

  const sourceId = snapshot?.id ?? intake?.id ?? stockItem?.id ?? device?.id ?? null;

  return {
    sourceType,
    sourceId,
    displayName,
    brand:
      nonEmpty(snapshot?.brand) ||
      nonEmpty(device?.brand) ||
      nonEmpty(stockItem?.product?.brand?.name),
    category:
      nonEmpty(device?.category) ||
      nonEmpty(stockItem?.product?.productType?.name),
    model:
      nonEmpty(snapshot?.model) ||
      nonEmpty(device?.model),
    barcode:
      nonEmpty(snapshot?.barcode) ||
      nonEmpty(stockItem?.barcode) ||
      nonEmpty(device?.barcode),
    serialNumber:
      nonEmpty(snapshot?.serialNumber) ||
      nonEmpty(stockItem?.serialNumber) ||
      nonEmpty(device?.serialNumber),
    imei:
      nonEmpty(snapshot?.imei) ||
      nonEmpty(device?.imei),
  };
}

function mapActiveSubcontract(job) {
  const subcontract = Array.isArray(job.subcontracts) ? job.subcontracts[0] : null;
  if (!subcontract) return null;

  return {
    id: subcontract.id,
    expensePayeeId: subcontract.expensePayeeId,
    status: subcontract.status,
    providerName: subcontract.providerName,
    providerPhone: subcontract.providerPhone || null,
    workScope: subcontract.workScope,
    sentAt: subcontract.sentAt,
    expectedReturnAt: subcontract.expectedReturnAt || null,
    returnRequestedAt: subcontract.returnRequestedAt || null,
    active: ['SENT', 'RETURN_REQUESTED'].includes(subcontract.status),
  };
}

function mapRepairJob(job) {
  const customer = mapCustomer(job.customer);

  return {
    id: job.id,
    jobNo: job.jobNo,
    branchId: job.branchId,
    customerId: job.customerId,
    customerName: customer?.name || null,
    customer,
    stockItemId: job.stockItemId,
    stockItem: mapStockIdentity(job.stockItem),
    deviceId: job.deviceId ?? job.device?.id ?? null,
    device: mapDeviceIdentity(job.device),
    repairAsset: mapRepairAsset(job),
    assetDescription: job.deviceIntake?.assetDescription || job.deviceModel,
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
    activeSubcontract: mapActiveSubcontract(job),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function mapWarrantyClaim(claim) {
  const customer = mapCustomer(claim.repairJob?.customer);

  return {
    id: claim.id,
    claimNo: claim.claimNo,
    branchId: claim.branchId,
    stockItemId: claim.stockItemId,
    stockItem: mapStockIdentity(claim.stockItem),
    deviceId: claim.deviceId ?? claim.device?.id ?? null,
    device: mapDeviceIdentity(claim.device),
    claimAsset: mapClaimAsset(claim),
    repairJobId: claim.repairJobId,
    repairJob: claim.repairJob
      ? {
          id: claim.repairJob.id,
          jobNo: claim.repairJob.jobNo,
          status: claim.repairJob.status,
          customerId: claim.repairJob.customerId,
          customerName: customer?.name || null,
          customer,
          deviceModel: claim.repairJob.deviceModel,
          reportedSymptoms: claim.repairJob.reportedSymptoms,
        }
      : null,
    source: claim.repairJob
      ? {
          type: 'REPAIR_JOB',
          id: claim.repairJob.id,
          referenceNo: claim.repairJob.jobNo,
          label: 'งานซ่อม',
        }
      : {
          type: 'DIRECT_CLAIM',
          id: null,
          referenceNo: null,
          label: 'เคลมโดยตรง',
        },
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
    replacementStockItem: mapStockIdentity(claim.replacementStockItem),
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
  mapDeviceIdentity,
  mapRepairAsset,
  mapClaimAsset,
  mapActiveSubcontract,
};
