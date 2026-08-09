'use strict';

const receiptSelect = {
  id: true,
  code: true,
  branchId: true,
  customerId: true,
  receivedAt: true,
  totalAmount: true,
  allocatedAmount: true,
  remainingAmount: true,
  paymentMethod: true,
  referenceNo: true,
  note: true,
  status: true,
  createdByEmployeeProfileId: true,
  cancelledByEmployeeProfileId: true,
  cancelledAt: true,
  cancelReason: true,
  createdAt: true,
  updatedAt: true,
  customer: {
    select: {
      id: true,
      name: true,
      companyName: true,
      taxId: true,
      type: true,
    },
  },
};

const createCustomerMoneyReceipt = ({ client, data }) => {
  if (!client?.customerReceipt) throw new TypeError('Customer receipt client is required');
  return client.customerReceipt.create({ data, select: receiptSelect });
};

const listCustomerMoneyReceipts = ({ client, branchId, customerId = null, take = 100 }) => {
  if (!client?.customerReceipt) throw new TypeError('Customer receipt client is required');
  return client.customerReceipt.findMany({
    where: {
      branchId,
      ...(customerId ? { customerId } : {}),
      code: { startsWith: 'CMR-' },
    },
    select: receiptSelect,
    orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
    take,
  });
};

const getCustomerMoneyReceipt = ({ client, id, branchId }) => {
  if (!client?.customerReceipt) throw new TypeError('Customer receipt client is required');
  return client.customerReceipt.findFirst({
    where: { id, branchId, code: { startsWith: 'CMR-' } },
    select: receiptSelect,
  });
};

module.exports = {
  receiptSelect,
  createCustomerMoneyReceipt,
  listCustomerMoneyReceipts,
  getCustomerMoneyReceipt,
};
