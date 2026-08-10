const { RepairError, RepairFailureCode } = require('../contracts/repairError');

const DEVICE_CATEGORIES = new Set([
  'DESKTOP_COMPUTER',
  'NOTEBOOK',
  'PRINTER',
  'MONITOR',
  'UPS',
  'NETWORK_DEVICE',
  'MOBILE_DEVICE',
  'TABLET',
  'STORAGE_DEVICE',
  'ACCESSORY',
  'OTHER',
]);

const ACCESSORY_TYPES = new Set([
  'CHARGER',
  'POWER_ADAPTER',
  'CABLE',
  'BATTERY',
  'BAG_CASE',
  'SIM_CARD',
  'MEMORY_CARD',
  'OTHER',
]);

function invalid(message, field) {
  throw new RepairError(
    RepairFailureCode.INVALID_INPUT,
    message,
    400,
    field ? { field } : undefined
  );
}

function requiredText(value, field, maxLength) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) invalid(`กรุณาระบุ ${field}`, field);
  if (normalized.length > maxLength) invalid(`${field} ยาวเกิน ${maxLength} ตัวอักษร`, field);
  return normalized;
}

function optionalText(value, field, maxLength) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim();
  if (normalized.length > maxLength) invalid(`${field} ยาวเกิน ${maxLength} ตัวอักษร`, field);
  return normalized || null;
}

function positiveInt(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) invalid(`${field} ต้องเป็นจำนวนเต็มมากกว่า 0`, field);
  return parsed;
}

function nonNegativeMoney(value, field) {
  if (value === undefined || value === null || value === '') return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) invalid(`${field} ต้องเป็นจำนวนตั้งแต่ 0 ขึ้นไป`, field);
  return parsed;
}

function booleanValue(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  return value === true || value === 'true' || value === 1 || value === '1';
}

function validateAccessories(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 12) {
    invalid('รายการอุปกรณ์ที่นำมาด้วยไม่ถูกต้อง', 'accessories');
  }

  return value.map((item, index) => {
    const accessoryType = String(item?.accessoryType || '').trim().toUpperCase();
    if (!ACCESSORY_TYPES.has(accessoryType)) {
      invalid('ประเภทอุปกรณ์ที่นำมาด้วยไม่ถูกต้อง', `accessories[${index}].accessoryType`);
    }
    return {
      accessoryType,
      quantity: positiveInt(item?.quantity ?? 1, `accessories[${index}].quantity`),
      remark: optionalText(item?.remark, `accessories[${index}].remark`, 255),
    };
  });
}

function validatePreAgreedService(rawValue, estimatedCost, customerNameFallback = '') {
  const value = rawValue && typeof rawValue === 'object' ? rawValue : {};
  if (!booleanValue(value.enabled, false)) return null;

  return {
    enabled: true,
    agreedScope: requiredText(value.agreedScope, 'ขอบเขตงานที่ตกลง', 2000),
    agreedAmount: nonNegativeMoney(
      value.agreedAmount === undefined ? estimatedCost : value.agreedAmount,
      'preAgreedService.agreedAmount'
    ),
    confirmedByName: requiredText(
      value.confirmedByName || customerNameFallback,
      'ชื่อผู้ยืนยันข้อตกลง',
      255
    ),
    confirmationNote: optionalText(
      value.confirmationNote,
      'หมายเหตุข้อตกลง',
      2000
    ),
  };
}

function validateExternalDeviceIntake(payload = {}) {
  const device = payload.device || {};
  const category = String(device.category || '').trim().toUpperCase();
  if (!DEVICE_CATEGORIES.has(category)) {
    invalid('ประเภทอุปกรณ์ไม่อยู่ในค่าที่ระบบรองรับ', 'device.category');
  }

  const serialNumber = optionalText(device.serialNumber, 'Serial Number', 255);
  const imei = optionalText(device.imei, 'IMEI', 255);
  const barcode = optionalText(device.barcode, 'Barcode/QR ร้าน', 255);
  const estimatedCost = nonNegativeMoney(payload.estimatedCost, 'estimatedCost');
  const preAgreedService = validatePreAgreedService(
    payload.preAgreedService,
    estimatedCost,
    payload.customerName || ''
  );

  return {
    customerId: positiveInt(payload.customerId, 'customerId'),
    device: {
      category,
      brand: optionalText(device.brand, 'ยี่ห้อ', 255),
      model: requiredText(device.model, 'รุ่นหรือรายละเอียดอุปกรณ์', 255),
      serialNumber,
      imei,
      barcode,
    },
    customerProblem: requiredText(payload.customerProblem, 'อาการที่ลูกค้าแจ้ง', 4000),
    internalRemark: optionalText(payload.internalRemark, 'หมายเหตุภายใน', 4000),
    accessories: validateAccessories(payload.accessories),
    depositPaid: nonNegativeMoney(payload.depositPaid, 'depositPaid'),
    estimatedCost: preAgreedService?.agreedAmount ?? estimatedCost,
    ...(preAgreedService ? { preAgreedService } : {}),
  };
}

module.exports = {
  ACCESSORY_TYPES,
  DEVICE_CATEGORIES,
  validateExternalDeviceIntake,
  validatePreAgreedService,
};
