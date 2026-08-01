const repository = require('./barcodeReceiptCompletionRepository');

const completeReceipt = async ({ receiptId, branchId }) => {
  const receipt = await repository.findReceipt({ receiptId, branchId });
  if (!receipt) {
    const error = new Error('RECEIPT_NOT_FOUND');
    error.status = 404;
    throw error;
  }

  const result = await repository.completeReceipt({ receiptId, branchId });
  if (!result?.count) {
    const error = new Error('RECEIPT_COMPLETION_CONFLICT');
    error.status = 409;
    throw error;
  }

  return repository.getReceiptProjection({ receiptId, branchId });
};

module.exports = { completeReceipt };
