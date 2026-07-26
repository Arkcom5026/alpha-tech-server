const repository = require('./devicePassportEventRepository');

const EVENT_TYPES = new Set([
  'DEVICE_CREATED',
  'DEVICE_INTAKE_CREATED',
  'REPAIR_OPENED',
  'REPAIR_STATUS_CHANGED',
  'CLAIM_OPENED',
  'CLAIM_STATUS_CHANGED',
  'DEVICE_REPLACED',
  'OWNERSHIP_CHANGED',
]);

function optionalText(value, maxLength = 2000) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, maxLength) : null;
}

function normalizeEvent(raw = {}) {
  const eventType = String(raw.eventType || '').trim().toUpperCase();
  if (!EVENT_TYPES.has(eventType)) {
    const error = new Error('eventType ไม่อยู่ในประเภทเหตุการณ์ที่รองรับ');
    error.status = 400;
    error.code = 'INVALID_DEVICE_PASSPORT_EVENT';
    throw error;
  }

  return {
    deviceId: Number(raw.deviceId),
    branchId: Number(raw.branchId),
    eventType,
    sourceType: String(raw.sourceType || 'SYSTEM').trim().toUpperCase().slice(0, 64),
    sourceId: raw.sourceId === undefined || raw.sourceId === null ? null : Number(raw.sourceId),
    title: optionalText(raw.title, 180),
    description: optionalText(raw.description, 4000),
    actorType: optionalText(raw.actorType, 24),
    actorEmployeeId: raw.actorEmployeeId === undefined || raw.actorEmployeeId === null
      ? null
      : Number(raw.actorEmployeeId),
    customerVisible: raw.customerVisible !== false,
    metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : null,
    occurredAt: raw.occurredAt ? new Date(raw.occurredAt) : new Date(),
  };
}

class DevicePassportEventService {
  constructor(eventRepository = repository) {
    this.repository = eventRepository;
  }

  create(raw) {
    const event = normalizeEvent(raw);
    if (!Number.isInteger(event.deviceId) || event.deviceId <= 0) {
      const error = new Error('deviceId ไม่ถูกต้อง');
      error.status = 400;
      error.code = 'INVALID_DEVICE_ID';
      throw error;
    }
    if (!Number.isInteger(event.branchId) || event.branchId <= 0) {
      const error = new Error('branchId ไม่ถูกต้อง');
      error.status = 400;
      error.code = 'INVALID_BRANCH_ID';
      throw error;
    }
    if (event.sourceId !== null && (!Number.isInteger(event.sourceId) || event.sourceId <= 0)) {
      const error = new Error('sourceId ไม่ถูกต้อง');
      error.status = 400;
      error.code = 'INVALID_SOURCE_ID';
      throw error;
    }
    return this.repository.createEvent(event);
  }
}

module.exports = new DevicePassportEventService();
module.exports.DevicePassportEventService = DevicePassportEventService;
module.exports.normalizeEvent = normalizeEvent;
