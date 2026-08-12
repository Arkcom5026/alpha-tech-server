'use strict';

const settlementInclude = {
  customer: {
    select: { id: true, name: true, companyName: true, departmentName: true, taxId: true },
  },
  lines: {
    orderBy: [{ saleId: 'asc' }, { id: 'asc' }],
    include: { application: true },
  },
};

const createSettlement = ({ client, data }) => client.customerMoneySettlement.create({
  data,
  include: settlementInclude,
});

const getSettlement = ({ client, id, branchId }) => client.customerMoneySettlement.findFirst({
  where: { id, branchId, settlementType: 'DELIVERY_CREDIT' },
  include: settlementInclude,
});

const listSettlements = ({ client, branchId, customerId = null, take = 100 }) => client.customerMoneySettlement.findMany({
  where: {
    branchId,
    settlementType: 'DELIVERY_CREDIT',
    ...(customerId ? { customerId } : {}),
  },
  include: settlementInclude,
  orderBy: [{ settledAt: 'desc' }, { id: 'desc' }],
  take,
});

module.exports = { settlementInclude, createSettlement, getSettlement, listSettlements };
