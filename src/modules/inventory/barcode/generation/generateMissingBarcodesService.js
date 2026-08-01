const {
  generateMissingBarcodesForReceipt,
} = require('./generateMissingBarcodesRepository');

const toInteger = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
};

const parseBoolean = (value) => {
  const normalized = String(value ?? 'false').toLowerCase();
  return normalized === '1' || normalized === 'true';
};

const executeGenerateMissingBarcodes = async ({ receiptId, branchId, dryRun, lotLabelPerLot }) => {
  const normalizedReceiptId = toInteger(receiptId);
  const normalizedBranchId = toInteger(branchId);

  if (!Number.isInteger(normalizedReceiptId) || !Number.isInteger(normalizedBranchId)) {
    const error = new Error('INVALID_RECEIPT_OR_BRANCH');
    error.status = 400;
    throw error;
  }

  return generateMissingBarcodesForReceipt(normalizedReceiptId, normalizedBranchId, {
    dryRun: parseBoolean(dryRun),
    lotLabelPerLot: Math.max(1, Number(lotLabelPerLot ?? 1)),
  });
};

module.exports = {
  executeGenerateMissingBarcodes,
  parseBoolean,
  toInteger,
};
