function requirePositiveInteger(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new TypeError(`${field} must be a positive integer`);
  }
  return parsed;
}

function normalizeOptionalPositiveInteger(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return requirePositiveInteger(value, field);
}

function normalizeRequiredText(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new TypeError(`${field} is required`);
  return normalized;
}

function normalizeOptionalText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeOccurredAt(value) {
  if (value === undefined || value === null) return new Date();
  const occurredAt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new TypeError('occurredAt must be a valid date');
  }
  return occurredAt;
}

function normalizeActor(event) {
  const actorEmployeeId = normalizeOptionalPositiveInteger(
    event.actorEmployeeId,
    'actorEmployeeId'
  );
  const actorCustomerId = normalizeOptionalPositiveInteger(
    event.actorCustomerId,
    'actorCustomerId'
  );

  if (actorEmployeeId && actorCustomerId) {
    throw new TypeError('an event cannot have both employee and customer actors');
  }

  const actorType = event.actorType ||
    (actorEmployeeId ? 'EMPLOYEE' : actorCustomerId ? 'CUSTOMER' : 'SYSTEM');

  if (actorType === 'EMPLOYEE' && !actorEmployeeId) {
    throw new TypeError('actorEmployeeId is required for EMPLOYEE events');
  }
  if (actorType === 'CUSTOMER' && !actorCustomerId) {
    throw new TypeError('actorCustomerId is required for CUSTOMER events');
  }
  if (actorType === 'SYSTEM' && (actorEmployeeId || actorCustomerId)) {
    throw new TypeError('SYSTEM events cannot reference an employee or customer actor');
  }

  return { actorType, actorEmployeeId, actorCustomerId };
}

function normalizeEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new TypeError('event must be an object');
  }

  const actor = normalizeActor(event);

  return {
    deviceId: requirePositiveInteger(event.deviceId, 'deviceId'),
    branchId: requirePositiveInteger(event.branchId, 'branchId'),
    eventType: normalizeRequiredText(event.eventType, 'eventType'),
    sourceType: normalizeOptionalText(event.sourceType),
    sourceId: normalizeOptionalText(event.sourceId),
    eventKey: normalizeRequiredText(event.eventKey, 'eventKey'),
    correlationId: normalizeOptionalText(event.correlationId),
    causationId: normalizeOptionalText(event.causationId),
    schemaVersion: event.schemaVersion === undefined
      ? 1
      : requirePositiveInteger(event.schemaVersion, 'schemaVersion'),
    title: normalizeRequiredText(event.title, 'title'),
    description: normalizeOptionalText(event.description),
    ...actor,
    customerVisible: Boolean(event.customerVisible),
    metadata: event.metadata ?? undefined,
    occurredAt: normalizeOccurredAt(event.occurredAt),
  };
}

async function publishDevicePassportEvent(prisma, rawEvent) {
  if (!prisma?.devicePassportEvent?.create) {
    throw new TypeError('a Prisma client with devicePassportEvent.create is required');
  }

  const data = normalizeEvent(rawEvent);

  try {
    return await prisma.devicePassportEvent.create({ data });
  } catch (error) {
    if (error?.code !== 'P2002') throw error;

    const existing = await prisma.devicePassportEvent.findFirst({
      where: { deviceId: data.deviceId, eventKey: data.eventKey },
    });

    if (existing) return existing;
    throw error;
  }
}

module.exports = {
  normalizeDevicePassportEvent: normalizeEvent,
  publishDevicePassportEvent,
};
