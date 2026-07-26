const crypto = require('crypto');
const repository = require('./createDeviceIntakeRepository');

const PURPOSES = new Set([
  'REPAIR',
  'CLAIM',
  'INSPECTION',
  'TRADE_IN',
  'UPGRADE',
  'DATA_RECOVERY',
  'MAINTENANCE',
]);

function httpError(status, code, message, details) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details) error.details = details;
  return error;
}

function positiveInteger(value, field, required = true) {
  if ((value === undefined || value === null || value === '') && !required) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw httpError(400, 'INVALID_DEVICE_INTAKE_INPUT', `${field} ต้องเป็นจำนวนเต็มมากกว่า 0`, { field });
  }
  return parsed;
}

function optionalText(value, maxLength = 2000) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, maxLength) : null;
}

function booleanValue(value, fallback = false) {
  return value === undefined || value === null ? fallback : Boolean(value);
}

function normalizePayload(raw = {}) {
  const purpose = String(raw.purpose || '').trim().toUpperCase();
  if (!PURPOSES.has(purpose)) {
    throw httpError(400, 'INVALID_DEVICE_INTAKE_PURPOSE', 'purpose ไม่อยู่ในประเภทงานที่รองรับ');
  }

  const snapshot = raw.snapshot || {};
  const model = optionalText(snapshot.model, 180);
  if (!model) {
    throw httpError(400, 'INVALID_DEVICE_INTAKE_INPUT', 'snapshot.model เป็นข้อมูลที่จำเป็น', { field: 'snapshot.model' });
  }

  const condition = raw.condition || {};
  const consent = raw.consent || {};
  const accessories = Array.isArray(raw.accessories) ? raw.accessories : [];

  return {
    customerId: positiveInteger(raw.customerId, 'customerId'),
    stockItemId: positiveInteger(raw.stockItemId, 'stockItemId', false),
    purpose,
    reportedSymptoms: optionalText(raw.reportedSymptoms, 4000),
    snapshot: {
      deviceType: optionalText(snapshot.deviceType, 120),
      brand: optionalText(snapshot.brand, 120),
      model,
      serialNumber: optionalText(snapshot.serialNumber, 180),
      imei: optionalText(snapshot.imei, 80),
      barcode: optionalText(snapshot.barcode, 180),
      color: optionalText(snapshot.color, 80),
      capacity: optionalText(snapshot.capacity, 120),
      specification: snapshot.specification && typeof snapshot.specification === 'object'
        ? snapshot.specification
        : null,
    },
    condition: {
      screenCrack: booleanValue(condition.screenCrack),
      housingDamage: booleanValue(condition.housingDamage),
      scratch: booleanValue(condition.scratch),
      waterDamage: booleanValue(condition.waterDamage),
      missingScrews: booleanValue(condition.missingScrews),
      missingParts: booleanValue(condition.missingParts),
      overallCondition: optionalText(condition.overallCondition, 32),
      remark: optionalText(condition.remark, 2000),
    },
    accessories: accessories.map((item, index) => {
      const type = optionalText(item?.type, 80);
      if (!type) {
        throw httpError(400, 'INVALID_DEVICE_INTAKE_INPUT', `accessories[${index}].type เป็นข้อมูลที่จำเป็น`);
      }
      return {
        type,
        description: optionalText(item.description, 1000),
        quantity: positiveInteger(item.quantity ?? 1, `accessories[${index}].quantity`),
      };
    }),
    consent: {
      allowDisassembly: booleanValue(consent.allowDisassembly),
      allowDataReset: booleanValue(consent.allowDataReset),
      allowBackup: booleanValue(consent.allowBackup),
      allowNotifications: booleanValue(consent.allowNotifications, true),
      allowTracking: booleanValue(consent.allowTracking, true),
      allowWarrantyCheck: booleanValue(consent.allowWarrantyCheck, true),
      agreedTerms: booleanValue(consent.agreedTerms),
      termsVersion: optionalText(consent.termsVersion, 40),
      agreedAt: consent.agreedTerms ? new Date() : null,
    },
  };
}

function normalizeIdentityPart(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function buildDeviceFingerprint(snapshot, stockItemId) {
  let authority;
  if (stockItemId) authority = `STOCK:${stockItemId}`;
  else if (snapshot.imei) authority = `IMEI:${normalizeIdentityPart(snapshot.imei)}`;
  else if (snapshot.serialNumber) {
    authority = `SERIAL:${normalizeIdentityPart(snapshot.brand)}:${normalizeIdentityPart(snapshot.model)}:${normalizeIdentityPart(snapshot.serialNumber)}`;
  } else if (snapshot.barcode) authority = `BARCODE:${normalizeIdentityPart(snapshot.barcode)}`;
  else authority = `UNIDENTIFIED:${crypto.randomUUID()}`;
  return crypto.createHash('sha256').update(authority).digest('hex');
}

function buildIntakeNo(branchId) {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `DI-${branchId}-${date}-${suffix}`;
}

class CreateDeviceIntakeService {
  constructor(intakeRepository = repository) {
    this.repository = intakeRepository;
  }

  async execute(actor, rawPayload, requestContext = {}) {
    const branchId = positiveInteger(actor?.branchId, 'actor.branchId');
    const employeeId = positiveInteger(actor?.employeeId, 'actor.employeeId');
    const payload = normalizePayload(rawPayload);

    return this.repository.transaction(async (repo) => {
      const customer = await repo.findCustomerById(payload.customerId);
      if (!customer) {
        throw httpError(404, 'DEVICE_INTAKE_CUSTOMER_NOT_FOUND', 'ไม่พบข้อมูลลูกค้า');
      }

      let stockItem = null;
      if (payload.stockItemId) {
        stockItem = await repo.findStockItem(branchId, payload.stockItemId);
        if (!stockItem) {
          throw httpError(404, 'DEVICE_INTAKE_STOCK_ITEM_NOT_FOUND', 'ไม่พบอุปกรณ์ในสาขานี้');
        }
      }

      const snapshot = {
        ...payload.snapshot,
        deviceType: payload.snapshot.deviceType || stockItem?.product?.productType?.name || null,
        brand: payload.snapshot.brand || stockItem?.product?.brand?.name || null,
        model: payload.snapshot.model || stockItem?.product?.name,
        serialNumber: payload.snapshot.serialNumber || stockItem?.serialNumber || null,
        barcode: payload.snapshot.barcode || stockItem?.barcode || null,
      };

      const fingerprint = buildDeviceFingerprint(snapshot, payload.stockItemId);
      let device = await repo.findDevice({ stockItemId: payload.stockItemId, fingerprint });
      const isNewDevice = !device;
      if (device) {
        device = await repo.updateDeviceIdentity(device.id, {
          customerId: payload.customerId,
          ...snapshot,
        });
      } else {
        device = await repo.createDevice({
          branchId,
          customerId: payload.customerId,
          stockItemId: payload.stockItemId,
          fingerprint,
          ...snapshot,
        });
      }
      await repo.ensureOwnership(device.id, payload.customerId, employeeId);

      const intake = await repo.createIntake({
        intakeNo: buildIntakeNo(branchId),
        deviceId: device.id,
        branchId,
        customerId: payload.customerId,
        stockItemId: payload.stockItemId,
        purpose: payload.purpose,
        status: 'AWAITING_CUSTOMER_CONFIRMATION',
        reportedSymptoms: payload.reportedSymptoms,
        createdByEmployeeId: employeeId,
      });

      const [createdSnapshot, createdCondition, createdAccessories, createdConsent] = await Promise.all([
        repo.createSnapshot(intake.id, snapshot),
        repo.createCondition(intake.id, payload.condition),
        repo.createAccessories(intake.id, payload.accessories),
        repo.createConsent(intake.id, payload.consent),
      ]);

      if (isNewDevice) {
        await repo.createPassportEvent({
          deviceId: device.id,
          branchId,
          eventType: 'DEVICE_CREATED',
          sourceType: 'DEVICE',
          sourceId: device.id,
          title: 'สร้างประวัติอุปกรณ์',
          description: `${snapshot.brand || ''} ${snapshot.model}`.trim(),
          actorType: 'EMPLOYEE',
          actorEmployeeId: employeeId,
          customerVisible: false,
          metadata: { fingerprintAuthority: payload.stockItemId ? 'STOCK_ITEM' : 'IDENTITY' },
          occurredAt: device.createdAt || new Date(),
        });
      }

      await repo.createPassportEvent({
        deviceId: device.id,
        branchId,
        eventType: 'DEVICE_INTAKE_CREATED',
        sourceType: 'DEVICE_INTAKE',
        sourceId: intake.id,
        title: 'รับอุปกรณ์เข้าระบบ',
        description: payload.reportedSymptoms,
        actorType: 'EMPLOYEE',
        actorEmployeeId: employeeId,
        customerVisible: true,
        metadata: { purpose: payload.purpose, intakeNo: intake.intakeNo },
        occurredAt: intake.createdAt || new Date(),
      });

      await repo.createAudit(intake.id, {
        action: 'INTAKE_CREATED',
        actorType: 'EMPLOYEE',
        employeeId,
        ipAddress: optionalText(requestContext.ipAddress, 80),
        userAgent: optionalText(requestContext.userAgent, 1000),
        metadata: { purpose: payload.purpose, deviceId: device.id },
      });

      return {
        contractVersion: 'device-intake.v3',
        device,
        intake,
        snapshot: createdSnapshot,
        condition: createdCondition,
        accessories: createdAccessories,
        consent: createdConsent,
      };
    });
  }
}

module.exports = new CreateDeviceIntakeService();
module.exports.CreateDeviceIntakeService = CreateDeviceIntakeService;
module.exports.normalizePayload = normalizePayload;
module.exports.buildDeviceFingerprint = buildDeviceFingerprint;
