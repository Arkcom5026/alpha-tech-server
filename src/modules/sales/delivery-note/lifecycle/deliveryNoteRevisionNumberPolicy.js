'use strict';

const fail = (code, message) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  throw error;
};

const deriveDeliveryNoteRevisionNumber = ({ originalDocumentNumber, revisionNumber }) => {
  const root = String(originalDocumentNumber || '').trim();
  const revision = Number(revisionNumber);
  if (!root) fail('DELIVERY_NOTE_ORIGINAL_NUMBER_REQUIRED', 'Original Delivery Note number is required');
  if (!Number.isInteger(revision) || revision < 2) {
    fail('DELIVERY_NOTE_REVISION_SEQUENCE_INVALID', 'Revision number must be an integer greater than or equal to 2');
  }
  return `${root}-R${revision}`;
};

module.exports = Object.freeze({ deriveDeliveryNoteRevisionNumber });
