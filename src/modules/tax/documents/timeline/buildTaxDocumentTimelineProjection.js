'use strict';

const toIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const normalizeMetadata = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return Object.freeze({});
  return Object.freeze({ ...value });
};

const buildTaxDocumentTimelineProjection = ({ document }) => {
  if (!document) {
    throw Object.assign(new Error('document is required'), {
      code: 'TAX_DOCUMENT_REQUIRED',
      statusCode: 400,
    });
  }

  const lifecycleEvents = Array.isArray(document.lifecycleEvents)
    ? document.lifecycleEvents
    : [];

  const events = lifecycleEvents.map((event, index) => Object.freeze({
    sequence: index + 1,
    eventId: event.id == null ? null : Number(event.id),
    fromStatus: event.fromStatus || null,
    toStatus: event.toStatus || null,
    reason: event.reason || null,
    actorEmployeeId: event.actorEmployeeId == null ? null : Number(event.actorEmployeeId),
    occurredAt: toIso(event.occurredAt || event.createdAt),
    metadata: normalizeMetadata(event.metadata),
  }));

  return Object.freeze({
    schemaVersion: 'TAX_DOCUMENT_TIMELINE_PROJECTION_V1',
    document: Object.freeze({
      id: Number(document.id),
      branchId: Number(document.branchId),
      candidateId: document.candidateId == null ? null : Number(document.candidateId),
      documentType: document.documentType,
      documentNumber: document.documentNumber,
      status: document.status,
      occurredAt: toIso(document.occurredAt),
      issuedAt: toIso(document.issuedAt),
      createdAt: toIso(document.createdAt),
      updatedAt: toIso(document.updatedAt),
    }),
    currentStatus: document.status,
    eventCount: events.length,
    firstOccurredAt: events[0]?.occurredAt || toIso(document.createdAt || document.occurredAt),
    lastOccurredAt: events.at(-1)?.occurredAt || toIso(document.updatedAt || document.issuedAt || document.createdAt),
    events: Object.freeze(events),
  });
};

module.exports = Object.freeze({ buildTaxDocumentTimelineProjection });
