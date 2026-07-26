const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');
const {
  WARRANTY_CLAIM_RESOLUTIONS,
} = require('../contracts/repairContract');

const REPAIR_DIAGNOSIS_CONCLUSIONS = Object.freeze([
  'REPAIRABLE',
  'WARRANTY_CLAIM',
  'NO_FAULT_FOUND',
  'NOT_REPAIRABLE',
  'NEEDS_FURTHER_INSPECTION',
]);
const REPAIR_ESTIMATE_ITEM_TYPES = Object.freeze([
  'LABOR',
  'PART',
  'SERVICE',
  'OTHER',
]);
const REPAIR_ESTIMATE_DECISIONS = Object.freeze(['APPROVED', 'REJECTED']);

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

function optionalDate(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `${fieldName} ต้องเป็นวันที่ที่ถูกต้อง`,
      400,
      { field: fieldName }
    );
  }
  return parsed;
}

function textList(value, fieldName, maxItems = 30) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `${fieldName} ต้องเป็นรายการไม่เกิน ${maxItems} รายการ`,
      400,
      { field: fieldName }
    );
  }
  return value.map((item) => optionalText(item, 255)).filter(Boolean);
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
  return Number(parsed.toFixed(2));
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

function validateCreateRepairJob(payload = {}) {
  return {
    customerId: positiveInt(payload.customerId, 'customerId'),
    serviceAssetId: positiveInt(payload.serviceAssetId, 'serviceAssetId', { optional: true }),
    stockItemId: positiveInt(payload.stockItemId, 'stockItemId', { optional: true }),
    deviceType: optionalText(payload.deviceType, 255),
    brandName: optionalText(payload.brandName, 255),
    modelName: optionalText(payload.modelName, 255),
    serialNumber: optionalText(payload.serialNumber, 255),
    customerAssetTag: optionalText(payload.customerAssetTag, 255),
    color: optionalText(payload.color, 120),
    assetDescription: optionalText(payload.assetDescription, 2000),
    accessories: textList(payload.accessories, 'accessories'),
    physicalCondition: optionalText(payload.physicalCondition, 4000),
    accessInstructions: optionalText(payload.accessInstructions, 2000),
    purchaseSource: optionalText(payload.purchaseSource, 255),
    purchaseDate: optionalDate(payload.purchaseDate, 'purchaseDate'),
    externalWarrantyUntil: optionalDate(payload.externalWarrantyUntil, 'externalWarrantyUntil'),
    externalWarrantyNote: optionalText(payload.externalWarrantyNote, 2000),
    deviceModel: requiredText(payload.deviceModel || payload.modelName, 'รุ่นหรือรายละเอียดอุปกรณ์', 255),
    reportedSymptoms: requiredText(payload.reportedSymptoms, 'อาการที่ลูกค้าแจ้ง', 4000),
    depositPaid: nonNegativeMoney(payload.depositPaid, 'depositPaid', 0),
    estimatedCost: nonNegativeMoney(payload.estimatedCost, 'estimatedCost', 0),
    technicianId: positiveInt(payload.technicianId, 'technicianId', { optional: true }),
    technicianNotes: optionalText(payload.technicianNotes, 4000),
    allowCustomerOverride: booleanValue(payload.allowCustomerOverride, false),
  };
}

function validateRepairStatusUpdate(payload = {}) {
  return {
    status: requiredText(payload.status, 'status', 60).toUpperCase(),
    technicianId: positiveInt(payload.technicianId, 'technicianId', { optional: true }),
    technicianNotes: optionalText(payload.technicianNotes, 4000),
  };
}

function validateRepairHandover(payload = {}) {
  return {
    receiverName: requiredText(payload.receiverName, 'ชื่อผู้รับเครื่อง', 255),
    receiverPhone: optionalText(payload.receiverPhone, 80),
    receiverRelation: optionalText(payload.receiverRelation, 120),
    signatureRef: requiredText(payload.signatureRef, 'หลักฐานลายเซ็นผู้รับเครื่อง', 1000),
    identityReference: optionalText(payload.identityReference, 255),
    note: optionalText(payload.note, 4000),
  };
}

function validateRepairDiagnosis(payload = {}) {
  const conclusion = requiredText(payload.conclusion, 'ผลสรุปการตรวจ', 80).toUpperCase();
  if (!REPAIR_DIAGNOSIS_CONCLUSIONS.includes(conclusion)) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      'ผลสรุปการตรวจไม่อยู่ในค่าที่ระบบรองรับ',
      400,
      { conclusion, allowed: REPAIR_DIAGNOSIS_CONCLUSIONS }
    );
  }
  return {
    conclusion,
    findings: requiredText(payload.findings, 'ผลการตรวจพบ', 4000),
    rootCause: optionalText(payload.rootCause, 4000),
    recommendedAction: requiredText(payload.recommendedAction, 'แนวทางดำเนินการ', 4000),
    note: optionalText(payload.note, 4000),
  };
}

function validateRepairEstimate(payload = {}) {
  if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 50) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      'รายการเสนอราคาต้องมีอย่างน้อย 1 รายการและไม่เกิน 50 รายการ',
      400,
      { field: 'items' }
    );
  }
  const items = payload.items.map((item, index) => {
    const type = requiredText(item?.type, `items[${index}].type`, 40).toUpperCase();
    if (!REPAIR_ESTIMATE_ITEM_TYPES.includes(type)) {
      throw new RepairError(
        RepairFailureCode.INVALID_INPUT,
        'ประเภทรายการเสนอราคาไม่อยู่ในค่าที่ระบบรองรับ',
        400,
        { index, type, allowed: REPAIR_ESTIMATE_ITEM_TYPES }
      );
    }
    const quantity = positiveInt(item.quantity ?? 1, `items[${index}].quantity`);
    const unitPrice = nonNegativeMoney(item.unitPrice, `items[${index}].unitPrice`);
    return {
      type,
      description: requiredText(item.description, `items[${index}].description`, 500),
      quantity,
      unitPrice,
      amount: Number((quantity * unitPrice).toFixed(2)),
    };
  });
  return {
    diagnosisId: requiredText(payload.diagnosisId, 'diagnosisId', 100),
    items,
    note: optionalText(payload.note, 4000),
    validUntil: optionalDate(payload.validUntil, 'validUntil'),
  };
}

function validateRepairEstimateDecision(payload = {}) {
  const decision = requiredText(payload.decision, 'decision', 40).toUpperCase();
  if (!REPAIR_ESTIMATE_DECISIONS.includes(decision)) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      'ผลการตัดสินใจต้องเป็น APPROVED หรือ REJECTED',
      400,
      { decision }
    );
  }
  return {
    decision,
    decidedByName: optionalText(payload.decidedByName, 255),
    note: optionalText(payload.note, 4000),
  };
}

function validateAddPart(payload = {}) {
  return {
    productId: positiveInt(payload.productId, 'productId'),
    qtyUsed: positiveInt(payload.qtyUsed, 'qtyUsed'),
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
    note: optionalText(payload.note, 4000),
    externalClaimRef: optionalText(payload.externalClaimRef, 255),
    trackingNumber: optionalText(payload.trackingNumber, 255),
    serviceProvider: optionalText(payload.serviceProvider, 255),
    resolution,
    resolutionNote: optionalText(payload.resolutionNote, 4000),
    replacementStockItemId: positiveInt(payload.replacementStockItemId, 'replacementStockItemId', { optional: true }),
    creditAmount:
      payload.creditAmount === undefined || payload.creditAmount === null
        ? null
        : nonNegativeMoney(payload.creditAmount, 'creditAmount', 0),
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
  REPAIR_DIAGNOSIS_CONCLUSIONS,
  REPAIR_ESTIMATE_ITEM_TYPES,
  REPAIR_ESTIMATE_DECISIONS,
  validateLookup,
  validateCreateRepairJob,
  validateRepairStatusUpdate,
  validateRepairHandover,
  validateRepairDiagnosis,
  validateRepairEstimate,
  validateRepairEstimateDecision,
  validateAddPart,
  validateOpenWarrantyClaim,
  validateClaimStatusUpdate,
  validateListQuery,
};
