'use strict';

const { prisma } = require('../../../../../lib/prisma');
const {
  getOrCreatePresentationSnapshot,
} = require('../../../document-presentation/persistentPresentationSnapshotService');

const positiveInt = (value, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${field} must be a positive integer`);
    error.code = 'DELIVERY_NOTE_PRESENTATION_ID_REQUIRED';
    error.statusCode = 400;
    throw error;
  }
  return parsed;
};

const ensureSaleDeliveryNotePresentationSnapshot = async ({ branchId, saleId } = {}) => {
  const normalizedBranchId = positiveInt(branchId, 'branchId');
  const normalizedSaleId = positiveInt(saleId, 'saleId');

  const sale = await prisma.sale.findFirst({
    where: { id: normalizedSaleId, branchId: normalizedBranchId },
    select: {
      id: true,
      code: true,
      soldAt: true,
      officialDocumentNumber: true,
      branch: { select: { documentHeaderConfig: true } },
    },
  });
  if (!sale) {
    const error = new Error('Sale not found');
    error.code = 'SALE_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }
  if (!sale.officialDocumentNumber) return null;

  return getOrCreatePresentationSnapshot({
    branchId: normalizedBranchId,
    sourceType: 'SALE',
    sourceId: String(sale.id),
    documentPurpose: 'DELIVERY_NOTE',
    rendererFamily: 'A4',
    storeConfig: sale.branch.documentHeaderConfig,
    issuedAt: sale.soldAt,
    businessSnapshot: {
      saleId: sale.id,
      saleCode: sale.code,
      documentNumber: sale.officialDocumentNumber,
    },
  });
};

module.exports = Object.freeze({ ensureSaleDeliveryNotePresentationSnapshot });
