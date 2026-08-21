'use strict';

const ACTIVE_CREDIT_PAYMENT_STATUSES = Object.freeze(['UNPAID', 'PARTIALLY_PAID']);

const money = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const round2 = (value) => Number(money(value).toFixed(2));

const buildActiveCreditReceivableWhere = ({ branchId, customerId, customerIds } = {}) => ({
  ...(branchId == null ? {} : { branchId: Number(branchId) }),
  ...(customerIds ? { customerId: { in: customerIds } } : customerId == null ? {} : { customerId }),
  isCredit: true,
  status: { not: 'CANCELLED' },
  statusPayment: { in: [...ACTIVE_CREDIT_PAYMENT_STATUSES] },
});

const calculateSerializedReturnedValue = (item = {}) => {
  const returnedQuantity = Math.min(1, Math.max(0, money(item.returnedQuantity)));
  return round2(money(item.price) * returnedQuantity);
};

const calculateSimpleReturnedValue = (item = {}) => {
  const soldQuantity = Math.max(0, money(item.quantity));
  if (soldQuantity <= 0) return 0;
  const returnedQuantity = Math.min(soldQuantity, Math.max(0, money(item.returnedQuantity)));
  return round2(money(item.price) * (returnedQuantity / soldQuantity));
};

const calculateReturnedReceivableAmount = ({ items = [], simpleItems = [] } = {}) => round2(
  (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + calculateSerializedReturnedValue(item),
    0,
  ) + (Array.isArray(simpleItems) ? simpleItems : []).reduce(
    (sum, item) => sum + calculateSimpleReturnedValue(item),
    0,
  )
);

const calculateNetReceivableTotal = (sale = {}) => {
  const grossTotal = money(sale.totalAmount);
  const explicitReturnedAmount = sale.returnedReceivableAmount == null
    ? null
    : money(sale.returnedReceivableAmount);
  const returnedAmount = explicitReturnedAmount == null
    ? calculateReturnedReceivableAmount(sale)
    : Math.max(0, explicitReturnedAmount);
  return round2(Math.max(0, grossTotal - returnedAmount));
};

const calculateOutstandingReceivable = (sale = {}) => round2(
  Math.max(0, calculateNetReceivableTotal(sale) - money(sale.paidAmount))
);

module.exports = {
  ACTIVE_CREDIT_PAYMENT_STATUSES,
  buildActiveCreditReceivableWhere,
  calculateSerializedReturnedValue,
  calculateSimpleReturnedValue,
  calculateReturnedReceivableAmount,
  calculateNetReceivableTotal,
  calculateOutstandingReceivable,
};
