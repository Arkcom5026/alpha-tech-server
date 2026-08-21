'use strict';

const {
  projectWorkspaceReadLine,
} = require('./documentWorkspaceReadProjection');

const fail = (code, message, statusCode = 409) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const projectWorkspaceWriteSource = ({ sale, type, item, settledAmount = 0 }) => {
  const projection = projectWorkspaceReadLine({ sale, type, item, settledAmount });

  if (projection.fullyReturned || projection.activeQuantity <= 0 || projection.activeAmount <= 0) {
    fail(
      'DOCUMENT_WORKSPACE_SOURCE_RETURNED',
      `รายการ ${projection.description} ถูกคืนครบแล้วและไม่สามารถนำไปสร้างใบส่งของรวมได้`,
    );
  }

  return Object.freeze({
    ...projection,
    quantity: projection.activeQuantity,
    sourceAmount: projection.activeAmount,
  });
};

const assertWorkspaceWriteSelection = ({ projection, documentUnitPrice }) => {
  if (!projection) {
    fail(
      'DOCUMENT_WORKSPACE_SOURCE_INVALID',
      'A source line is missing, has no issued delivery note, is not a credit delivery note, or is outside this customer/branch',
    );
  }

  if (projection.fullyReturned || projection.activeQuantity <= 0) {
    fail(
      'DOCUMENT_WORKSPACE_SOURCE_RETURNED',
      `รายการ ${projection.description} ถูกคืนครบแล้วและไม่สามารถนำไปสร้างใบส่งของรวมได้`,
    );
  }

  const unitPrice = Number(documentUnitPrice || 0);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    fail('DOCUMENT_WORKSPACE_LINE_INVALID', 'Document unit price is invalid', 400);
  }

  return Object.freeze({
    quantity: projection.activeQuantity,
    sourceUnitPrice: projection.sourceUnitPrice,
    sourceAmount: projection.activeAmount,
    documentAmount: Number((unitPrice * projection.activeQuantity).toFixed(2)),
  });
};

module.exports = Object.freeze({
  projectWorkspaceWriteSource,
  assertWorkspaceWriteSelection,
});
