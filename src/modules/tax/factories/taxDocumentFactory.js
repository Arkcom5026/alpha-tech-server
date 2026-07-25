const crypto = require('crypto');
const {
  normalizeTaxDocumentCommand,
} = require('../contracts/createTaxDocumentCommand');

const stableHash = (value) =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');

const buildTaxDocumentDraft = (input) => {
  const command = normalizeTaxDocumentCommand(input);

  const identityPayload = {
    branchId: command.branchId,
    sourceType: command.sourceType,
    sourceId: command.sourceId,
    sourceVersion: command.sourceVersion,
    documentType: command.documentType,
    direction: command.direction,
  };

  const contentPayload = {
    ...identityPayload,
    documentNumber: command.documentNumber,
    occurredAt: command.occurredAt.toISOString(),
    currency: command.currency,
    subtotalAmount: command.subtotalAmount,
    discountAmount: command.discountAmount,
    taxableAmount: command.taxableAmount,
    vatRate: command.vatRate,
    vatAmount: command.vatAmount,
    totalAmount: command.totalAmount,
  };

  return Object.freeze({
    identityKey: stableHash(identityPayload),
    contentHash: stableHash(contentPayload),
    commandKey: command.commandKey,

    document: Object.freeze({
      branchId: command.branchId,
      documentNumber: command.documentNumber,
      documentType: command.documentType,
      status: 'DRAFT',
      version: 1,
    }),

    source: Object.freeze({
      sourceType: command.sourceType,
      sourceId: command.sourceId,
      sourceVersion: command.sourceVersion,
    }),

    snapshot: Object.freeze({
      direction: command.direction,
      occurredAt: command.occurredAt,
      currency: command.currency,
      subtotalAmount: command.subtotalAmount,
      discountAmount: command.discountAmount,
      taxableAmount: command.taxableAmount,
      vatRate: command.vatRate,
      vatAmount: command.vatAmount,
      totalAmount: command.totalAmount,
    }),

    event: Object.freeze({
      eventType: 'CREATED',
      occurredAt: command.occurredAt,
      performedByEmployeeId: command.actorEmployeeId,
      correlationId: command.correlationId,
      metadata: Object.freeze({
        commandKey: command.commandKey,
        sourceType: command.sourceType,
        sourceId: command.sourceId,
        sourceVersion: command.sourceVersion,
      }),
    }),
  });
};

module.exports = {
  buildTaxDocumentDraft,
  stableHash,
};
