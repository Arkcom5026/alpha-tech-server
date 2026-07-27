'use strict';

const taxModule = require('../../../tax');

const READY_SALE_STATUSES = Object.freeze(new Set(['COMPLETED', 'FINALIZED', 'DELIVERED']));

const publishSaleTaxCandidate = async ({ sale, branchId, employeeId }) => {
  const saleId = Number(sale?.id);
  const normalizedBranchId = Number(branchId);
  const saleStatus = String(sale?.status || '').trim().toUpperCase();

  if (!Number.isInteger(saleId) || saleId <= 0) {
    return Object.freeze({ status: 'SKIPPED', reason: 'SALE_ID_MISSING' });
  }

  if (!READY_SALE_STATUSES.has(saleStatus)) {
    return Object.freeze({ status: 'SKIPPED', reason: 'SALE_NOT_TAX_READY', saleId });
  }

  try {
    const result = await taxModule.intake.registerSaleCandidate({
      branchId: normalizedBranchId,
      saleId,
      actorEmployeeId: Number(employeeId) || null,
    });

    return Object.freeze({
      status: result?.replayed ? 'REPLAYED' : 'REGISTERED',
      saleId,
      candidateId: result?.candidate?.id || null,
      taxDocumentId: result?.taxDocument?.id || null,
    });
  } catch (error) {
    console.error('[sales.tax-intake] publication failed', {
      branchId: normalizedBranchId,
      saleId,
      code: error?.code,
      message: error?.message,
    });

    return Object.freeze({
      status: 'PENDING_RETRY',
      saleId,
      code: error?.code || 'TAX_INTAKE_PUBLICATION_FAILED',
    });
  }
};

module.exports = Object.freeze({
  READY_SALE_STATUSES,
  publishSaleTaxCandidate,
});
