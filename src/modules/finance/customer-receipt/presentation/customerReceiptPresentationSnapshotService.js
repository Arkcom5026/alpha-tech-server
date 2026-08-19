'use strict';

const { prisma } = require('../../../../../lib/prisma');
const {
  getOrCreatePresentationSnapshot,
} = require('../../../document-presentation/persistentPresentationSnapshotService');

const positiveInt = (value, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${field} must be a positive integer`);
    error.code = 'CUSTOMER_RECEIPT_PRESENTATION_ID_REQUIRED';
    error.statusCode = 400;
    throw error;
  }
  return parsed;
};

const ensureCustomerReceiptPresentationSnapshot = async ({
  tx = prisma,
  branchId,
  receipt,
  receiptId,
} = {}) => {
  const normalizedBranchId = positiveInt(branchId, 'branchId');
  let source = receipt || null;

  if (!source) {
    const normalizedReceiptId = positiveInt(receiptId, 'receiptId');
    source = await tx.customerReceipt.findFirst({
      where: { id: normalizedReceiptId, branchId: normalizedBranchId },
      include: { branch: true },
    });
  }

  if (!source || Number(source.branchId) !== normalizedBranchId) {
    const error = new Error('Customer receipt not found');
    error.code = 'CUSTOMER_RECEIPT_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const branch = source.branch || await tx.branch.findFirst({
    where: { id: normalizedBranchId },
    select: { documentHeaderConfig: true },
  });
  if (!branch) {
    const error = new Error('Branch not found');
    error.code = 'BRANCH_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  return getOrCreatePresentationSnapshot({
    tx,
    branchId: normalizedBranchId,
    sourceType: 'CUSTOMER_RECEIPT',
    sourceId: String(source.id),
    documentPurpose: 'CUSTOMER_RECEIPT',
    rendererFamily: 'A4',
    storeConfig: branch.documentHeaderConfig,
    issuedAt: source.receivedAt || source.createdAt || new Date(),
    businessSnapshot: {
      receiptId: source.id,
      receiptCode: source.code,
      totalAmount: Number(source.totalAmount || 0),
      paymentMethod: source.paymentMethod || null,
    },
  });
};

module.exports = Object.freeze({ ensureCustomerReceiptPresentationSnapshot });
