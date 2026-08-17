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
  branch: {
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      taxId: true,
      branchCode: true,
      isHeadOffice: true,
      slug: true,
      documentHeaderConfig: true,
    },
  },
  customer: {
    select: {
      id: true,
      name: true,
      companyName: true,
      departmentName: true,
      taxId: true,
      type: true,
      addressDetail: true,
      user: {
        select: {
          email: true,
          loginId: true,
          loginType: true,
        },
      },
    },
  },
  createdByEmployeeProfile: {
    select: {
      id: true,
      name: true,
      phone: true,
    },
  },
  cancelledByEmployeeProfile: {
    select: {
      id: true,
      name: true,
      phone: true,
    },
  },
};

const createCustomerMoneyReceipt = ({ client, data }) => {
  if (!client?.customerReceipt) throw new TypeError('Customer receipt client is required');
  return client.customerReceipt.create({ data, select: receiptSelect });
};

const listCustomerMoneyReceipts = ({
  client,
  branchId,
  customerId = null,
  search = '',
  status = null,
  paymentMethod = null,
  dateFrom = null,
  dateTo = null,
  take = 100,
}) => {
  if (!client?.customerReceipt) throw new TypeError('Customer receipt client is required');

  const keyword = String(search || '').trim();
  const receivedAt = {};
  if (dateFrom) receivedAt.gte = dateFrom;
  if (dateTo) receivedAt.lte = dateTo;

  return client.customerReceipt.findMany({
    where: {
      branchId,
      ...(customerId ? { customerId } : {}),
      ...(status ? { status } : {}),
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(Object.keys(receivedAt).length ? { receivedAt } : {}),
      code: { startsWith: 'CMR-' },
      ...(keyword ? {
        AND: [{
          OR: [
            { code: { contains: keyword, mode: 'insensitive' } },
            { referenceNo: { contains: keyword, mode: 'insensitive' } },
            { note: { contains: keyword, mode: 'insensitive' } },
            { customer: { is: { name: { contains: keyword, mode: 'insensitive' } } } },
            { customer: { is: { companyName: { contains: keyword, mode: 'insensitive' } } } },
            { customer: { is: { departmentName: { contains: keyword, mode: 'insensitive' } } } },
            { customer: { is: { taxId: { contains: keyword, mode: 'insensitive' } } } },
            { customer: { is: { user: { is: { email: { contains: keyword, mode: 'insensitive' } } } } } },
            { customer: { is: { user: { is: { loginId: { contains: keyword, mode: 'insensitive' } } } } } },
          ],
        }],
      } : {}),
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
