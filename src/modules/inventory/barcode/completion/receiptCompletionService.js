'use strict';

const completionRepository = require('./receiptCompletionRepository');

const completeReceipt = async ({ receiptId, branchId }) => {
  const existing = await completionRepository.findReceipt({ receiptId, branchId });
  if (!existing) return { code: 'RECEIPT_NOT_FOUND' };

  const updateResult = await completionRepository.markCompleted({ receiptId, branchId });
  if (updateResult.count === 0) return { code: 'UPDATE_CONFLICT' };

  const receipt = await completionRepository.findCompletedReceipt({ receiptId, branchId });
  return { code: 'COMPLETED', receipt };
};

module.exports = { completeReceipt };
