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

const branchSelect = {
  id: true,
  name: true,
  address: true,
  phone: true,
  taxId: true,
  branchCode: true,
  isHeadOffice: true,
  slug: true,
  documentHeaderConfig: true,
};

const loadBranch = ({ client, branchId }) => client.branch.findFirst({
  where: { id: branchId },
  select: branchSelect,
});

const attachBranch = (record, branch) => record ? ({ ...record, branch: branch || null }) : null;

const createSettlement = async ({ client, data }) => {
  const record = await client.customerMoneySettlement.create({
    data,
    include: settlementInclude,
  });
  const branch = await loadBranch({ client, branchId: Number(record.branchId) });
  return attachBranch(record, branch);
};

const getSettlement = async ({ client, id, branchId }) => {
  const record = await client.customerMoneySettlement.findFirst({
    where: { id, branchId, settlementType: 'DELIVERY_CREDIT' },
    include: settlementInclude,
  });
  if (!record) return null;

  const branch = await loadBranch({ client, branchId });
  return attachBranch(record, branch);
};

const listSettlements = async ({ client, branchId, customerId = null, take = 100 }) => {
  const records = await client.customerMoneySettlement.findMany({
    where: {
      branchId,
      settlementType: 'DELIVERY_CREDIT',
      ...(customerId ? { customerId } : {}),
    },
    include: settlementInclude,
    orderBy: [{ settledAt: 'desc' }, { id: 'desc' }],
    take,
  });
  if (!records.length) return records;

  // Settlement persistence intentionally stores branchId as scalar authority and
  // has no Prisma `branch` relation. Hydrate the tenant branch once for the list
  // so document-header consumers keep the established response shape without N+1.
  const branch = await loadBranch({ client, branchId });
  return records.map((record) => attachBranch(record, branch));
};

module.exports = {
  settlementInclude,
  branchSelect,
  loadBranch,
  attachBranch,
  createSettlement,
  getSettlement,
  listSettlements,
};
