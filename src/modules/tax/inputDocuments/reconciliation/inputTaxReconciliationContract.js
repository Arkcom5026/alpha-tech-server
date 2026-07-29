'use strict';

const RECONCILIATION_STATUSES = Object.freeze([
  'UNLINKED',
  'PARTIALLY_RECONCILED',
  'RECONCILED',
  'OVER_ALLOCATED',
]);

const QUALITY_CODES = Object.freeze([
  'UNLINKED_DOCUMENT',
  'ALLOCATION_MISMATCH',
  'OVER_ALLOCATED',
  'MISSING_SUPPLIER_TAX_ID',
  'MISSING_INVOICE_NUMBER',
]);

const MONEY_TOLERANCE = '0.01';

const createReconciliationProjection = ({
  status,
  receiptCount,
  documentAmount,
  allocatedAmount,
  variance,
  qualityCodes,
}) => Object.freeze({
  status,
  canApprove: status === 'RECONCILED',
  receiptCount,
  documentAmount,
  allocatedAmount,
  variance,
  tolerance: MONEY_TOLERANCE,
  qualityCodes: Object.freeze([...qualityCodes]),
});

module.exports = Object.freeze({
  MONEY_TOLERANCE,
  QUALITY_CODES,
  RECONCILIATION_STATUSES,
  createReconciliationProjection,
});
