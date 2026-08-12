const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');
const {
  WARRANTY_CLAIM_RESOLUTIONS,
} = require('../contracts/repairContract');

function requiredText(value, fieldName, maxLength = 2000) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `กรุณาระบุ ${fieldName}`,
      400,
      { field: fieldName }
    );
  }
  if (normalized.length > maxLength) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `${fieldName} ยาวเกิน ${maxLength} ตัวอักษร`,
      400,
      { field: fieldName, maxLength }
    );
  }
  return normalized;
}

function optionalText(value, maxLength = 2000) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim();
  if (normalized.length > maxLength) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `ข้อความยาวเกิน ${maxLength} ตัวอักษร`,
      400
    );
  }
  return normalized || null;
}

function positiveInt(value, fieldName, { optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `${fieldName} ต้องเป็นจำนวนเต็มมากกว่า 0`,
      400,
      { field: fieldName }
    );
  }
  return parsed;
}

function nonNegativeMoney(value, fieldName, defaultValue = 0) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `${fieldName} ต้องเป็นจำนวนตั้งแต่ 0 ขึ้นไป`,
      400,
      { field: fieldName }
    );
  }
  return parsed;
}

function optionalNonNegativeMoney(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  return nonNegativeMoney(value, fieldName, 0);
}

function booleanValue(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  return value === true || value === 'true' || value === 1 || value === '1';
}

function validateLookup(rawLookup) {
  const lookup = typeof rawLookup === 'string' ? rawLookup.trim() : '';
  if (!lookup || lookup.length > 160) {
    throw new RepairError(
      RepairFailureCode.INVALID_LOOKUP,
      'กรุณาระบุบาร์โค้ดหรือหมายเลขซีเรียลที่ถูกต้อง',
      400
    );
  }
  return lookup;
}

function validateSearchQuery(rawQuery) {
  const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
  if (!query || query.length > 160) {
    throw new RepairError(
      RepairFailureCode.INVALID_LOOKUP,
      'กรุณาระบุชื่อ เบอร์โทร รุ่น ยี่ห้อ หรือรหัสอุปกรณ์ที่ถูกต้อง',
      400
    );
  }
  return query;
}

function validatePreAgreedService(rawValue, _estimatedCost) {
  const value = rawValue && typeof rawValue === 'object' ? rawValue : {};
  if (!booleanValue(value.enabled, false)) return null;

  return {
    enabled: true,
    authorizationMode: 'REPAIR_AUTHORIZED',
    agreedScope:
      optionalText(value.agreedScope, 2000) ||
      'ลูกค้าอนุมัติให้ดำเนินการซ่อมตามอาการที่แจ้ง',
    agreedAmount: optionalNonNegativeMoney(
      value.agreedAmount,
      'preAgreedService.agreedAmount'
    ),
    confirmedByName: requiredText(value.confirmedByName, 'ชื่อผู้อนุมัติให้ซ่อม', 255),
    confirmationNote: optionalText(value.confirmationNote, 2000),
  };
}

function validateCreateRepairJob(payload = {}) {
  const estimatedCost = nonNegativeMoney(payload.estimatedCost, 'estimatedCost', 0);
  const preAgreedService = validatePreAgreedService(payload.preAgreedService, estimatedCost);
  const assetDescription = requiredText(payload.assetDescription ?? payload.deviceModel, 'assetDescription', 255);

  return {
    customerId: positiveInt(payload.customerId, 'customerId'),
    stockItemId: positiveInt(payload.stockItemId, 'stockItemId', { optional: true }),
    deviceId: positiveInt(payload.deviceId, 'deviceId', { optional: true }),
    assetDescription,
    deviceModel: assetDescription,
    reportedSymptoms: requiredText(payload.reportedSymptoms, 'อาการที่ลูกค้าแจ้ง', 4000),
    depositPaid: nonNegativeMoney(payload.depositPaid, 'depositPaid', 0),
    estimatedCost,
    technicianId: positiveInt(payload.technicianId, 'technicianId', { optional: true }),
    technicianNotes: optionalText(payload.technicianNotes, 4000),
    allowCustomerOverride: booleanValue(payload.allowCustomerOverride, false),
    ...(preAgreedService ? { preAgreedService } : {}),
  };
}

function validateRepairStatusUpdate(payload = {}) {
  const status = requiredText(payload.status, 'status', 60).toUpperCase();
  return {
    status,
    technicianId: positiveInt(payload.technicianId, 'technicianId', { optional: true }),
    technicianNotes: optionalText(payload.technicianNotes, 4000),
  };
}

function validateAddPart(payload = {}) {
  const qtyUsed = positiveInt(payload.qtyUsed, 'qtyUsed');
  return {
    productId: positiveInt(payload.productId, 'productId'),
    stockItemId: positiveInt(payload.stockItemId, 'stockItemId', { optional: true }),
    qtyUsed,
  };
}

function validateOpenWarrantyClaim(payload = {}) {
  return {
    supplierId: positiveInt(payload.supplierId, 'supplierId', { optional: true }),
    reason: requiredText(payload.reason, 'เหตุผลในการส่งเคลม', 4000),
    serviceProvider: optionalText(payload.serviceProvider, 255),
    externalClaimRef: optionalText(payload.externalClaimRef, 255),
    trackingNumber: optionalText(payload.trackingNumber, 255),
    note: optionalText(payload.note, 4000),
  };
}

function validateClaimStatusUpdate(payload = {}) {
  const status = requiredText(payload.status, 'status', 80).toUpperCase();
  const expectedStatus = payload.expectedStatus
    ? requiredText(payload.expectedStatus, 'expectedStatus', 80).toUpperCase()
    : null;
  const resolution = payload.resolution
    ? requiredText(payload.resolution, 'resolution', 80).toUpperCase()
    : null;

  if (resolution && !WARRANTY_CLAIM_RESOLUTIONS.includes(resolution)) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      'ผลการเคลมไม่อยู่ในค่าที่ระบบรองรับ',
      400,
      { resolution }
    );
  }

  return {
    status,
    expectedStatus,
    note: optionalText(payload.note, 4000),
    externalClaimRef: optionalText(payload.externalClaimRef, 255),
    trackingNumber: optionalText(payload.trackingNumber, 255),
    serviceProvider: optionalText(payload.serviceProvider, 255),
    resolution,
    resolutionNote: optionalText(payload.resolutionNote, 4000),
    replacementStockItemId: positiveInt(
      payload.replacementStockItemId,
      'replacementStockItemId',
      { optional: true }
    ),
    creditAmount: optionalNonNegativeMoney(payload.creditAmount, 'creditAmount'),
  };
}

function validateListQuery(query = {}) {
  const parsedLimit = Number(query.limit || 50);
  const parsedOffset = Number(query.offset || 0);

  return {
    status: query.status ? String(query.status).trim().toUpperCase() : null,
    stockItemId: positiveInt(query.stockItemId, 'stockItemId', { optional: true }),
    customerId: positiveInt(query.customerId, 'customerId', { optional: true }),
    limit: Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50,
    offset: Number.isInteger(parsedOffset) ? Math.max(parsedOffset, 0) : 0,
  };
}

module.exports = {
  requiredText,
  optionalText,
  positiveInt,
  nonNegativeMoney,
  booleanValue,
  validateLookup,
  validateSearchQuery,
  validateCreateRepairJob,
  validatePreAgreedService,
  validateRepairStatusUpdate,
  validateAddPart,
  validateOpenWarrantyClaim,
  validateClaimStatusUpdate,
  validateListQuery,
};
