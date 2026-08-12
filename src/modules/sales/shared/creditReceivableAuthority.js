'use strict';

const ACTIVE_CREDIT_PAYMENT_STATUSES = Object.freeze(['UNPAID', 'PARTIALLY_PAID']);

const buildActiveCreditReceivableWhere = ({ branchId, customerId, customerIds } = {}) => ({
  ...(branchId == null ? {} : { branchId: Number(branchId) }),
  ...(customerIds ? { customerId: { in: customerIds } } : customerId == null ? {} : { customerId }),
  isCredit: true,
  status: { not: 'CANCELLED' },
  statusPayment: { in: [...ACTIVE_CREDIT_PAYMENT_STATUSES] },
});

const calculateOutstandingReceivable = ({ totalAmount, paidAmount }) => (
  Math.max(0, Number((Number(totalAmount || 0) - Number(paidAmount || 0)).toFixed(2)))
);

module.exports = {
  ACTIVE_CREDIT_PAYMENT_STATUSES,
  buildActiveCreditReceivableWhere,
  calculateOutstandingReceivable,
};
