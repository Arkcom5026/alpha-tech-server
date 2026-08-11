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

function mapRepairAsset(job) {
  if (job.stockItem) {
    return {
      sourceType: 'STOCK_ITEM',
      sourceId: job.stockItem.id,
      displayName: job.stockItem.product?.name || job.deviceModel || 'สินค้าในร้าน',
      brand: job.stockItem.product?.brand?.name || null,
      category: job.stockItem.product?.productType?.name || null,
      model: job.deviceModel || null,
      barcode: job.stockItem.barcode || job.device?.barcode || null,
      serialNumber: job.stockItem.serialNumber || job.device?.serialNumber || null,
      imei: job.device?.imei || null,
    };
  }

  if (job.device) {
    const deviceName = [job.device.brand, job.device.model].filter(Boolean).join(' ');
    return {
      sourceType: 'CUSTOMER_DEVICE',
      sourceId: job.device.id,
      displayName: deviceName || job.deviceModel || 'อุปกรณ์ของลูกค้า',
      brand: job.device.brand || null,
      category: job.device.category || null,
      model: job.device.model || job.deviceModel || null,
      barcode: job.device.barcode || null,
      serialNumber: job.device.serialNumber || null,
      imei: job.device.imei || null,
    };
  }

  return {
    sourceType: 'DESCRIBED_DEVICE',
    sourceId: null,
    displayName: job.deviceModel || 'อุปกรณ์ที่ลูกค้านำมาซ่อม',
    brand: null,
    category: null,
    model: job.deviceModel || null,
    barcode: null,
    serialNumber: null,
    imei: null,
  };
}

function mapClaimAsset(claim) {
  if (claim.stockItem) {
    return {
      sourceType: 'STOCK_ITEM',
      sourceId: claim.stockItem.id,
      displayName:
        claim.stockItem.product?.name ||
        claim.repairJob?.deviceModel ||
        'สินค้าในร้าน',
      brand: claim.stockItem.product?.brand?.name || null,
      category: claim.stockItem.product?.productType?.name || null,
      model: claim.repairJob?.deviceModel || null,
      barcode: claim.stockItem.barcode || claim.device?.barcode || null,
      serialNumber:
        claim.stockItem.serialNumber || claim.device?.serialNumber || null,
      imei: claim.device?.imei || null,
    };
  }

  if (claim.device) {
    const deviceName = [claim.device.brand, claim.device.model]
      .filter(Boolean)
      .join(' ');
    return {
      sourceType: 'CUSTOMER_DEVICE',
      sourceId: claim.device.id,
      displayName:
        deviceName || claim.repairJob?.deviceModel || 'อุปกรณ์ของลูกค้า',
      brand: claim.device.brand || null,
      category: claim.device.category || null,
      model: claim.device.model || claim.repairJob?.deviceModel || null,
      barcode: claim.device.barcode || null,
      serialNumber: claim.device.serialNumber || null,
      imei: claim.device.imei || null,
    };
  }

  return {
    sourceType: 'DESCRIBED_DEVICE',
    sourceId: null,
    displayName:
      claim.repairJob?.deviceModel || 'อุปกรณ์ในรายการเคลม',
    brand: null,
    category: null,
    model: claim.repairJob?.deviceModel || null,
    barcode: null,
    serialNumber: null,
    imei: null,
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
